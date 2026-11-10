"""Reads a downloaded recipe page (AD-13, AD-35).

If the page has Schema.org Recipe JSON-LD, we use it. Otherwise we use the page's
readable text. Either way, the result is plain text for the LLM, which always runs
(to translate, set units, and choose tags). The main photo is `Recipe.image`, or
`og:image` if there is none. If the site answers with an anti-bot check or a block
page, we detect it here and report it. We never try to get around it.
"""

import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from app.core.safe_fetch import (
    FetchBlockedError,
    FetchChallengedError,
    FetchFailedError,
)
from app.imports.fetchers.base import FetchedPage

ImportPath = Literal["json_ld", "llm"]

_HTML_TYPES = {"text/html", "application/xhtml+xml", ""}

# HTTP statuses that anti-bot services answer with, and text that appears on their
# pages. The text alone is enough, even with status 200, because some anti-bot pages
# answer with 200.
_CHALLENGE_STATUSES = {403, 429, 503}
_CHALLENGE_MARKERS = (
    "cf-chl-",  # Cloudflare managed challenge
    "challenge-platform",  # Cloudflare
    "cf-browser-verification",
    "_incapsula_resource",  # Imperva
    "px-captcha",  # PerimeterX / HUMAN
    "captcha-delivery.com",  # DataDome
    "ak_bmsc",  # Akamai Bot Manager
)
_CHALLENGE_TITLES = (
    "just a moment",
    "attention required",
    "checking your browser",
    "access denied",
    "verify you are human",
)
_BLOCKED_STATUSES = {401, 403, 429}

# HTML tags that never contain the recipe.
_NOISE_TAGS = (
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "iframe",
)


@dataclass(frozen=True)
class ParsedPage:
    path: ImportPath
    # The text we send to the LLM: the JSON-LD recipe as text, or the page's text.
    text: str
    photo_url: str | None


def read_page(page: FetchedPage) -> ParsedPage:
    """Checks the response, then takes the recipe text and photo from the HTML."""
    soup = BeautifulSoup(page.html, "html.parser")
    if _is_challenge(page.status, soup):
        raise FetchChallengedError("the site answered with a bot-protection check")
    if page.status in _BLOCKED_STATUSES:
        raise FetchBlockedError(f"the site refused the request ({page.status})")
    if not 200 <= page.status < 300:
        raise FetchFailedError(f"the site answered {page.status}")
    if page.content_type not in _HTML_TYPES:
        raise FetchFailedError("the link is not a web page")

    # Prefer the JSON-LD recipe. If there is none, use the page's readable text.
    recipe = _find_recipe(soup)
    if recipe is not None:
        text = recipe_text(recipe)
        if text:
            photo = _image_url(recipe.get("image")) or _og_image(soup)
            return ParsedPage("json_ld", text, _absolute(page.url, photo))
    return ParsedPage("llm", _readable_text(soup), _absolute(page.url, _og_image(soup)))


# --- Challenge pages ------------------------------------------------------------


def _is_challenge(status: int, soup: BeautifulSoup) -> bool:
    html = str(soup).lower()
    if any(marker in html for marker in _CHALLENGE_MARKERS):
        return True
    title = soup.title.get_text(" ", strip=True).lower() if soup.title else ""
    return status in _CHALLENGE_STATUSES and any(t in title for t in _CHALLENGE_TITLES)


# --- JSON-LD --------------------------------------------------------------------


def _find_recipe(soup: BeautifulSoup) -> dict[str, Any] | None:
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text()
        try:
            data = json.loads(raw, strict=False)
        except ValueError:
            continue
        for node in _nodes(data):
            if _is_recipe(node):
                return node
    return None


def _nodes(data: Any) -> Iterator[dict[str, Any]]:
    """Returns every object in a JSON-LD document: at the top level, in lists, and in
    `@graph`."""
    if isinstance(data, list):
        for item in data:
            yield from _nodes(item)
    elif isinstance(data, dict):
        yield data
        yield from _nodes(data.get("@graph"))
        yield from _nodes(data.get("mainEntity"))


