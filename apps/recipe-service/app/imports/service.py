"""Business rules for imports; other modules call this layer, never the repository."""

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.imports.conversion import convert_ingredient, convert_step
from app.imports.models import ImportAttempt, ImportRun
from app.imports.prompt import PROMPT_VERSION
from app.imports.providers.base import LlmError, LlmProvider, LlmResult, Usage
from app.imports.providers.registry import ProviderUnavailableError, default_provider
from app.imports.repository import ImportRepository
from app.imports.schemas import DraftRecipe
from app.tags.service import TagService, get_tag_service

logger = logging.getLogger(__name__)

# Tag names are stored with this limit (the tags module owns it).
_TAG_NAME_MAX_LENGTH = 40

# Where each failure goes on the wire (a provider failure is 502, a timeout 504).
_LLM_STATUS = {
    ErrorCode.LLM_TIMEOUT: 504,
    ErrorCode.LLM_UNAVAILABLE: 502,
    ErrorCode.LLM_QUOTA: 502,
    ErrorCode.LLM_INVALID_OUTPUT: 502,
}


class ImportService:
    def __init__(
        self,
        repository: ImportRepository,
        tag_service: TagService,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._tag_service = tag_service
        self._settings = settings

    def import_text(self, text: str, user_id: uuid.UUID) -> DraftRecipe:
        """Turn pasted recipe text into a Hebrew draft. Nothing is saved (AD-22)."""
        if len(text) > self._settings.import_max_chars:
            raise AppError(
                413,
                ErrorCode.IMPORT_TEXT_TOO_LONG,
                "The text is too long",
                {"max": self._settings.import_max_chars},
            )
        self._ensure_under_daily_cap()
        provider = self._provider()
        existing_tags = [tag.name for tag in self._tag_service.list_tags()]

        started = time.perf_counter()
        try:
            result = provider.extract(text, existing_tags)
        except LlmError as error:
            self._record(provider, user_id, started, error.code, None)
            raise AppError(_LLM_STATUS[error.code], error.code, error.detail) from error

        draft = _finish(result.draft, existing_tags)
        if not draft.ingredients and not draft.steps:
            self._record(provider, user_id, started, ErrorCode.NO_RECIPE_FOUND, result)
            raise AppError(
                400, ErrorCode.NO_RECIPE_FOUND, "No recipe found in the text"
            )
        self._record(provider, user_id, started, "ok", result)
        return draft

    def _provider(self) -> LlmProvider:
        try:
            return default_provider(self._settings)
        except ProviderUnavailableError as error:
            logger.error("Import provider unavailable: %s", error)
            raise AppError(
                502, ErrorCode.PROVIDER_UNAVAILABLE, "No import engine is available"
            ) from error

    def _ensure_under_daily_cap(self) -> None:
        """The cap is global and resets at midnight in the app timezone (AD-29)."""
        zone = ZoneInfo(self._settings.app_timezone)
        midnight = datetime.now(zone).replace(hour=0, minute=0, second=0, microsecond=0)
        used = self._repository.count_runs_since(midnight.astimezone(UTC))
        if used >= self._settings.import_daily_cap:
            raise AppError(
                429,
                ErrorCode.IMPORT_CAP_REACHED,
                "The daily import limit was reached",
                {"cap": self._settings.import_daily_cap},
            )

    def _record(
        self,
        provider: LlmProvider,
        user_id: uuid.UUID,
        started: float,
        outcome: str,
        result: LlmResult | None,
    ) -> None:
        """One run row and its one attempt row (AD-38)."""
        latency_ms = round((time.perf_counter() - started) * 1000)
        usage = result.usage if result else Usage()
        run = ImportRun(
            user_id=user_id,
            provider=provider.name,
            model=provider.model,
            source_kind="text",
            path="llm",
            prompt_version=PROMPT_VERSION,
            latency_ms=latency_ms,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            first_try_valid=result.first_try_valid if result else False,
            retried=result.retried if result else False,
            outcome=str(outcome),
        )
        attempt = ImportAttempt(
            run_id=run.id,
            provider=provider.name,
            model=provider.model,
            attempt_no=1,
            outcome=str(outcome),
            latency_ms=latency_ms,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
        )
        self._repository.add_run(run, [attempt])
        self._repository.commit()


def _finish(draft: DraftRecipe, existing_tags: list[str]) -> DraftRecipe:
    """The deterministic part of an import: units, °C, tags, missing fields."""
    tags, new_tags = _split_tags(draft, existing_tags)
    missing = [
        field
        for field in ("base_servings", "prep_time_minutes", "cook_time_minutes")
        if getattr(draft, field) is None
    ]
    return draft.model_copy(
        update={
            "ingredients": [convert_ingredient(item) for item in draft.ingredients],
            "steps": [convert_step(step) for step in draft.steps],
            "tags": tags,
            "new_tags": new_tags,
            "missing_fields": missing,
        }
    )


def _split_tags(
    draft: DraftRecipe, existing_tags: list[str]
) -> tuple[list[str], list[str]]:
    """Tags are existing names (matched ignoring case) or new proposals (FR24)."""
    by_lower = {name.lower(): name for name in existing_tags}
    tags: list[str] = []
    new_tags: list[str] = []
    for raw in [*draft.tags, *draft.new_tags]:
        name = raw.strip()
        if not name or len(name) > _TAG_NAME_MAX_LENGTH:
            continue
        existing = by_lower.get(name.lower())
        if existing is not None:
            if existing not in tags:
                tags.append(existing)
        elif name.lower() not in (item.lower() for item in new_tags):
            new_tags.append(name)
    return tags, new_tags


def get_import_service(
    session: Annotated[Session, Depends(get_session)],
    tag_service: Annotated[TagService, Depends(get_tag_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ImportService:
    """Provider, like a Nest injectable: `Depends(get_import_service)`."""
    return ImportService(ImportRepository(session), tag_service, settings)
