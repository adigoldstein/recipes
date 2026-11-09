from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from app.core.errors import ErrorResponse
from app.core.security import CurrentUser, require_role
from app.imports.schemas import (
    EVENTS_SCHEMA,
    DraftRecipe,
    ErrorEvent,
    ImportTextRequest,
    ImportUrlRequest,
    ProviderInfo,
    StageEvent,
)
from app.imports.service import ImportJob, ImportService, get_import_service

router = APIRouter(prefix="/imports", tags=["imports"])

ServiceDep = Annotated[ImportService, Depends(get_import_service)]
EditorDep = Annotated[CurrentUser, Depends(require_role("editor"))]


@router.get(
    "/providers",
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
    },
)
def list_providers(service: ServiceDep, user: EditorDep) -> list[ProviderInfo]:
    """Returns the active import engine and its timeout. The client sets its own
    time limit from it."""
    return service.providers()


_STREAM_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {
        "description": (
            "A `text/event-stream` (AD-40): `stage` events `{name, status}`, then one "
            "`draft` event (a DraftRecipe) or one `error` event "
            "`{code, detail, params}`."
        ),
        "content": {"text/event-stream": {"schema": EVENTS_SCHEMA}},
    },
    400: {"model": ErrorResponse},
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    413: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
}


def _sse(event: str, payload: BaseModel) -> str:
    data = payload.model_dump_json()
    return f"event: {event}\ndata: {data}\n\n"


def _stream(
    service: ImportService, job: ImportJob, request: Request
) -> StreamingResponse:
    async def body() -> AsyncIterator[str]:
        async for event, payload in service.stream(job, request.is_disconnected):
            yield _sse(event, payload)

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        # Do not cache, and tell a proxy in front (like nginx) not to hold back the
        # events.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/text", responses=_STREAM_RESPONSES, response_class=StreamingResponse)
def import_text(
    data: ImportTextRequest, service: ServiceDep, user: EditorDep, request: Request
) -> StreamingResponse:
    """Turns pasted recipe text into a Hebrew draft, and streams the progress."""
    return _stream(service, service.prepare_text(data.text, user.id), request)


@router.post("/url", responses=_STREAM_RESPONSES, response_class=StreamingResponse)
def import_url(
    data: ImportUrlRequest, service: ServiceDep, user: EditorDep, request: Request
) -> StreamingResponse:
    """Downloads a recipe page, turns it into a Hebrew draft, and streams the
    progress."""
    return _stream(service, service.prepare_url(data.url, user.id), request)


def publish_stream_events(app: FastAPI) -> None:
    """Adds the import stream's event models to the OpenAPI document (AD-40).

    A streaming response has no `response_model`, so FastAPI does not add them
    by itself.
    """
    original = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            schema = original()
            _, definitions = models_json_schema(
                [
                    (model, "serialization")
                    for model in (DraftRecipe, StageEvent, ErrorEvent)
                ],
                ref_template="#/components/schemas/{model}",
            )
            schemas = schema.setdefault("components", {}).setdefault("schemas", {})
            for name, definition in definitions.get("$defs", {}).items():
                schemas.setdefault(name, definition)
        return app.openapi_schema or {}

    app.openapi = openapi  # type: ignore[method-assign]
