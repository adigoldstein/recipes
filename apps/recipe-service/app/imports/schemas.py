"""Pydantic request and response schemas for imports.

`DraftRecipe` is the one output contract (AD-34): its JSON schema is sent to the
provider, the reply is validated against it, and the same model is the API response.
"""

from pydantic import BaseModel, ConfigDict, Field

from app.core.units import SourceUnit, Unit

# Same limits as a saved recipe, so a draft the form accepts is a draft that can be
# saved. Copied, not imported: imports may not depend on recipes (AD-1).
TITLE_MAX_LENGTH = 120
DESCRIPTION_MAX_LENGTH = 500
NOTES_MAX_LENGTH = 5000
MAX_SERVINGS = 100


class ImportTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The upper bound is the `IMPORT_MAX_CHARS` setting, checked in the service.
    text: str = Field(min_length=1)


class DraftSource(BaseModel):
    """An imperial value found in the source; the code converts it to metric (FR-21)."""

    model_config = ConfigDict(extra="forbid")

    amount: float = Field(gt=0)
    unit: SourceUnit


class DraftIngredient(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    # Null amount and null unit mean "to taste" (AD-31).
    amount: float | None = Field(default=None, gt=0)
    unit: Unit | None = None
    note: str | None = None
    # Set for oz, lb and fl oz: amount and unit are then filled by the code.
    source: DraftSource | None = None


class DraftStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1)
    # The step before a °F to °C rewrite; filled by the code, not the model.
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
    # Names from the existing tag list.
    tags: list[str] = Field(default_factory=list)
    # Tag names that are not in the list yet; created only if the editor accepts them.
    new_tags: list[str] = Field(default_factory=list)
    # Fields the source did not give, for the review step (filled by the code).
    missing_fields: list[str] = Field(default_factory=list)
