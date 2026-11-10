"""The real `PageFetcher`: downloads with httpx under the AD-23 safe-fetch rules
(AD-35)."""

import httpx

from app.core.safe_fetch import FetchLimits, Resolver, safe_get, system_resolver
from app.imports.fetchers.base import FetchedPage

_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"


class HttpPageFetcher:
    def __init__(
        self,
        limits: FetchLimits,
        resolver: Resolver = system_resolver,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._limits = limits
        self._resolver = resolver
        self._transport = transport

    def fetch(self, url: str) -> FetchedPage:
        response = safe_get(
            url,
            self._limits,
            accept=_ACCEPT,
            resolver=self._resolver,
            transport=self._transport,
        )
        return FetchedPage(
            url=response.url,
            status=response.status,
            content_type=response.content_type,
            html=response.body,
        )
