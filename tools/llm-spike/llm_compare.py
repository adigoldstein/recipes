"""Story 5.1 spike: run the same recipe text through Ollama and Gemini with the
DraftRecipe JSON schema as the required output. Standalone; no app code.
Keys are read from the environment only (GEMINI_API_KEY; a local git-ignored
.env is loaded for convenience).

    .venv/Scripts/python.exe llm_compare.py [--only ollama|gemini] [--ollama-model qwen2.5:7b]
"""
import argparse
import json
import os
import time
from enum import StrEnum
from pathlib import Path

import httpx
import trafilatura
from pydantic import BaseModel, ConfigDict, ValidationError

HERE = Path(__file__).parent
OUT = HERE / "results"

# Fixtures: 2 English pages, 3 Hebrew pages without JSON-LD (the hard LLM case).
FIXTURES = {
    "en-handletheheat": "02", "en-caputo": "05",
    "he-anatelisha": "07", "he-kobiedri": "08", "he-foodgever": "03",
}


class Unit(StrEnum):  # mirrors apps/recipe-service/app/recipes/units.py
    G = "g"; KG = "kg"; ML = "ml"; L = "l"; TSP = "tsp"; TBSP = "tbsp"; CUP = "cup"
    UNIT = "unit"; PINCH = "pinch"; CLOVE = "clove"; SLICE = "slice"; CAN = "can"; PACKAGE = "package"


class SourceUnit(StrEnum):
    OZ = "oz"; LB = "lb"; FL_OZ = "fl_oz"


class DraftIngredient(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    amount: float | None = None
    unit: Unit | None = None
    note: str | None = None
    to_taste: bool = False
    source_amount: float | None = None
    source_unit: SourceUnit | None = None


class DraftRecipe(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    description: str | None = None
    servings: int | None = None
    ingredients: list[DraftIngredient]
    steps: list[str]
    tags: list[str] = []


SCHEMA = DraftRecipe.model_json_schema()
TRANSPORT_RETRIES: dict[str, int] = {}
PROMPT = (
    "Extract the recipe from the text below as JSON matching the given schema. "
    "Write ALL text fields in Hebrew (translate if needed). Map units to the allowed "
    "unit codes; for ingredients without a quantity (e.g. salt to taste) set "
    "to_taste=true and leave amount/unit null. If the source uses oz, lb or fl oz, "
    "keep the number in source_amount and the code in source_unit. "
    "Do not invent ingredients or steps.\n\nTEXT:\n"
)


def load_env():
    p = HERE / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def page_text(num: str) -> str:
    html = (OUT / "html" / f"{num}.html").read_text(encoding="utf-8")
    return (trafilatura.extract(html, include_comments=False, favor_recall=True) or "")[:12000]


def call_ollama(model, messages):
    r = httpx.post("http://localhost:11434/api/chat", timeout=900, json={
        "model": model, "messages": messages, "stream": False, "format": SCHEMA,
        "options": {"temperature": 0}})
    r.raise_for_status()
    return r.json()["message"]["content"]


def call_gemini(model, messages):
    key = os.environ["GEMINI_API_KEY"]
    contents = [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
                for m in messages]
    for attempt in range(4):  # transport-level retry on overload (503/429), not a validation retry
        r = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key}, timeout=300,
            json={"contents": contents, "generationConfig": {
                "responseMimeType": "application/json", "responseJsonSchema": SCHEMA, "temperature": 0}})
        if r.status_code not in (429, 503):
            break
        TRANSPORT_RETRIES["gemini"] = TRANSPORT_RETRIES.get("gemini", 0) + 1
        time.sleep(5 * (attempt + 1))
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def call_groq(model, messages):
    key = os.environ["GROQ_API_KEY"]
    for attempt in range(4):  # transport-level retry on rate limit / overload
        r = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"}, timeout=300,
            json={"model": model, "messages": messages, "temperature": 0,
                  "response_format": {"type": "json_schema", "json_schema": {
                      "name": "DraftRecipe", "schema": SCHEMA, "strict": False}}})
        if r.status_code not in (429, 503):
            break
        TRANSPORT_RETRIES["groq"] = TRANSPORT_RETRIES.get("groq", 0) + 1
        time.sleep(8 * (attempt + 1))
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:250]}")
    return r.json()["choices"][0]["message"]["content"]


