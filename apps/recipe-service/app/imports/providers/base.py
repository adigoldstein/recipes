"""The `LlmProvider` port and the shared validate-and-retry step (AD-12, AD-34)."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Protocol

from pydantic import ValidationError

from app.core.errors import ErrorCode
from app.imports.schemas import DraftRecipe

# A chat turn: ("user" | "assistant", text).
Message = tuple[str, str]


class LlmError(Exception):
    """A provider call failed; `code` is the stable error code the client shows."""

    code: ErrorCode

    def __init__(self, detail: str, upstream_status: int | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        # The HTTP status the provider answered with, when it answered at all.
        self.upstream_status = upstream_status


class LlmTimeoutError(LlmError):
    code = ErrorCode.LLM_TIMEOUT


class LlmUnavailableError(LlmError):
    code = ErrorCode.LLM_UNAVAILABLE


class LlmQuotaError(LlmError):
    code = ErrorCode.LLM_QUOTA


class LlmInvalidOutputError(LlmError):
    code = ErrorCode.LLM_INVALID_OUTPUT


@dataclass(frozen=True)
class Usage:
    input_tokens: int | None = None
    output_tokens: int | None = None

    def plus(self, other: "Usage") -> "Usage":
        return Usage(
            _sum(self.input_tokens, other.input_tokens),
            _sum(self.output_tokens, other.output_tokens),
        )


def _sum(a: int | None, b: int | None) -> int | None:
    return None if a is None and b is None else (a or 0) + (b or 0)


@dataclass(frozen=True)
class RawReply:
    """What a provider transport returns: the reply text and what it cost."""

    text: str
    usage: Usage = Usage()


@dataclass(frozen=True)
class LlmResult:
    draft: DraftRecipe
    first_try_valid: bool
    retried: bool
    usage: Usage


class LlmProvider(Protocol):
    """The only thing `imports` depends on: text in, a validated draft out."""

    name: str
    model: str

    def extract(self, text: str, existing_tags: Sequence[str]) -> LlmResult: ...


Transport = Callable[[Sequence[Message]], RawReply]


def extract_with_retry(transport: Transport, messages: Sequence[Message]) -> LlmResult:
    """Validate the reply against `DraftRecipe`; on failure retry once with the error.

    A second failure raises `LlmInvalidOutputError` (AD-34). Transport errors
    (`LlmError`) pass through untouched.
    """
    first = transport(messages)
    try:
        draft = DraftRecipe.model_validate_json(first.text)
    except ValidationError as error:
        feedback = (
            "Your JSON did not match the schema:\n"
            f"{_describe(error)}\n"
            "Return the corrected JSON only."
        )
        second = transport([*messages, ("assistant", first.text), ("user", feedback)])
        usage = first.usage.plus(second.usage)
        try:
            draft = DraftRecipe.model_validate_json(second.text)
        except ValidationError as error_again:
            raise LlmInvalidOutputError(_describe(error_again)) from error_again
        return LlmResult(draft, first_try_valid=False, retried=True, usage=usage)
    return LlmResult(draft, first_try_valid=True, retried=False, usage=first.usage)


def _describe(error: ValidationError) -> str:
    lines = [
        f"- {'.'.join(str(part) for part in item['loc']) or 'reply'}: {item['msg']}"
        for item in error.errors(include_input=False, include_url=False)
    ]
    return "\n".join(lines[:10])
