"""The demo recipes loaded on a start that finds no recipes."""

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, func, select

from app.core.config import get_settings, load_settings
from app.core.db import get_engine
from app.core.errors import AppError
from app.core.security import CSRF_HEADER, CSRF_VALUE
from app.demo_seed import DEMO_FILE, load_demo_data, run_demo_seed
from app.main import create_app
from app.photos.service import get_photo_service
from app.recipes.models import Recipe
from app.recipes.service import get_recipe_service
from app.seed import SEED_TOTAL, run_seed
from app.tags.models import RecipeTag, Tag
from app.tags.schemas import TagInput
from app.tags.service import get_tag_service

DEMO_TOTAL = 14


def _start(monkeypatch: pytest.MonkeyPatch, seed_demo: str | None) -> None:
    """Start the app once (the lifespan migrates and runs the demo hook), then stop."""
    if seed_demo is None:
        monkeypatch.delenv("SEED_DEMO", raising=False)
    else:
        monkeypatch.setenv("SEED_DEMO", seed_demo)
    get_settings.cache_clear()
    with TestClient(create_app(), headers={CSRF_HEADER: CSRF_VALUE}):
        pass


@pytest.fixture
def db() -> Iterator[Session]:
    with Session(get_engine(get_settings().data_dir)) as session:
        yield session


def _count(session: Session) -> int:
    return session.exec(select(func.count()).select_from(Recipe)).one()


def test_demo_file_has_the_recipes_without_photos_or_ids() -> None:
    raw = DEMO_FILE.read_bytes()
    assert b"\r\n" not in raw
    text = raw.decode("utf-8")
    for key in ("photo", '"id"', "created_by", "updated_by"):
        assert key not in text, key
    data = load_demo_data()
    assert len(data.recipes) == DEMO_TOTAL
    assert len({recipe.title for recipe in data.recipes}) == DEMO_TOTAL
    declared = {tag.name for tag in data.tags}
    for recipe in data.recipes:
        assert recipe.photo_key is None
        assert {tag.name for tag in recipe.tags} <= declared, recipe.title
    assert json.loads(text)["version"] == 1


def test_an_empty_db_gets_the_demo_recipes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _start(monkeypatch, None)

    with Session(get_engine(get_settings().data_dir)) as session:
        assert _count(session) == DEMO_TOTAL
        titles = set(session.exec(select(Recipe.title)))
        assert titles == {recipe.title for recipe in load_demo_data().recipes}
        assert all(
            recipe.photo_key is None and recipe.created_by is None
            for recipe in session.exec(select(Recipe))
        )
        # Every tag the demo uses exists, pinned the way the file says.
        tags = {tag.name: tag.pinned for tag in session.exec(select(Tag))}
        for tag in load_demo_data().tags:
            assert tags[tag.name] is tag.pinned, tag.name


def test_a_library_with_recipes_is_never_seeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _start(monkeypatch, "false")
    with Session(get_engine(get_settings().data_dir)) as session:
        tags = get_tag_service(session)
        run_seed(get_recipe_service(session, tags, get_photo_service()))

    _start(monkeypatch, None)

    with Session(get_engine(get_settings().data_dir)) as session:
        assert _count(session) == SEED_TOTAL


def test_switched_off_does_not_seed(monkeypatch: pytest.MonkeyPatch) -> None:
    _start(monkeypatch, "false")

    with Session(get_engine(get_settings().data_dir)) as session:
        assert _count(session) == 0


def test_starting_twice_does_not_duplicate(monkeypatch: pytest.MonkeyPatch) -> None:
    _start(monkeypatch, None)
    with Session(get_engine(get_settings().data_dir)) as session:
        tags_before = session.exec(select(func.count()).select_from(Tag)).one()

    _start(monkeypatch, None)

    with Session(get_engine(get_settings().data_dir)) as session:
        assert _count(session) == DEMO_TOTAL
        assert session.exec(select(func.count()).select_from(Tag)).one() == tags_before
        titles = list(session.exec(select(Recipe.title).order_by(col(Recipe.title))))
        assert len(titles) == len(set(titles))


def test_seed_demo_is_on_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SEED_DEMO", raising=False)
    assert load_settings().seed_demo is True
    monkeypatch.setenv("SEED_DEMO", "false")
    assert load_settings().seed_demo is False


def test_a_failure_mid_load_leaves_nothing_behind(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _start(monkeypatch, "false")
    data = load_demo_data()
    first = data.recipes[0]
    # The first recipe brings a brand-new tag; a later one points at a photo that
    # was never uploaded, so saving it fails after several recipes were staged.
    data.recipes[0] = first.model_copy(
        update={"tags": [*first.tags, TagInput(name="תגית שלא תישאר")]}
    )
    data.recipes[5] = data.recipes[5].model_copy(update={"photo_key": "0" * 32})

    with Session(get_engine(get_settings().data_dir)) as session:
        tags_before = session.exec(select(func.count()).select_from(Tag)).one()
        tags = get_tag_service(session)
        service = get_recipe_service(session, tags, get_photo_service())
        with pytest.raises(AppError):
            run_demo_seed(service, data)

    with Session(get_engine(get_settings().data_dir)) as session:
        assert _count(session) == 0
        assert session.exec(select(func.count()).select_from(Tag)).one() == tags_before
        assert session.exec(select(func.count()).select_from(RecipeTag)).one() == 0
