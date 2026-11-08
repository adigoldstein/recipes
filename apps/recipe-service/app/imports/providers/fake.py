"""The deterministic `fake` provider, for tests and CI, which never call a real model.

The scenario is chosen by the pasted text: `FAKE:<scenario>` (see `SCENARIOS`).
"""

import asyncio
import json
from collections.abc import Callable, Sequence
from typing import Any

from app.imports.providers.base import (
    LlmQuotaError,
    LlmResult,
    LlmTimeoutError,
    LlmUnavailableError,
    Message,
    RawReply,
    Usage,
    extract_with_retry,
)

_USAGE = Usage(input_tokens=100, output_tokens=50)

_COOKIES: dict[str, Any] = {
    "title": "עוגיות שוקולד צ'יפס",
    "description": "עוגיות רכות עם שוקולד.",
    "base_servings": 24,
    "prep_time_minutes": 15,
    "cook_time_minutes": 12,
    "ingredients": [
        {"name": "קמח", "amount": 2, "unit": "cup"},
        {"name": "חמאה", "amount": 200, "unit": "g"},
        {"name": "ביצים", "amount": 2, "unit": "unit"},
        {"name": "מלח"},
    ],
    "steps": [
        {"description": "מערבבים את החמאה עם הסוכר."},
        {"description": "מוסיפים קמח ושוקולד ומרכיבים כדורים."},
    ],
    "tags": ["קינוח"],
    "new_tags": ["עוגיות"],
}

_IMPERIAL: dict[str, Any] = {
    "title": "לחם בית",
    "ingredients": [
        {"name": "קמח", "source": {"amount": 1, "unit": "lb"}},
        {"name": "חלב", "source": {"amount": 8, "unit": "fl_oz"}},
        {"name": "גבינה", "source": {"amount": 4, "unit": "oz"}},
        {"name": "כוס סוכר", "amount": 1, "unit": "cup"},
    ],
    "steps": [
        {"description": "מחממים תנור ל-350°F."},
        {"description": "אופים 40 דקות."},
    ],
}

_ENGLISH: dict[str, Any] = {**_COOKIES, "translated": True, "base_servings": None}

_EMPTY: dict[str, Any] = {"title": "אין כאן מתכון", "ingredients": [], "steps": []}

# An ingredient with amount 0 breaks the schema (amount must be above zero).
_INVALID = json.dumps(
    {**_COOKIES, "ingredients": [{"name": "קמח", "amount": 0, "unit": "g"}]}
)


def _reply(body: dict[str, Any] | str) -> RawReply:
    text = body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)
    return RawReply(text=text, usage=_USAGE)


def _raise(error: type[Exception], detail: str) -> Callable[[int], RawReply]:
    def respond(_call: int) -> RawReply:
        raise error(detail)

    return respond


# Each scenario answers call number 1, 2, ... (the second call is the retry).
SCENARIOS: dict[str, Callable[[int], RawReply]] = {
    "ok": lambda _call: _reply(_COOKIES),
    "imperial": lambda _call: _reply(_IMPERIAL),
    "english": lambda _call: _reply(_ENGLISH),
    "empty": lambda _call: _reply(_EMPTY),
    "invalid": lambda _call: _reply(_INVALID),
    "invalid-then-valid": lambda call: _reply(_INVALID if call == 1 else _COOKIES),
    "not-json": lambda _call: _reply("this is not json"),
    "timeout": _raise(LlmTimeoutError, "fake timeout"),
    "quota": _raise(LlmQuotaError, "fake quota"),
    "unavailable": _raise(LlmUnavailableError, "fake unavailable"),
    "slow": lambda _call: _reply(_COOKIES),
}

# How long `FAKE:slow` takes to answer.
SLOW_SECONDS = 20.0


class FakeProvider:
    name = "fake"
    model = "fake-1"
    timeout_seconds = 30.0

    async def extract(self, text: str, existing_tags: Sequence[str]) -> LlmResult:
        stripped = text.strip()
        scenario = (
            stripped.removeprefix("FAKE:").strip()
            if stripped.startswith("FAKE:")
            else "ok"
        )
        respond = SCENARIOS.get(scenario, SCENARIOS["ok"])
        calls = 0

        async def transport(_messages: Sequence[Message]) -> RawReply:
            nonlocal calls
            calls += 1
            if scenario == "slow":
                # A slow engine, for trying "ביטול" by hand and for the cancel tests.
                await asyncio.sleep(SLOW_SECONDS)
            return respond(calls)

        return await extract_with_retry(transport, [("user", text)])
