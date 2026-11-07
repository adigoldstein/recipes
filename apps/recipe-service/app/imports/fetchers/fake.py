"""The deterministic fake `PageFetcher`, for tests and CI, which never use the network.

`fake://<fixture>` answers with `fake_pages/<fixture>.html`. Any other URL is still
checked by the safe-fetch rules (so a private address is refused as in production),
and then fails, because the fake has no network (AD-23).
"""

from pathlib import Path

from app.core.safe_fetch import (
    FetchFailedError,
    FetchTooLargeError,
    Resolver,
    check_url,
    system_resolver,
)
from app.imports.fetchers.base import FetchedPage

FAKE_SCHEME = "fake://"
PAGES_DIR = Path(__file__).parent / "fake_pages"

# Fixtures served with a status other than 200, as the real site would.
_STATUS = {"cloudflare-challenge": 403, "forbidden": 403, "server-error": 500}


class FakePageFetcher:
    def __init__(
        self, pages_dir: Path = PAGES_DIR, resolver: Resolver = system_resolver
    ) -> None:
        self._pages_dir = pages_dir
        self._resolver = resolver

    def fetch(self, url: str) -> FetchedPage:
        if not url.startswith(FAKE_SCHEME):
            check_url(url, self._resolver)
            raise FetchFailedError("the fake fetcher has no network")
        name = url.removeprefix(FAKE_SCHEME).strip("/")
        if name == "too-large":
            raise FetchTooLargeError("the page is too large")
        page = self._pages_dir / f"{name}.html"
        if not name.replace("-", "").isalnum() or not page.is_file():
            raise FetchFailedError(f"no fake page '{name}'")
        return FetchedPage(
            url=url,
            status=_STATUS.get(name, 200),
            content_type="text/html",
            html=page.read_bytes(),
        )
