from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, func, select

from app.cli import main
from app.recipes.models import Recipe
from app.recipes.service import get_recipe_service
from app.seed import SEED_RECIPES, run_seed
from app.tags.models import RecipeTag, Tag
from app.tags.service import get_tag_service
from tests.test_migrations import DEFAULT_PINNED_TAGS

FREE_TAGS = {"על האש", "פינגר פוד", "מסיבות"}


def _tags(session: Session) -> list[tuple[str, str, bool, int | None]]:
    rows = session.exec(select(Tag).order_by(col(Tag.name))).all()
    return [(str(t.id), t.name, t.pinned, t.sort_order) for t in rows]


def test_seed_creates_recipes_through_the_service(
    client: TestClient, session: Session
) -> None:
    defaults_before = [row for row in _tags(session) if row[2]]
    service = get_recipe_service(session, get_tag_service(session))

    result = run_seed(service)

    assert (result.created, result.skipped) == (len(SEED_RECIPES), 0)
    assert len(SEED_RECIPES) == 10
    titles = [item["title"] for item in client.get("/api/recipes").json()]
    assert sorted(titles) == sorted(recipe.title for recipe in SEED_RECIPES)

    # Default tags are untouched; every one is used; free tags were created unpinned.
    assert [row for row in _tags(session) if row[2]] == defaults_before
    used = set(
        session.exec(
            select(Tag.name).join(RecipeTag, col(RecipeTag.tag_id) == col(Tag.id))
        )
    )
    assert {name for _, name in DEFAULT_PINNED_TAGS} <= used
    free = {t.name for t in session.exec(select(Tag).where(col(Tag.pinned).is_(False)))}
    assert free >= FREE_TAGS


def test_seed_is_idempotent(client: TestClient, session: Session) -> None:
    service = get_recipe_service(session, get_tag_service(session))
    run_seed(service)
    tags_before = _tags(session)

    again = run_seed(service)

    assert (again.created, again.skipped) == (0, len(SEED_RECIPES))
    assert session.exec(select(func.count()).select_from(Recipe)).one() == 10
    assert _tags(session) == tags_before


def test_seed_has_to_taste_and_fractions(client: TestClient, session: Session) -> None:
    run_seed(get_recipe_service(session, get_tag_service(session)))
    amounts: list[Decimal] = []
    to_taste = 0
    for summary in client.get("/api/recipes").json():
        detail = client.get(f"/api/recipes/{summary['id']}").json()
        for item in detail["ingredients"]:
            if item["amount"] is None:
                to_taste += 1
                assert item["unit"] is None
            else:
                amounts.append(Decimal(str(item["amount"])))
            assert item["original"] is None
    assert to_taste >= 1
    assert Decimal("0.5") in amounts
    assert Decimal("0.333") in amounts


def test_cli_seed_runs_and_reruns(
    client: TestClient, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["seed"]) == 0
    assert "10 created, 0 already there" in capsys.readouterr().out
    assert main(["seed"]) == 0
    assert "0 created, 10 already there" in capsys.readouterr().out


def test_cli_rejects_unknown_command() -> None:
    with pytest.raises(SystemExit) as exc:
        main(["explode"])
    assert exc.value.code == 2
