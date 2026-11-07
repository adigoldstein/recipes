"""The `PageFetcher` port: `imports` fetches recipe pages only through it (AD-35)."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class FetchedPage:
    """The last response of the fetch, whatever its status (a 403 can be a challenge).

    `html` is the raw body; the parser reads its encoding from the page itself.
    """

    url: str
    status: int
    content_type: str
    html: bytes


class PageFetcher(Protocol):
    def fetch(self, url: str) -> FetchedPage:
        """Raise a `FetchError` when the URL is refused or the fetch fails."""
        ...
