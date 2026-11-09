"""Safely downloads a URL that came from a user or from a web page (AD-23).

Every such download on the server goes through this module. The rules (AD-13):
- Only http and https.
- The host must point only to public IP addresses. This is checked again on every
  redirect.
- We connect to the exact address we checked, so a second DNS lookup cannot send us
  somewhere else.
- The page size and the total time are limited.
"""

import ipaddress
import socket
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from app.core.errors import ErrorCode

# A function that takes (host, port) and returns the IP addresses of the host.
Resolver = Callable[[str, int], Sequence[str]]

MAX_REDIRECTS = 5
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}
_USER_AGENT = (
    "BiteAndBoard/1.0 (recipe import; +https://github.com/adigoldstein/recipes)"
)


class FetchError(Exception):
    """A download failed. `code` is the error code the client shows."""

    code: ErrorCode

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


# The HTTP status for each download error: a blocked link is the caller's mistake
# (400), a page that is too large is 413, and a problem with the other site is 502.
FETCH_HTTP_STATUS = {
    ErrorCode.FETCH_BLOCKED: 400,
    ErrorCode.FETCH_CHALLENGED: 502,
    ErrorCode.FETCH_FAILED: 502,
    ErrorCode.FETCH_TOO_LARGE: 413,
}


class FetchBlockedError(FetchError):
    """The URL is not allowed (wrong scheme or private address), or the site
    refused us."""

    code = ErrorCode.FETCH_BLOCKED


class FetchFailedError(FetchError):
    code = ErrorCode.FETCH_FAILED


class FetchTooLargeError(FetchError):
    code = ErrorCode.FETCH_TOO_LARGE


class FetchChallengedError(FetchError):
    """The site answered with an anti-bot check page. We report it and never try to
    get around it (AD-35)."""

    code = ErrorCode.FETCH_CHALLENGED


@dataclass(frozen=True)
class FetchLimits:
    max_bytes: int
    timeout_seconds: float


@dataclass(frozen=True)
class FetchedResponse:
    """The last response after all redirects, whatever its status."""

    url: str
    status: int
    content_type: str
    body: bytes


def system_resolver(host: str, port: int) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError) as error:
        raise FetchFailedError(f"cannot resolve {host}") from error
    return list(dict.fromkeys(str(info[4][0]) for info in infos))


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


@dataclass(frozen=True)
class _Target:
    url: str
    host: str
    # The same URL, with the host name replaced by the IP address we checked.
    pinned_url: str


def check_url(url: str, resolver: Resolver = system_resolver) -> _Target:
    """Allows only http(s) URLs that point to public addresses. Returns where to
    connect."""
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as error:
        raise FetchBlockedError("not a valid URL") from error
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise FetchBlockedError("only http and https links can be imported")
    if parts.username or parts.password:
        raise FetchBlockedError("links with a user name are not allowed")
    host = parts.hostname
    port = port or (443 if parts.scheme == "https" else 80)
    try:
        addresses = [str(ipaddress.ip_address(host))]
    except ValueError:
        addresses = list(resolver(host, port))
    if not addresses:
        raise FetchFailedError(f"cannot resolve {host}")
    if not all(_is_public(address) for address in addresses):
        raise FetchBlockedError("the link points to a private address")
    address = addresses[0]
    pinned_host = f"[{address}]" if ":" in address else address
    netloc = f"{pinned_host}:{parts.port}" if parts.port else pinned_host
    pinned = urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))
    return _Target(url=url, host=host, pinned_url=pinned)


def safe_get(
    url: str,
    limits: FetchLimits,
    *,
    accept: str = "*/*",
    resolver: Resolver = system_resolver,
    transport: httpx.BaseTransport | None = None,
) -> FetchedResponse:
    """Downloads a URL under the AD-23 rules, following at most `MAX_REDIRECTS`
    redirects."""
    deadline = time.monotonic() + limits.timeout_seconds
    current = url
    with httpx.Client(
        transport=transport,
        timeout=limits.timeout_seconds,
        follow_redirects=False,
        trust_env=False,
    ) as client:
        for _hop in range(MAX_REDIRECTS + 1):
            target = check_url(current, resolver)
            response = _get_once(client, target, limits, accept, deadline)
            location = response.headers.get("location")
            if response.status not in _REDIRECT_STATUSES or not location:
                return response.result
            current = urljoin(current, location)
    raise FetchFailedError("too many redirects")


@dataclass(frozen=True)
class _Hop:
    result: FetchedResponse
    headers: httpx.Headers

    @property
    def status(self) -> int:
        return self.result.status


def _get_once(
    client: httpx.Client,
    target: _Target,
    limits: FetchLimits,
    accept: str,
    deadline: float,
) -> _Hop:
    headers = {"Host": _host_header(target.url), "User-Agent": _USER_AGENT}
    headers["Accept"] = accept
    try:
        with client.stream(
            "GET",
            target.pinned_url,
            headers=headers,
            extensions={"sni_hostname": target.host},
        ) as response:
            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > limits.max_bytes:
                raise FetchTooLargeError("the page is too large")
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > limits.max_bytes:
                    raise FetchTooLargeError("the page is too large")
                if time.monotonic() > deadline:
                    raise FetchFailedError("the site took too long to answer")
            content_type = response.headers.get("content-type", "")
            result = FetchedResponse(
                url=target.url,
                status=response.status_code,
                content_type=content_type.split(";", 1)[0].strip().lower(),
                body=bytes(body),
            )
            return _Hop(result=result, headers=response.headers)
    except httpx.TimeoutException as error:
        raise FetchFailedError("the site took too long to answer") from error
    except httpx.HTTPError as error:
        raise FetchFailedError("the site could not be reached") from error


def _host_header(url: str) -> str:
    parts = urlsplit(url)
    host = parts.hostname or ""
    if ":" in host:
        host = f"[{host}]"
    return f"{host}:{parts.port}" if parts.port else host
