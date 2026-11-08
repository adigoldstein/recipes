"""The Claude adapter: plain `httpx` against the Messages API, no SDK.

The draft is requested as a forced tool call whose input schema is `DraftRecipe`,
so the reply arrives as a JSON object instead of free text.
"""

import asyncio
import json
import logging
from collections.abc import Sequence
from typing import Any

import httpx

from app.imports.prompt import build_prompt
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
from app.imports.schemas import DraftRecipe

logger = logging.getLogger(__name__)

_URL = "https://api.anthropic.com/v1/messages"
_API_VERSION = "2023-06-01"
_TOOL_NAME = "record_recipe"


class AnthropicProvider:
    name = "anthropic"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_output_tokens: int,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self.timeout_seconds = timeout_seconds
        self._max_output_tokens = max_output_tokens
        self._client = client
        self._schema = DraftRecipe.model_json_schema()

    async def extract(self, text: str, existing_tags: Sequence[str]) -> LlmResult:
        prompt = build_prompt(text, existing_tags)
        return await extract_with_retry(self._send, [("user", prompt)])

    async def _send(self, messages: Sequence[Message]) -> RawReply:
        body = {
            "model": self.model,
            "max_tokens": self._max_output_tokens,
            "messages": [
                {"role": "user" if role == "user" else "assistant", "content": content}
                for role, content in messages
            ],
            "tools": [
                {
                    "name": _TOOL_NAME,
                    "description": "Record the recipe extracted from the text.",
                    "input_schema": self._schema,
                }
            ],
            "tool_choice": {"type": "tool", "name": _TOOL_NAME},
        }
        try:
            response = await self._post(
                _URL,
                headers={
                    "x-api-key": self._api_key,
                    "anthropic-version": _API_VERSION,
                    "content-type": "application/json",
                },
                json=body,
                timeout=self.timeout_seconds,
            )
        except (httpx.TimeoutException, TimeoutError) as error:
            raise LlmTimeoutError("Claude did not answer in time") from error
        except httpx.HTTPError as error:
            raise LlmUnavailableError("Claude could not be reached") from error
        _raise_for_status(response)
        return _read_reply(response.json())

    async def _post(self, url: str, **kwargs: Any) -> httpx.Response:
        """One call, bounded by the timeout; cancelling the caller drops the request."""
        async with asyncio.timeout(self.timeout_seconds):
            if self._client is not None:
                return await self._client.post(url, **kwargs)
            async with httpx.AsyncClient() as client:
                return await client.post(url, **kwargs)


def _raise_for_status(response: httpx.Response) -> None:
    status = response.status_code
    if status < 400:
        return
    # Never log the request: it carries the key. The status and the API's own message
    # are enough to tell an overload from a bad key or an exhausted quota.
    logger.warning("Claude returned HTTP %s: %s", status, response.text[:300])
    if status == 429:
        raise LlmQuotaError("Claude quota exhausted", status)
    raise LlmUnavailableError(f"Claude returned HTTP {status}", status)


def _read_reply(payload: dict[str, Any]) -> RawReply:
    blocks = payload.get("content") or []
    tool_input = next(
        (
            block.get("input")
            for block in blocks
            if block.get("type") == "tool_use" and block.get("name") == _TOOL_NAME
        ),
        None,
    )
    text = "" if tool_input is None else json.dumps(tool_input, ensure_ascii=False)
    meta = payload.get("usage") or {}
    return RawReply(
        text=text,
        usage=Usage(
            input_tokens=meta.get("input_tokens"),
            output_tokens=meta.get("output_tokens"),
        ),
    )
