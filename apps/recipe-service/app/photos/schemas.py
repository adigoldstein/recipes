"""The request and response shapes (Pydantic) of photos."""

from pydantic import BaseModel, ConfigDict, Field

# A photo key is a random UUID in hex. It is also used as a file name, so we allow
# nothing else.
PHOTO_KEY_PATTERN = r"^[0-9a-f]{32}$"


class PhotoRead(BaseModel):
    """A photo as it appears inside API responses (AD-27). The server builds the
    URLs."""

    url: str
    thumb_url: str
    credit_domain: str | None


class PhotoUploaded(BaseModel):
    """An uploaded photo that no recipe uses yet. Saving a recipe attaches it."""

    photo_key: str


class PhotoLimits(BaseModel):
    """The upload limits, shown by the form next to the photo field."""

    max_bytes: int
    content_types: list[str]


class PhotoFromUrl(BaseModel):
    """A photo to download from a link, for example of an imported recipe
    (AD-23, AD-27)."""

    model_config = ConfigDict(extra="forbid")

    source_url: str = Field(min_length=1, max_length=2048)
