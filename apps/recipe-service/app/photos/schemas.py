"""Pydantic request and response schemas for photos."""

from pydantic import BaseModel


class PhotoRead(BaseModel):
    """The photo shape that read schemas embed (AD-27); URLs are built server-side."""

    url: str
    thumb_url: str
    credit_domain: str | None
