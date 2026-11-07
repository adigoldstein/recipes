"""Which `PageFetcher` runs: the fake one goes with the fake provider (AD-23)."""

from app.core.config import Environment, Settings
from app.core.safe_fetch import FetchLimits
from app.imports.fetchers.base import PageFetcher
from app.imports.fetchers.fake import FakePageFetcher
from app.imports.fetchers.http import HttpPageFetcher


class FakeFetcherInProductionError(Exception):
    """The fake fetcher reads local fixture pages and must never run in production."""


def page_fetcher(settings: Settings) -> PageFetcher:
    if settings.llm_providers[:1] == ["fake"]:
        if settings.env is Environment.PRODUCTION:
            raise FakeFetcherInProductionError("the fake fetcher is dev and test only")
        return FakePageFetcher()
    return HttpPageFetcher(
        FetchLimits(
            max_bytes=settings.page_max_bytes,
            timeout_seconds=settings.page_fetch_timeout_seconds,
        )
    )
