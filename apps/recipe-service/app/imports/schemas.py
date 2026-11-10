"""The request and response shapes (Pydantic) of imports.

`DraftRecipe` is used everywhere for the result (AD-34): its JSON schema is sent to
the AI provider, the AI's answer is validated against it, and the API returns it.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.units import SourceUnit, Unit

# The same limits as a saved recipe, so any draft the form accepts can also be
# saved. They are copied, not imported, because imports may not depend on recipes
# (AD-1).
TITLE_MAX_LENGTH = 120
DESCRIPTION_MAX_LENGTH = 500
NOTES_MAX_LENGTH = 5000
MAX_SERVINGS = 100


class ImportTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The maximum length is the `IMPORT_MAX_CHARS` setting, checked in the service.
    text: str = Field(min_length=1)


class ImportUrlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The service checks it with the safe-fetch rules (http/https, public address).
    url: str = Field(min_length=1, max_length=2048)


class ProviderInfo(BaseModel):
    """An active import engine and how long the server waits for it (AD-43)."""

    name: str
    timeout_s: int


class DraftSource(BaseModel):
    """An imperial value found in the source. The code converts it to metric (FR-21)."""

    model_config = ConfigDict(extra="forbid")

    amount: float = Field(gt=0)
    unit: SourceUnit


class DraftIngredient(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    # If the amount and unit are both null, it means "to taste" (AD-31).
    amount: float | None = Field(default=None, gt=0)
    unit: Unit | None = None
    note: str | None = None
    # Set for oz, lb and fl oz. The code then fills the amount and unit.
    source: DraftSource | None = None


class DraftStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1)
    # The step text before °F was converted to °C. Filled by the code, not the AI.
    source_text: str | None = None


class DraftRecipe(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)
    base_servings: int | None = Field(default=None, ge=1, le=MAX_SERVINGS)
    prep_time_minutes: int | None = Field(default=None, ge=0)
    cook_time_minutes: int | None = Field(default=None, ge=0)
    ingredients: list[DraftIngredient] = Field(default_factory=list)
    steps: list[DraftStep] = Field(default_factory=list)
    # Tag names from the list of existing tags.
    tags: list[str] = Field(default_factory=list)
    # New tag names that are not in the list. They are created only if the editor
    # accepts them.
    new_tags: list[str] = Field(default_factory=list)
    # Fields that the source did not have, shown in the review step. Filled by the
    # code.
    missing_fields: list[str] = Field(default_factory=list)
    # True if the source was not in Hebrew and the AI translated it (FR19).
    translated: bool = False
    # The page the draft came from. Filled by the code for a URL import; null for
    # text.
    source_url: str | None = Field(default=None, max_length=2048)
    # The page's main photo (`Recipe.image`, or `og:image`) for a URL import. The
    # form uploads it when the recipe is saved. Filled by the code; null for text.
    photo_source_url: str | None = Field(default=None, max_length=2048)


# --- The progress stream (AD-40) -------------------------------------------------

StageName = Literal["fetch", "extract", "translate", "validate", "convert_units"]
StageStatus = Literal["started", "done", "skipped"]


class StageEvent(BaseModel):
    """`event: stage`. Reports a real step of the import. There is no percentage."""

    name: StageName
    status: StageStatus


class ErrorEvent(BaseModel):
    """`event: error`. An error after the stream started. `code` is an AD-28 code."""

    code: str
    detail: str
    params: dict[str, str | int] | None = None


# `event: draft` holds a `DraftRecipe`. It is the last event of a successful stream.
# All the possible event data shapes, for the OpenAPI document and so for the
# client's types.
EVENTS_SCHEMA = {
    "oneOf": [
        {"$ref": f"#/components/schemas/{name}"}
        for name in ("StageEvent", "DraftRecipe", "ErrorEvent")
    ]
}
ImportEvent = tuple[Literal["stage", "draft", "error"], BaseModel]
