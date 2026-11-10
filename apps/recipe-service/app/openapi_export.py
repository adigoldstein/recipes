"""Writes the OpenAPI schema to a file, without starting the server (AD-3, AD-19).

Usage: `uv run python -m app.openapi_export <output-path>`
"""

import json
import os
import sys
from pathlib import Path

# Creating the app checks the settings, so JWT_SECRET must exist. The schema does
# not use it, so any value works.
os.environ.setdefault("JWT_SECRET", "openapi-export")


def export_openapi(output: Path) -> None:
    from app.main import create_app

    schema = create_app().openapi()
    output.parent.mkdir(parents=True, exist_ok=True)
    # Sort the keys, use LF line endings and end with a newline, so the committed
    # file only changes when the schema really changes.
    text = json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False)
    output.write_text(text + "\n", encoding="utf-8", newline="\n")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python -m app.openapi_export <output-path>", file=sys.stderr)
        return 2
    export_openapi(Path(argv[1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
