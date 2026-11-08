"""The Gemini adapter: plain `httpx` against the REST API (no SDK), free tier."""

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

_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_output_tokens: int,
        client: httpx.Client | None = None,
    ) -> None:
        self.model = model
        self._api_key = api_key
        self.timeout_seconds = timeout_seconds
        self._max_output_tokens = max_output_tokens
        self._client = client or httpx.Client()
        self._schema = DraftRecipe.model_json_schema()

    def extract(self, text: str, existing_tags: Sequence[str]) -> LlmResult:
        prompt = build_prompt(text, existing_tags)
        return extract_with_retry(self._send, [("user", prompt)])

    def _send(self, messages: Sequence[Message]) -> RawReply:
        body = {
            "contents": [
                {
                    "role": "user" if role == "user" else "model",
                    "parts": [{"text": content}],
                }
                for role, content in messages
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": self._schema,
                "temperature": 0,
                "maxOutputTokens": self._max_output_tokens,
            },
        }
        try:
            response = self._client.post(
                _URL.format(model=self.model),
                headers={"x-goog-api-key": self._api_key},
                json=body,
                timeout=self.timeout_seconds,
            )
        except httpx.TimeoutException as error:
            raise LlmTimeoutError("Gemini did not answer in time") from error
        except httpx.HTTPError as error:
            raise LlmUnavailableError("Gemini could not be reached") from error
        _raise_for_status(response)
        return _read_reply(response.json())


def _raise_for_status(response: httpx.Response) -> None:
    status = response.status_code
    if status < 400:
        return
    # Never log the request: it carries the key. The status and Google's own message
    # are enough to tell a retired model from an overload.
    logger.warning("Gemini returned HTTP %s: %s", status, response.text[:300])
    if status == 429:
        raise LlmQuotaError("Gemini quota exhausted", status)
    raise LlmUnavailableError(f"Gemini returned HTTP {status}", status)


def _read_reply(payload: dict[str, Any]) -> RawReply:
    candidates = payload.get("candidates") or []
    parts = (
        (candidates[0].get("content") or {}).get("parts") or [] if candidates else []
    )
    text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
    meta = payload.get("usageMetadata") or {}
    output = meta.get("candidatesTokenCount")
    thoughts = meta.get("thoughtsTokenCount")
    return RawReply(
        text=text,
        usage=Usage(
            input_tokens=meta.get("promptTokenCount"),
            output_tokens=None if output is None else output + (thoughts or 0),
        ),
    )
