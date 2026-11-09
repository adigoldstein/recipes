"""The business logic of imports. Other modules call this layer, not the repository."""

import asyncio
import contextlib
import functools
import logging
import math
import time
import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.core.safe_fetch import FETCH_HTTP_STATUS, FetchError
from app.imports.conversion import convert_ingredient, convert_step
from app.imports.fetchers.base import PageFetcher
from app.imports.fetchers.registry import FakeFetcherInProductionError, page_fetcher
from app.imports.models import ImportAttempt, ImportRun
from app.imports.page import ImportPath, ParsedPage, read_page
from app.imports.prompt import PROMPT_VERSION
from app.imports.providers.base import LlmError, LlmProvider, LlmResult, Usage
from app.imports.providers.registry import ProviderUnavailableError, default_provider
from app.imports.repository import ImportRepository
from app.imports.schemas import (
    DraftRecipe,
    ErrorEvent,
    ImportEvent,
    ProviderInfo,
    StageEvent,
    StageName,
    StageStatus,
)
from app.tags.service import TagService, get_tag_service

logger = logging.getLogger(__name__)

# The maximum tag name length (defined by the tags module).
_TAG_NAME_MAX_LENGTH = 40

# The HTTP status for each error (a provider failure is 502, a timeout is 504).
_LLM_STATUS = {
    ErrorCode.LLM_TIMEOUT: 504,
    ErrorCode.LLM_UNAVAILABLE: 502,
    ErrorCode.LLM_QUOTA: 502,
    ErrorCode.LLM_INVALID_OUTPUT: 502,
}


# How often, in seconds, a waiting stream checks that the client is still connected.
_POLL_SECONDS = 0.25
# The outcome saved when the client cancelled (the column is free text).
CANCELLED = "cancelled"


