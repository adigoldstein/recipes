"""Reading the import progress stream (AD-40) in tests."""

import json
from typing import Any

import httpx


def parse_events(body: str) -> list[tuple[str, dict[str, Any]]]:
    """`event: x` / `data: {...}` blocks, in order."""
    events: list[tuple[str, dict[str, Any]]] = []
    for block in body.split("\n\n"):
        if not block.strip():
            continue
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


class ImportResult:
    """What an import call returned, whether a plain HTTP error or a finished stream.

    `status_code` is the HTTP status (always 200 once the stream started). `json()`
    is the plain error body, or the last event's data: the draft or the error.
    """

    def __init__(self, response: httpx.Response) -> None:
        self.status_code = response.status_code
        self.headers = response.headers
        self._response = response
        self.events: list[tuple[str, dict[str, Any]]] = (
            parse_events(response.text) if self.status_code == 200 else []
        )

    @property
    def stages(self) -> list[tuple[str, str]]:
        return [
            (data["name"], data["status"])
            for name, data in self.events
            if name == "stage"
        ]

    @property
    def kinds(self) -> list[str]:
        return [name for name, _ in self.events]

    @property
    def failed(self) -> bool:
        return bool(self.events) and self.events[-1][0] == "error"

    def json(self) -> Any:
        if self.status_code != 200:
            return self._response.json()
        return self.events[-1][1]
