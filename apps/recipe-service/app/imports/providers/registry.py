"""Providers are registered by name and enabled from config (AD-12)."""

from collections.abc import Callable

from app.core.config import Settings
from app.imports.providers.base import LlmProvider
from app.imports.providers.fake import FakeProvider
from app.imports.providers.gemini import GeminiProvider


class ProviderUnavailableError(Exception):
    """The requested provider is unknown, disabled, or missing its key."""


def _build_gemini(settings: Settings) -> LlmProvider:
    if settings.gemini_api_key is None:
        raise ProviderUnavailableError("gemini has no API key")
    return GeminiProvider(
        api_key=settings.gemini_api_key.get_secret_value(),
        model=settings.gemini_model,
        timeout_seconds=settings.gemini_timeout_seconds,
        max_output_tokens=settings.llm_max_tokens,
    )


_BUILDERS: dict[str, Callable[[Settings], LlmProvider]] = {
    "gemini": _build_gemini,
    "fake": lambda _settings: FakeProvider(),
}


def default_provider(settings: Settings) -> LlmProvider:
    """The first enabled provider, built from settings."""
    if not settings.llm_providers:
        raise ProviderUnavailableError("no import provider is enabled")
    name = settings.llm_providers[0]
    builder = _BUILDERS.get(name)
    if builder is None:
        raise ProviderUnavailableError(f"unknown import provider '{name}'")
    return builder(settings)
