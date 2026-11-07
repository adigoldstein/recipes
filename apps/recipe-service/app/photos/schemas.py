"""Pydantic request and response schemas for photos."""

from pydantic import BaseModel, ConfigDict, Field

# A photo key is a random UUID in hex and also a file name, so nothing else goes.
PHOTO_KEY_PATTERN = r"^[0-9a-f]{32}$"


class PhotoRead(BaseModel):
    """The photo shape that read schemas embed (AD-27); URLs are built server-side."""

    url: str
    thumb_url: str
    credit_domain: str | None


class PhotoUploaded(BaseModel):
    """An uploaded photo that no recipe holds yet; a recipe save attaches it."""

    photo_key: str


class PhotoLimits(BaseModel):
    """What an upload may be, for the form to show beside the field."""

    max_bytes: int
    content_types: list[str]


class PhotoFromUrl(BaseModel):
    """A photo to download from a page, such as an imported recipe's (AD-23, AD-27)."""

    model_config = ConfigDict(extra="forbid")

    source_url: str = Field(min_length=1, max_length=2048)
