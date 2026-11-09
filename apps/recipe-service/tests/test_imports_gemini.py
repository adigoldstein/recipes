"""Tests the Gemini provider with a fake HTTP server, and the shared retry step
(AD-34)."""

import asyncio
import json
import logging
from typing import Any

import httpx
import pytest

from app.imports.providers.base import (
    LlmInvalidOutputError,
    LlmQuotaError,
    LlmTimeoutError,
    LlmUnavailableError,
)
from app.imports.providers.gemini import GeminiProvider

API_KEY = "secret-key-value"
GOOD = {
    "title": "עוגה",
    "ingredients": [{"name": "קמח", "amount": 200, "unit": "g"}],
    "steps": [{"description": "אופים"}],
}


def reply(body: dict[str, Any] | str, **meta: int) -> httpx.Response:
    text = body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)
    payload = {
        "candidates": [{"content": {"parts": [{"text": text}]}}],
        "usageMetadata": meta,
    }
    return httpx.Response(200, json=payload)


def provider(handler: Any) -> GeminiProvider:
    return GeminiProvider(
        api_key=API_KEY,
        model="gemini-test",
        timeout_seconds=5,
        max_output_tokens=1000,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


def test_a_valid_reply_is_returned_with_its_cost() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return reply(
            GOOD, promptTokenCount=120, candidatesTokenCount=40, thoughtsTokenCount=10
        )

    result = asyncio.run(provider(handler).extract("a cake recipe", ["קינוח"]))
    assert result.draft.title == "עוגה"
    assert (result.first_try_valid, result.retried) == (True, False)
    assert (result.usage.input_tokens, result.usage.output_tokens) == (120, 50)
    [request] = seen
    assert request.url.path.endswith("/models/gemini-test:generateContent")
    # The API key is sent in a header, never in the URL or the body.
    assert request.headers["x-goog-api-key"] == API_KEY
    assert API_KEY not in str(request.url)
    assert API_KEY not in request.content.decode()
    body = json.loads(request.content)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["generationConfig"]["maxOutputTokens"] == 1000
    assert "DraftRecipe" in json.dumps(body["generationConfig"]["responseJsonSchema"])
    prompt = body["contents"][0]["parts"][0]["text"]
    assert "a cake recipe" in prompt
    assert "קינוח" in prompt


def test_thought_parts_are_not_part_of_the_reply() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        parts = [{"text": "thinking...", "thought": True}, {"text": json.dumps(GOOD)}]
        return httpx.Response(200, json={"candidates": [{"content": {"parts": parts}}]})

    assert asyncio.run(provider(handler).extract("x", [])).draft.title == "עוגה"


def test_an_invalid_reply_is_retried_once_with_the_error_fed_back() -> None:
    bodies: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        if len(bodies) == 1:
            return reply({**GOOD, "ingredients": [{"name": "קמח", "amount": -1}]})
        return reply(GOOD)

    result = asyncio.run(provider(handler).extract("x", []))
    assert (result.first_try_valid, result.retried) == (False, True)
    retry_turns = bodies[1]["contents"]
    assert [turn["role"] for turn in retry_turns] == ["user", "model", "user"]
    assert "ingredients.0.amount" in retry_turns[2]["parts"][0]["text"]


def test_a_second_invalid_reply_raises_llm_invalid_output() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return reply("not json at all")

    with pytest.raises(LlmInvalidOutputError):
        asyncio.run(provider(handler).extract("x", []))
    assert calls == 2  # one try and exactly one retry


def test_a_blocked_reply_with_no_candidates_is_invalid_output() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})

    with pytest.raises(LlmInvalidOutputError):
        asyncio.run(provider(handler).extract("x", []))


def test_http_429_is_a_quota_error_and_is_not_retried() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(429, json={"error": {"message": "quota"}})

    with pytest.raises(LlmQuotaError):
        asyncio.run(provider(handler).extract("x", []))
    assert calls == 1


@pytest.mark.parametrize("status", [400, 404, 500, 503])
def test_other_http_errors_are_unavailable(status: int) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text="boom")

    with pytest.raises(LlmUnavailableError):
        asyncio.run(provider(handler).extract("x", []))


def test_a_timeout_and_a_network_error_have_their_own_codes() -> None:
    def times_out(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    def unreachable(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    with pytest.raises(LlmTimeoutError):
        asyncio.run(provider(times_out).extract("x", []))
    with pytest.raises(LlmUnavailableError):
        asyncio.run(provider(unreachable).extract("x", []))


def test_the_key_never_reaches_the_logs(caplog: pytest.LogCaptureFixture) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="overloaded")

    with caplog.at_level(logging.DEBUG), pytest.raises(LlmUnavailableError):
        asyncio.run(provider(handler).extract("x", []))
    assert API_KEY not in caplog.text
