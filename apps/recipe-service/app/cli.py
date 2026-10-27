"""Command line entry point: `python -m app.cli seed` (AD-24)."""

import argparse
import sys
from collections.abc import Sequence

from sqlmodel import Session

from app.core.config import get_settings
from app.core.db import get_engine
from app.core.migrate import run_migrations
from app.recipes.service import get_recipe_service
from app.seed import run_seed
from app.tags.service import get_tag_service


def _seed() -> int:
    data_dir = get_settings().data_dir
    run_migrations(data_dir)
    with Session(get_engine(data_dir)) as session:
        service = get_recipe_service(session, get_tag_service(session))
        result = run_seed(service)
    print(f"Seed done: {result.created} created, {result.skipped} already there.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed", help="Fill the database with demo recipes")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "seed":
        return _seed()
    raise AssertionError(args.command)  # pragma: no cover


if __name__ == "__main__":
    sys.exit(main())
