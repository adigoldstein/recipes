# Story 5.1 spike results (2026-11-04)

Standalone scripts, no app code changed. Keys come from env only (`tools/llm-spike/.env` is git-ignored).

- `fetch_probe.py`: plain httpx fetch of 15 recipe pages, block detection, JSON-LD / recipe-scrapers / trafilatura comparison.
- `llm_compare.py`: the same page text through each engine with the `DraftRecipe` JSON schema, one retry with the validation error fed back (AD-34).
- `results/`: raw outputs (`llm_results*.json`, `fetch_probe.json`, saved HTML, `drafts.html` for the Hebrew review).

## Decision (approved by Adi in the thread)

Provider chain, free tier only: `gemini-3.5-flash-lite` first, then `gemini-3.5-flash`, then Groq `openai/gpt-oss-120b`. Last resort: a clear message with the paste-text path. Ollama is optional, not in the default chain. Paid Gemini is Adi's choice, not the plan.

## Results (15 real pages: 2 English, 13 Hebrew; first try = schema-valid with no retry)

| Engine | Valid first try | Time per page | Notes |
|---|---|---|---|
| Gemini 3.5 flash-lite | 15/15 | 1-4 s | no quota errors in ~33 calls |
| Gemini 3.5 flash | 8/8 before quota ran out | 11-50 s | free tier: 20 requests/day (Google's 429 message) |
| Groq gpt-oss-120b | 14/15 (15/15 after retry) | 3-67 s | slow runs were free-tier rate limits |
| Groq qwen3.8-27b | failed | - | valid JSON with zero ingredients, one server error |
| Ollama qwen2.5:7b (CPU, Intel Arc) | 3/5 | 110-245 s | one 500, one 15-minute timeout |

- Ollama streams structured output incrementally (first chunk 2.4 s, ~800 chunks), so streaming ingredients (AD-40) is feasible, but the speed on this PC is not practical.
- A schema-valid draft with zero ingredients must count as a failure (qwen3.8-27b, and the "10 recipes roundup" page for every engine).
- Hebrew quality (1-5) is still to be scored by Adi in `results/drafts.html`.
- Models are not stable names: `gemini-2.5-flash` returned 404 for this account, so model names must come from config.

## Blocking rate (plain httpx, 15 pages)

1 of 15 blocked (mako.co.il, a Radware block page served with HTTP 200, so a status check alone misses it). Block detection must look at the page content, not only the status code.

## Extraction comparison

- 6 of 14 unblocked pages have a Recipe JSON-LD; the other 8 (mostly Hebrew blogs) have none, so the LLM fallback is needed for most of Adi's sites.
- `recipe-scrapers` succeeded on exactly the 6 pages where JSON-LD parsing with BeautifulSoup also worked, and failed on the other 8. It adds nothing over BeautifulSoup here.
- `trafilatura` produced clean text for the pages without JSON-LD; only worth adding if plain BeautifulSoup cleaning proves noisy.

## Proposed values (for Adi to confirm)

- Per-provider timeouts: flash-lite 30 s, flash 90 s, Groq 90 s.
- Input cap: about 6,000 characters of cleaned text.
- Chain switches: on 429/503 or quota exhausted, go to the next engine at once (no waiting out a daily quota); on invalid JSON after the one retry, or an empty ingredient list, go to the next engine; all failed: paste-text message.

## Caveats

Small sample (15 pages, Adi's sites). The flash-lite daily quota was not measured over time. Pricing figures seen in third-party sources were not verified against Google's own page.