def run_one(call, model, text):
    """One attempt, plus one retry with the validation error fed back (AD-34)."""
    messages = [{"role": "user", "content": PROMPT + text}]
    t0 = time.perf_counter()
    res = {"valid_first": False, "valid_after_retry": False, "error": None}
    raw = ""
    try:
        raw = call(model, messages)
        DraftRecipe.model_validate_json(raw)
        res["valid_first"] = res["valid_after_retry"] = True
    except ValidationError as e:
        res["first_error"] = str(e)[:300]
        try:
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": "Your JSON failed validation:\n" + str(e)[:1500]
                          + "\nReturn corrected JSON only."}]
            raw = call(model, messages)
            DraftRecipe.model_validate_json(raw)
            res["valid_after_retry"] = True
        except Exception as e2:  # noqa: BLE001
            res["error"] = f"{type(e2).__name__}: {str(e2)[:200]}"
    except Exception as e:  # noqa: BLE001
        res["error"] = f"{type(e).__name__}: {str(e)[:200]}"
    res["secs"] = round(time.perf_counter() - t0, 1)
    res["raw"] = raw
    if res["valid_after_retry"]:
        d = DraftRecipe.model_validate_json(raw)
        res["n_ingredients"] = len(d.ingredients)
        res["n_steps"] = len(d.steps)
        res["to_taste"] = [i.name for i in d.ingredients if i.to_taste]
        res["no_unit_with_amount"] = [i.name for i in d.ingredients if i.amount is not None and i.unit is None]
        res["source_units_kept"] = sum(1 for i in d.ingredients if i.source_unit)
    return res


def ollama_stream_probe(model, text):
    """AD-40: does Ollama stream structured output incrementally?"""
    t0 = time.perf_counter()
    chunks, first, buf = 0, None, ""
    with httpx.stream("POST", "http://localhost:11434/api/chat", timeout=900, json={
            "model": model, "messages": [{"role": "user", "content": PROMPT + text}],
            "stream": True, "format": SCHEMA, "options": {"temperature": 0}}) as r:
        for line in r.iter_lines():
            if not line:
                continue
            piece = json.loads(line).get("message", {}).get("content", "")
            if piece:
                chunks += 1
                buf += piece
                first = first or round(time.perf_counter() - t0, 1)
    return {"chunks": chunks, "first_chunk_secs": first,
            "total_secs": round(time.perf_counter() - t0, 1), "chars": len(buf),
            "streams_incrementally": chunks > 5}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["ollama", "gemini", "groq"])
    ap.add_argument("--groq-model", default="qwen/qwen3.8-27b")
    ap.add_argument("--ollama-model", default="qwen2.5:7b")
    ap.add_argument("--gemini-model", default="gemini-2.5-flash")
    ap.add_argument("--stream-probe", action="store_true")
    ap.add_argument("--set", choices=["core", "extra"], default="core",
                    help="core = the 5 epic recipes; extra = the other 10 fetched pages")
    a = ap.parse_args()
    load_env()
    out_path = OUT / "llm_results.json"
    results = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
    engines = []
    if a.only in (None, "ollama"):
        engines.append(("ollama", a.ollama_model, call_ollama))
    if a.only in (None, "gemini"):
        if os.environ.get("GEMINI_API_KEY"):
            label = "gemini" if a.gemini_model == "gemini-3.5-flash" else f"gemini:{a.gemini_model}"
            engines.append((label, a.gemini_model, call_gemini))
        else:
            print("GEMINI_API_KEY not set; skipping Gemini")
    if a.only == "groq":
        if os.environ.get("GROQ_API_KEY"):
            engines.append((f"groq:{a.groq_model}", a.groq_model, call_groq))
        else:
            print("GROQ_API_KEY not set; skipping Groq")
    if a.set == "extra":
        used = set(FIXTURES.values())
        fixtures = {f"x{n}": n for n in (f"{i:02d}" for i in range(1, 16)) if n not in used}
        out_path = OUT / "llm_results_extra.json"
        results = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
    else:
        fixtures = FIXTURES
    texts = {name: page_text(num) for name, num in fixtures.items()}
    for name, t in texts.items():
        print(name, "input chars:", len(t))
    if a.stream_probe:
        results["ollama_stream_probe"] = ollama_stream_probe(a.ollama_model, texts["en-caputo"])
        print("stream probe:", results["ollama_stream_probe"])
    else:
        for eng, model, call in engines:
            for name, text in texts.items():
                res = run_one(call, model, text)
                results.setdefault(eng, {})[name] = {"model": model, **res}
                print(eng, name, {k: v for k, v in res.items() if k not in ("raw", "first_error")}, flush=True)
                out_path.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    results["transport_retries"] = {**results.get("transport_retries", {}), **TRANSPORT_RETRIES}
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