def _is_recipe(node: dict[str, Any]) -> bool:
    kind = node.get("@type")
    kinds = kind if isinstance(kind, list) else [kind]
    return any(isinstance(k, str) and k.rsplit("/", 1)[-1] == "Recipe" for k in kinds)


def recipe_text(recipe: dict[str, Any]) -> str:
    """Writes the JSON-LD recipe as plain text with labels, with the ingredients and
    steps in order."""
    lines: list[str] = []
    for label, key in (
        ("Title", "name"),
        ("Description", "description"),
        ("Servings", "recipeYield"),
        ("Prep time", "prepTime"),
        ("Cook time", "cookTime"),
        ("Total time", "totalTime"),
    ):
        value = _plain(recipe.get(key))
        if value:
            lines.append(f"{label}: {value}")

    ingredients = [_plain(item) for item in _as_list(recipe.get("recipeIngredient"))]
    ingredients = [item for item in ingredients if item]
    if ingredients:
        lines += ["", "Ingredients:", *(f"- {item}" for item in ingredients)]

    steps = list(_steps(recipe.get("recipeInstructions")))
    if steps:
        lines += ["", "Steps:", *(f"{n}. {step}" for n, step in enumerate(steps, 1))]

    if not ingredients and not steps:
        return ""
    return "\n".join(lines).strip()


def _steps(value: Any) -> Iterator[str]:
    """Returns the steps as a flat list of strings, in order.

    A step can be a string, a HowToStep object, or a HowToSection group of steps.
    """
    if isinstance(value, str):
        # Some sites put all the steps in one string, one step per line.
        for line in _clean(value).split("\n"):
            if line.strip():
                yield line.strip()
    elif isinstance(value, list):
        for item in value:
            yield from _steps(item)
    elif isinstance(value, dict):
        if "itemListElement" in value:
            name = _plain(value.get("name"))
            if name:
                yield f"{name}:"
            yield from _steps(value["itemListElement"])
        else:
            text = _plain(value.get("text") or value.get("name"))
            if text:
                yield text


def _image_url(value: Any) -> str | None:
    if isinstance(value, str):
        return value or None
    if isinstance(value, list):
        for item in value:
            url = _image_url(item)
            if url:
                return url
        return None
    if isinstance(value, dict):
        return _image_url(value.get("url") or value.get("contentUrl"))
    return None


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _plain(value: Any) -> str:
    """Turns a JSON-LD value into one line of text, without HTML tags and entities."""
    if isinstance(value, list):
        value = next((item for item in value if item), "")
    if isinstance(value, int | float) and not isinstance(value, bool):
        return str(value)
    if not isinstance(value, str):
        return ""
    return " ".join(_clean(value).split())


def _clean(value: str) -> str:
    if "<" in value or "&" in value:
        return BeautifulSoup(value, "html.parser").get_text("\n")
    return value


# --- Readable text and og:image -------------------------------------------------


def _readable_text(soup: BeautifulSoup) -> str:
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    body = soup.find("article") or soup.find("main") or soup.body or soup
    for tag in body.find_all(_NOISE_TAGS):
        tag.decompose()
    text = body.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return f"{title}\n\n{text}".strip() if title and title not in text else text


def _og_image(soup: BeautifulSoup) -> str | None:
    for attribute in ("property", "name"):
        meta = soup.find("meta", attrs={attribute: "og:image"})
        if isinstance(meta, Tag):
            content = meta.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
    return None


def _absolute(base: str, url: str | None) -> str | None:
    """Turns a relative photo URL into a full URL, based on the page URL. Returns
    None if it is not http(s)."""
    if not url:
        return None
    absolute = urljoin(base, url.strip())
    if urlsplit(absolute).scheme not in ("http", "https") or len(absolute) > 2048:
        return None
    return absolute
