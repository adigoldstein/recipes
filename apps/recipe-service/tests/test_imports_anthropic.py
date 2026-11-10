"""Tests the Claude provider with a fake HTTP server (no network, no API key)."""

import asyncio
import json
from typing import Any

import httpx
import pytest

from app.imports.providers.anthropic import AnthropicProvider
from app.imports.providers.base import (
    LlmQuotaError,
    LlmTimeoutError,
    LlmUnavailableError,
)

API_KEY = "secret-key-value"
GOOD = {
    "title": "עוגה",
    "ingredients": [{"name": "קמח", "amount": 200, "unit": "g"}],
    "steps": [{"description": "אופים"}],
}


def reply(
    tool_input: dict[str, Any] | str, input_tokens: int, output_tokens: int
) -> httpx.Response:
    if isinstance(tool_input, str):
        block: dict[str, Any] = {"type": "text", "text": tool_input}
    else:
        block = {
            "type": "tool_use",
            "id": "toolu_1",
            "name": "record_recipe",
            "input": tool_input,
        }
    payload = {
        "content": [block],
        "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
    }
    return httpx.Response(200, json=payload)


def provider(handler: Any) -> AnthropicProvider:
    return AnthropicProvider(
        api_key=API_KEY,
        model="claude-test",
        timeout_seconds=5,
        max_output_tokens=1000,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


def test_a_valid_tool_reply_is_returned_with_its_cost() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return reply(GOOD, input_tokens=120, output_tokens=40)

    result = asyncio.run(provider(handler).extract("a cake recipe", ["קינוח"]))
    assert result.draft.title == "עוגה"
    assert (result.first_try_valid, result.retried) == (True, False)
    assert (result.usage.input_tokens, result.usage.output_tokens) == (120, 40)
    [request] = seen
    assert request.url == "https://api.anthropic.com/v1/messages"
    assert request.headers["x-api-key"] == API_KEY
    assert request.headers["anthropic-version"] == "2023-06-01"
    body = json.loads(request.content)
    assert body["model"] == "claude-test"
    assert body["tool_choice"] == {"type": "tool", "name": "record_recipe"}
    # The model returns 400 for `temperature`, so the request must never send it.
    assert "temperature" not in body
    assert body["tools"][0]["input_schema"]["type"] == "object"
    # The API key is sent in a header, never in the body.
    assert API_KEY.encode() not in request.content


def test_an_invalid_tool_reply_is_retried_once() -> None:
    replies = [
        reply({"title": 5}, input_tokens=100, output_tokens=10),
        reply(GOOD, input_tokens=150, output_tokens=20),
    ]

    result = asyncio.run(provider(lambda _request: replies.pop(0)).extract("text", []))
    assert (result.first_try_valid, result.retried) == (False, True)
    assert (result.usage.input_tokens, result.usage.output_tokens) == (250, 30)


def test_a_reply_without_the_tool_is_treated_as_invalid() -> None:
    replies = [reply("plain text", 10, 5), reply("plain text", 10, 5)]
    from app.imports.providers.base import LlmInvalidOutputError

    with pytest.raises(LlmInvalidOutputError):
        asyncio.run(provider(lambda _request: replies.pop(0)).extract("text", []))


def test_overload_is_unavailable_and_the_status_is_in_the_message() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(529, json={"error": {"type": "overloaded_error"}})

    with pytest.raises(LlmUnavailableError, match="HTTP 529") as caught:
        asyncio.run(provider(handler).extract("text", []))
    assert caught.value.upstream_status == 529


def test_rate_limit_is_a_quota_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"type": "rate_limit_error"}})

    with pytest.raises(LlmQuotaError) as caught:
        asyncio.run(provider(handler).extract("text", []))
    assert caught.value.upstream_status == 429


def test_a_timeout_is_a_timeout_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(LlmTimeoutError):
        asyncio.run(provider(handler).extract("text", []))
