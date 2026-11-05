"""Story 5.1 spike: fetch recipe URLs with plain httpx, detect block pages,
and compare extraction options (JSON-LD via BeautifulSoup, recipe-scrapers,
trafilatura). Standalone; no app code. Run with the venv python:

    .venv/Scripts/python.exe fetch_probe.py
"""
import json
import re
import sys
import time
from pathlib import Path

import httpx
import trafilatura
from bs4 import BeautifulSoup
from recipe_scrapers import scrape_html

HERE = Path(__file__).parent
OUT = HERE / "results"
HTML_DIR = OUT / "html"
HTML_DIR.mkdir(parents=True, exist_ok=True)

BLOCK_MARKERS = [
    "just a moment", "cf-chl", "challenge-platform", "attention required",
    "captcha", "access denied", "px-captcha", "incapsula", "are you a robot",
    "unusual traffic", "enable javascript and cookies",
]
STRONG_BLOCK_MARKERS = [
    "radware block page", "captcha.perfdrive.com", "shieldsquare",
    "cf-browser-verification", "<title>just a moment", "access denied</title>",
]
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def fetch(url: str, headers: dict | None):
    t = time.perf_counter()
    try:
        r = httpx.get(url, headers=headers, follow_redirects=True, timeout=20)
        return r.status_code, r.text, round(time.perf_counter() - t, 2), None
    except Exception as e:  # noqa: BLE001
        return None, "", round(time.perf_counter() - t, 2), type(e).__name__


def is_blocked(status, html):
    if status is None:
        return True
    if status in (401, 403, 429, 503):
        return True
    low = html[:20000].lower()
    # Strong markers (a vendor's block page, even served as HTTP 200).
    if any(m in low for m in STRONG_BLOCK_MARKERS):
        return True
    return len(html) < 3000 and any(m in low for m in BLOCK_MARKERS)


def jsonld_recipe(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except Exception:  # noqa: BLE001
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                t = node.get("@type")
                if t == "Recipe" or (isinstance(t, list) and "Recipe" in t):
                    return node
                stack.extend(node.get("@graph", []))
            elif isinstance(node, list):
                stack.extend(node)
    return None


def main():
    urls = [u.strip() for u in (HERE / "urls.txt").read_text(encoding="utf-8").splitlines() if u.strip()]
    rows = []
    for i, url in enumerate(urls, 1):
        row = {"n": i, "url": url, "domain": httpx.URL(url).host}
        for label, headers in (("plain", None), ("browser_ua", {"User-Agent": BROWSER_UA})):
            status, html, secs, err = fetch(url, headers)
            row[label] = {"status": status, "blocked": is_blocked(status, html),
                          "bytes": len(html), "secs": secs, "error": err}
            if label == "plain":
                plain_html = html
            elif not row["browser_ua"]["blocked"] and row["plain"]["blocked"]:
                plain_html = html
        html = plain_html
        if html and not row["plain"]["blocked"] or (html and not row["browser_ua"]["blocked"]):
            (HTML_DIR / f"{i:02d}.html").write_text(html, encoding="utf-8")
            node = jsonld_recipe(html)
            row["jsonld_recipe"] = bool(node)
            if node:
                row["jsonld_ingredients"] = len(node.get("recipeIngredient", []) or [])
            try:
                s = scrape_html(html, org_url=url, wild_mode=True) if "wild_mode" in scrape_html.__code__.co_varnames else scrape_html(html, org_url=url)
                row["recipe_scrapers"] = {"ok": True, "title": s.title(), "ingredients": len(s.ingredients())}
            except Exception as e:  # noqa: BLE001
                row["recipe_scrapers"] = {"ok": False, "error": f"{type(e).__name__}: {str(e)[:80]}"}
            text = trafilatura.extract(html, include_comments=False) or ""
            row["trafilatura_chars"] = len(text)
            row["trafilatura_has_ingredient_word"] = bool(re.search(r"מצרכים|רכיבים|ingredients", text, re.I))
        rows.append(row)
        print(i, row["domain"], row["plain"]["status"], row["plain"]["blocked"],
              row["browser_ua"]["status"], row["browser_ua"]["blocked"],
              row.get("jsonld_recipe"), row.get("recipe_scrapers", {}).get("ok"),
              row.get("trafilatura_chars"), flush=True)
    (OUT / "fetch_probe.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    n = len(rows)
    print("\nblocked (plain):", sum(r["plain"]["blocked"] for r in rows), "/", n)
    print("blocked (browser UA):", sum(r["browser_ua"]["blocked"] for r in rows), "/", n)


if __name__ == "__main__":
    sys.exit(main())
