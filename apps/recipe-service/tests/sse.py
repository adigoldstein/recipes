"""Helpers for reading the import progress stream (AD-40) in tests."""

import json
from typing import Any

import httpx


def parse_events(body: str) -> list[tuple[str, dict[str, Any]]]:
    """Splits the stream into (event name, data) pairs, in order."""
    events: list[tuple[str, dict[str, Any]]] = []
    for block in body.split("\n\n"):
        if not block.strip():
            continue
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


class ImportResult:
    """The result of an import call: a regular HTTP error or a finished stream.

    `status_code` is the HTTP status (always 200 once the stream started). `json()`
    returns the error body, or the data of the last event (the draft or the error).
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
