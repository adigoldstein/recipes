"""The `PageFetcher` interface. `imports` downloads recipe pages only through it
(AD-35)."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class FetchedPage:
    """The last response of the download, whatever its status (a 403 can be an
    anti-bot check).

    `html` is the raw body. The parser reads the text encoding from the page itself.
    """

    url: str
    status: int
    content_type: str
    html: bytes


class PageFetcher(Protocol):
    def fetch(self, url: str) -> FetchedPage:
        """Downloads the page. Raises a `FetchError` if the URL is not allowed or the
        download fails."""
        ...
