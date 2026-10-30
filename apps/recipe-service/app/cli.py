"""Command line entry point: `python -m app.cli seed|create-admin` (AD-24, AD-30)."""

import argparse
import sys
from collections.abc import Sequence
from getpass import getpass

from pydantic import ValidationError
from sqlmodel import Session

from app.core.config import get_settings
from app.core.db import get_engine
from app.core.errors import AppError
from app.core.migrate import run_migrations
from app.core.security import Role
from app.photos.service import get_photo_service
from app.recipes.service import get_recipe_service
from app.seed import run_seed
from app.tags.service import get_tag_service
from app.users.schemas import UserCreate
from app.users.service import get_user_service


def _seed() -> int:
    data_dir = get_settings().data_dir
    run_migrations(data_dir)
    with Session(get_engine(data_dir)) as session:
        photos = get_photo_service()
        service = get_recipe_service(session, get_tag_service(session), photos)
        result = run_seed(service, photos)
    print(f"Seed done: {result.created} created, {result.skipped} already there.")
    return 0


def _fail(message: str) -> int:
    print(f"Error: {message}", file=sys.stderr)
    return 1


def _ask_password() -> str | None:
    """Read the password twice without echo. It never touches argv, env or output."""
    password = getpass("Password: ")
    if getpass("Repeat password: ") != password:
        return None
    return password


def _create_admin(email: str, name: str | None, *, reset_password: bool) -> int:
    new_user: UserCreate | None = None
    if not reset_password:
        if name is None:
            return _fail("--name is required to create an admin")
        try:
            new_user = UserCreate(email=email, name=name, role=Role.ADMIN)
        except ValidationError as error:
            # Messages only: the raw input is never echoed back.
            problems = "; ".join(
                f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
                for item in error.errors(include_input=False, include_url=False)
            )
            return _fail(problems)

    try:
        password = _ask_password()
    except (EOFError, KeyboardInterrupt):
        return _fail("cancelled")
    if password is None:
        return _fail("the passwords do not match")

    data_dir = get_settings().data_dir
    run_migrations(data_dir)
    try:
        with Session(get_engine(data_dir)) as session:
            service = get_user_service(session)
            if new_user is None:
                user = service.reset_password(email, password)
                print(f"Password changed for {user.email}.")
            else:
                user = service.create_user(new_user, password)
                print(f"Admin {user.email} created.")
    except AppError as error:
        return _fail(error.body.detail)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed", help="Fill the database with demo recipes")
    create_admin = commands.add_parser(
        "create-admin",
        help="Create the admin account (asks for the password twice)",
    )
    create_admin.add_argument("--email", required=True)
    create_admin.add_argument(
        "--name", help="Display name (required unless --reset-password)"
    )
    create_admin.add_argument(
        "--reset-password",
        action="store_true",
        help="The user already exists: change only their password",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "seed":
        return _seed()
    if args.command == "create-admin":
        return _create_admin(args.email, args.name, reset_password=args.reset_password)
    raise AssertionError(args.command)  # pragma: no cover


if __name__ == "__main__":
    sys.exit(main())
