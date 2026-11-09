"""`app/core/safe_fetch.py`: SSRF rules, redirects and limits (AD-13, AD-23)."""

from collections.abc import Callable, Sequence

import httpx
import pytest

from app.core.safe_fetch import (
    FetchBlockedError,
    FetchedResponse,
    FetchFailedError,
    FetchLimits,
    FetchTooLargeError,
    check_url,
    safe_get,
)

LIMITS = FetchLimits(max_bytes=1000, timeout_seconds=5)

# A fake DNS: public host names, and one name that points to a private address.
DNS = {
    "example.com": ["93.184.216.34"],
    "cdn.example.com": ["151.101.1.1"],
    "internal.example.com": ["10.0.0.5"],
    "mixed.example.com": ["93.184.216.34", "192.168.1.1"],
    "v6.example.com": ["2606:2800:220:1:248:1893:25c8:1946"],
}


def resolver(host: str, _port: int) -> Sequence[str]:
    if host not in DNS:
        raise FetchFailedError(f"cannot resolve {host}")
    return DNS[host]


Handler = Callable[[httpx.Request], httpx.Response]


def fetch(url: str, handler: Handler, limits: FetchLimits = LIMITS) -> FetchedResponse:
    return safe_get(
        url, limits, resolver=resolver, transport=httpx.MockTransport(handler)
    )


def page(body: bytes = b"<html>ok</html>", **headers: str) -> Handler:
    def handle(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=body, headers={"content-type": "text/html", **headers}
        )

    return handle


# --- Addresses ---------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/",
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://192.168.1.10:8080/",
        "http://169.254.169.254/latest/meta-data/",
        "http://0.0.0.0/",
        "http://[::ffff:127.0.0.1]/",
        "http://[fd00::1]/",
        "http://internal.example.com/",
        "http://mixed.example.com/",
    ],
)
def test_private_and_local_addresses_are_blocked(url: str) -> None:
    def local(host: str, port: int) -> Sequence[str]:
        return ["127.0.0.1"] if host == "localhost" else resolver(host, port)

    with pytest.raises(FetchBlockedError):
        check_url(url, local)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/",
        "gopher://example.com/",
        "javascript:alert(1)",
        "http://user:pass@example.com/",
        "not a url",
        "http://example.com:99999/",
    ],
)
def test_only_plain_http_and_https_are_allowed(url: str) -> None:
    with pytest.raises(FetchBlockedError):
        check_url(url, resolver)


def test_an_unknown_host_fails() -> None:
    with pytest.raises(FetchFailedError):
        check_url("https://nowhere.invalid/", resolver)


def test_the_connection_goes_to_the_checked_address() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=b"hi", headers={"content-type": "text/html"})

    result = fetch("https://example.com/recipe?id=1", handle)
    assert seen[0].url.host == "93.184.216.34"
    assert seen[0].url.path == "/recipe"
    assert seen[0].headers["host"] == "example.com"
    assert seen[0].extensions["sni_hostname"] == "example.com"
    assert result == FetchedResponse(
        url="https://example.com/recipe?id=1",
        status=200,
        content_type="text/html",
        body=b"hi",
    )


def test_ipv6_addresses_are_bracketed() -> None:
    target = check_url("https://v6.example.com:8443/a", resolver)
    assert target.pinned_url == "https://[2606:2800:220:1:248:1893:25c8:1946]:8443/a"


# --- Redirects -----------------------------------------------------------------


def test_a_redirect_to_a_private_address_is_blocked() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://127.0.0.1/admin"})

    with pytest.raises(FetchBlockedError):
        fetch("https://example.com/", handle)


def test_a_redirect_to_a_name_with_a_private_address_is_blocked() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(301, headers={"location": "http://internal.example.com/"})

    with pytest.raises(FetchBlockedError):
        fetch("https://example.com/", handle)


def test_public_redirects_are_followed_and_the_final_url_kept() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.headers["host"] == "example.com":
            return httpx.Response(
                302, headers={"location": "https://cdn.example.com/r"}
            )
        return httpx.Response(200, content=b"x", headers={"content-type": "text/html"})

    result = fetch("https://example.com/", handle)
    assert result.url == "https://cdn.example.com/r"


def test_relative_redirects_resolve_against_the_current_url() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "/new"})
        return httpx.Response(200, content=b"x", headers={"content-type": "text/html"})

    assert fetch("https://example.com/old", handle).url == ("https://example.com/new")


def test_a_redirect_loop_fails() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://example.com/again"})

    with pytest.raises(FetchFailedError):
        fetch("https://example.com/", handle)


# --- Caps and failures ----------------------------------------------------------


def test_a_declared_size_over_the_cap_is_refused() -> None:
    with pytest.raises(FetchTooLargeError):
        fetch("https://example.com/", page(b"x", **{"content-length": "5000"}))


def test_a_streamed_body_over_the_cap_is_refused() -> None:
    with pytest.raises(FetchTooLargeError):
        fetch("https://example.com/", page(b"x" * 1001))


def test_a_timeout_fails() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(FetchFailedError):
        fetch("https://example.com/", handle)


def test_a_connection_error_fails() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(FetchFailedError):
        fetch("https://example.com/", handle)


def test_an_error_status_is_returned_for_the_caller_to_judge() -> None:
    def handle(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403, content=b"no", headers={"content-type": "text/html; charset=utf-8"}
        )

    result = fetch("https://example.com/", handle)
    assert result.status == 403
    assert result.content_type == "text/html"
