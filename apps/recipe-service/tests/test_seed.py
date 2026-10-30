from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, func, select

from app.cli import main
from app.core.config import get_settings
from app.photos.service import get_photo_service
from app.recipes.models import Recipe
from app.recipes.service import get_recipe_service
from app.seed import SEED_PHOTOS, SEED_RECIPES, SEED_TOTAL, TUNED_RECIPE, run_seed
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
    service = get_recipe_service(session, get_tag_service(session), get_photo_service())

    result = run_seed(service)

    assert (result.created, result.skipped) == (SEED_TOTAL, 0)
    assert len(SEED_RECIPES) == 10
    titles = [item["title"] for item in client.get("/api/recipes").json()]
    assert sorted(titles) == sorted(
        [recipe.title for recipe in SEED_RECIPES] + [TUNED_RECIPE.title]
    )

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
    service = get_recipe_service(session, get_tag_service(session), get_photo_service())
    run_seed(service)
    tags_before = _tags(session)

    again = run_seed(service)

    assert (again.created, again.skipped) == (0, SEED_TOTAL)
    assert session.exec(select(func.count()).select_from(Recipe)).one() == SEED_TOTAL
    assert _tags(session) == tags_before


def test_seed_has_to_taste_and_fractions(client: TestClient, session: Session) -> None:
    run_seed(get_recipe_service(session, get_tag_service(session), get_photo_service()))
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
            if detail["title"] != TUNED_RECIPE.title:
                assert item["original"] is None
    assert to_taste >= 1
    assert Decimal("0.5") in amounts
    assert Decimal("0.333") in amounts


def test_seed_has_one_recipe_with_a_hinted_ingredient(
    client: TestClient, session: Session
) -> None:
    run_seed(get_recipe_service(session, get_tag_service(session), get_photo_service()))
    hinted = []
    for summary in client.get("/api/recipes").json():
        detail = client.get(f"/api/recipes/{summary['id']}").json()
        hinted += [
            (detail["title"], item)
            for item in detail["ingredients"]
            if item["original"] is not None
        ]
    [(title, sugar)] = hinted
    assert title == TUNED_RECIPE.title
    assert sugar["name"] == "סוכר"
    assert (sugar["amount"], sugar["unit"]) == (0.5, "cup")
    assert sugar["original"] == {"amount": 1, "unit": "cup"}


def test_seed_attaches_sample_photos_with_their_credit(
    client: TestClient, session: Session
) -> None:
    photos = get_photo_service()
    service = get_recipe_service(session, get_tag_service(session), photos)
    run_seed(service, photos)

    with_photo = {}
    for summary in client.get("/api/recipes").json():
        detail = client.get(f"/api/recipes/{summary['id']}").json()
        if detail["photo"] is not None:
            with_photo[detail["title"]] = detail["photo"]
            assert summary["photo"] == detail["photo"]
    assert sorted(with_photo) == sorted(SEED_PHOTOS)
    for photo in with_photo.values():
        assert photo["credit_domain"] == "commons.wikimedia.org"
        assert client.get(photo["url"]).status_code == 200
        assert client.get(photo["thumb_url"]).status_code == 200

    # A second run neither duplicates recipes nor stores more files.
    before = len(list((get_settings().data_dir / "media" / "photos").iterdir()))
    run_seed(service, photos)
    after = len(list((get_settings().data_dir / "media" / "photos").iterdir()))
    assert before == after == 2 * len(SEED_PHOTOS)


def test_cli_seed_runs_and_reruns(
    client: TestClient, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["seed"]) == 0
    assert f"{SEED_TOTAL} created, 0 already there" in capsys.readouterr().out
    assert main(["seed"]) == 0
    assert f"0 created, {SEED_TOTAL} already there" in capsys.readouterr().out


def test_cli_rejects_unknown_command() -> None:
    with pytest.raises(SystemExit) as exc:
        main(["explode"])
    assert exc.value.code == 2