@dataclass(frozen=True)
class ImportJob:
    """An import that passed the first checks (the ones that can still return a
    regular HTTP error)."""

    provider: LlmProvider
    user_id: uuid.UUID
    source_kind: str
    text: str | None = None
    url: str | None = None
    fetcher: PageFetcher | None = None


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

    def providers(self) -> list[ProviderInfo]:
        """Returns the active engine and its timeout, so the client can set its own
        (AD-43)."""
        provider = self._provider()
        return [
            ProviderInfo(
                name=provider.name, timeout_s=math.ceil(provider.timeout_seconds)
            )
        ]

    def prepare_text(self, text: str, user_id: uuid.UUID) -> ImportJob:
        """Runs the checks for a text import before the stream starts, while we can
        still return a regular HTTP error."""
        if len(text) > self._settings.import_max_chars:
            raise AppError(
                413,
                ErrorCode.IMPORT_TEXT_TOO_LONG,
                "The text is too long",
                {"max": self._settings.import_max_chars},
            )
        self._ensure_under_daily_cap()
        return ImportJob(self._provider(), user_id, "text", text=text)

    def prepare_url(self, url: str, user_id: uuid.UUID) -> ImportJob:
        """Runs the checks for a URL import before the stream starts. Downloading the
        page is a step inside the stream (AD-40)."""
        self._ensure_under_daily_cap()
        return ImportJob(
            self._provider(), user_id, "url", url=url, fetcher=self._fetcher()
        )

    async def stream(
        self, job: ImportJob, is_disconnected: Callable[[], Awaitable[bool]]
    ) -> AsyncGenerator[ImportEvent]:
        """Runs the import and sends its events: `stage` events, then `draft` or
        `error` (AD-40)."""
        queue: asyncio.Queue[ImportEvent | None] = asyncio.Queue()
        # The work runs in a separate task and puts events in the queue.
        task = asyncio.create_task(self._produce(job, queue))
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), _POLL_SECONDS)
                except TimeoutError:
                    if await is_disconnected():
                        return
                    continue
                if event is None:
                    return
                yield event
        finally:
            # If the client left (or this generator was cancelled), cancel the task.
            # That stops the call to the AI engine, and the import is saved as
            # `cancelled` with nothing else written (AD-22).
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def _produce(
        self, job: ImportJob, queue: asyncio.Queue[ImportEvent | None]
    ) -> None:
        try:
            await self._pipeline(job, queue.put_nowait)
        except AppError as error:
            body = error.body
            failure = ErrorEvent(code=body.code, detail=body.detail, params=body.params)
            queue.put_nowait(("error", failure))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Import failed unexpectedly")
            failure = ErrorEvent(code="internal_error", detail="Import failed")
            queue.put_nowait(("error", failure))
        finally:
            queue.put_nowait(None)

    async def _pipeline(
        self, job: ImportJob, emit: Callable[[ImportEvent], None]
    ) -> None:
        def stage(name: StageName, status: StageStatus) -> None:
            emit(("stage", StageEvent(name=name, status=status)))

        path: ImportPath = "llm"
        photo_url: str | None = None
        if job.fetcher is not None and job.url is not None:
            stage("fetch", "started")
            try:
                # Downloading and parsing are blocking code, so run them in a thread
                # and not on the event loop.
                page = await asyncio.to_thread(self._fetch_page, job.fetcher, job.url)
            except FetchError as error:
                logger.info(
                    "URL import fetch refused: %s (%s)", error.code, error.detail
                )
                raise AppError(
                    FETCH_HTTP_STATUS[error.code], error.code, error.detail
                ) from error
            if not page.text.strip():
                raise AppError(
                    400, ErrorCode.NO_RECIPE_FOUND, "No recipe found on the page"
                )
            # A long page is cut, not rejected, because the recipe is usually near
            # the top.
            text = page.text[: self._settings.import_max_chars]
            path, photo_url = page.path, page.photo_url
            stage("fetch", "done")
        else:
            text = job.text or ""
            stage("fetch", "skipped")

        provider = job.provider
        existing_tags = [tag.name for tag in self._tag_service.list_tags()]
        record = functools.partial(
            self._record, provider, job.user_id, source_kind=job.source_kind, path=path
        )

        stage("extract", "started")
        started = time.perf_counter()
        try:
            result = await provider.extract(text, existing_tags)
        except LlmError as error:
            record(started, error.code, None, upstream_status=error.upstream_status)
            raise AppError(_LLM_STATUS[error.code], error.code, error.detail) from error
        except asyncio.CancelledError:
            record(started, CANCELLED, None)
            raise
        stage("extract", "done")
        # The AI translates in the same call. The draft says whether it translated.
        stage("translate", "done" if result.draft.translated else "skipped")

        stage("validate", "started")
        draft = _validate(result.draft, existing_tags)
        if not draft.ingredients and not draft.steps:
            record(started, ErrorCode.NO_RECIPE_FOUND, result)
            raise AppError(
                400, ErrorCode.NO_RECIPE_FOUND, "No recipe found in the text"
            )
        stage("validate", "done")

        stage("convert_units", "started")
        draft = _convert(draft)
        if job.url is not None:
            draft = draft.model_copy(
                update={"source_url": job.url, "photo_source_url": photo_url}
            )
        stage("convert_units", "done")
        record(started, "ok", result)
        emit(("draft", draft))

    @staticmethod
    def _fetch_page(fetcher: PageFetcher, url: str) -> ParsedPage:
        return read_page(fetcher.fetch(url))

    def _fetcher(self) -> PageFetcher:
        try:
            return page_fetcher(self._settings)
        except FakeFetcherInProductionError as error:
            logger.error("Page fetcher unavailable: %s", error)
            raise AppError(
                400, ErrorCode.PROVIDER_UNAVAILABLE, "No import engine is available"
            ) from error

    def _provider(self) -> LlmProvider:
        try:
            return default_provider(self._settings)
        except ProviderUnavailableError as error:
            logger.error("Import provider unavailable: %s", error)
            raise AppError(
                400, ErrorCode.PROVIDER_UNAVAILABLE, "No import engine is available"
            ) from error

    def _ensure_under_daily_cap(self) -> None:
        """Checks the daily import limit. The limit is for all users together, and
        it resets at midnight in the app's timezone (AD-29)."""
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
        upstream_status: int | None = None,
        *,
        source_kind: str,
        path: ImportPath,
    ) -> None:
        """Saves one run row and its attempt row (AD-38)."""
        latency_ms = round((time.perf_counter() - started) * 1000)
        usage = result.usage if result else Usage()
        run = ImportRun(
            user_id=user_id,
            provider=provider.name,
            model=provider.model,
            source_kind=source_kind,
            path=path,
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
            upstream_status=upstream_status,
        )
        self._repository.add_run(run, [attempt])
        self._repository.commit()


def _validate(draft: DraftRecipe, existing_tags: list[str]) -> DraftRecipe:
    """Matches the tags to the existing list, and lists the fields the source did
    not have."""
    tags, new_tags = _split_tags(draft, existing_tags)
    missing = [
        field
        for field in ("base_servings", "prep_time_minutes", "cook_time_minutes")
        if getattr(draft, field) is None
    ]
    return draft.model_copy(
        update={
            "tags": tags,
            "new_tags": new_tags,
            "missing_fields": missing,
            # Only the code fills these, whatever the AI returned.
            "source_url": None,
            "photo_source_url": None,
        }
    )


def _convert(draft: DraftRecipe) -> DraftRecipe:
    """Converts the units and temperatures to metric, in code."""
    return draft.model_copy(
        update={
            "ingredients": [convert_ingredient(item) for item in draft.ingredients],
            "steps": [convert_step(step) for step in draft.steps],
        }
    )


def _split_tags(
    draft: DraftRecipe, existing_tags: list[str]
) -> tuple[list[str], list[str]]:
    """Splits the AI's tags into existing tags (matched ignoring upper and lower
    case) and new suggested tags (FR24)."""
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
    """Creates the import service for a route, like a Nest provider:
    `Depends(get_import_service)`."""
    return ImportService(ImportRepository(session), tag_service, settings)
