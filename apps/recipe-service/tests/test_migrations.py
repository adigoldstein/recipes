import uuid
import warnings
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import Connection, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core import metadata
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.migrate import MIGRATIONS_DIR, run_migrations
from app.main import create_app
from app.recipes.models import Ingredient, Step
from app.tags.models import RecipeTag, Tag
from tests.factories import add_recipe, add_tag, ingredient, seeded_tag, step

DEFAULT_PINNED_TAGS = [
    ("64e93de0-47ad-4b2a-b757-d0c2405d8126", "בוקר"),
    ("8bbb49dd-fd17-4cc9-81ce-c4ad66596822", "בראנץ'"),
    ("c1276f9e-4f5c-4ec3-939f-cb4ddd7e318c", "צהריים"),
    ("98a5dc19-8766-4b69-aabd-3de927b323db", "ערב"),
    ("1609a770-c38d-4b8d-8f28-a95ed6fa6732", "נשנוש"),
    ("b0dd310e-7b26-40bb-b84f-d7786e66a6c9", "עיקרית"),
    ("8439c327-3a06-420d-a023-3f03be244771", "תוספת"),
    ("21809fb2-0977-4720-a674-62add6612269", "מנה ראשונה/סלט"),
    ("fbcdee8b-29c4-4f71-ac8d-cef61633124e", "מרק"),
    ("f4b05b85-91fe-450c-960b-28248e193e57", "מאפה"),
    ("2f188c64-03a8-4405-b992-8352eae65909", "קינוח"),
    ("836726ed-b2bf-4fde-8238-fd9060622378", "משקה"),
    ("5bf1bf65-6cb5-44bc-88c3-fe3e74b809a7", "רוטב/ממרח"),
]


@pytest.fixture
def connection(client: TestClient) -> Iterator[Connection]:
    with get_engine(get_settings().data_dir).connect() as conn:
        yield conn


def _alembic_config(connection: Connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.attributes["connection"] = connection
    return config


def test_startup_creates_every_table(connection: Connection) -> None:
    assert set(inspect(connection).get_table_names()) == {
        "alembic_version",
        "recipe",
        "ingredient",
        "step",
        "tag",
        "recipe_tag",
    }


def test_recipe_columns(connection: Connection) -> None:
    columns = {c["name"]: c for c in inspect(connection).get_columns("recipe")}
    assert {"description", "notes", "created_by", "updated_by"} <= set(columns)
    for nullable in ("description", "notes", "created_by", "updated_by"):
        assert columns[nullable]["nullable"] is True
    assert columns["created_at"]["nullable"] is False


def test_ingredient_and_step_columns(connection: Connection) -> None:
    inspector = inspect(connection)
    ingredient_columns = {c["name"]: c for c in inspector.get_columns("ingredient")}
    for name in (
        "original_amount",
        "original_unit",
        "source_amount",
        "source_unit",
        "amount",
        "unit",
        "note",
    ):
        assert ingredient_columns[name]["nullable"] is True, name
    assert {c["name"]: c for c in inspector.get_columns("step")}["source_text"][
        "nullable"
    ]


def test_default_pinned_tags_have_fixed_ids_and_order(session: Session) -> None:
    rows = session.exec(select(Tag).order_by(Tag.sort_order)).all()  # type: ignore[arg-type]
    assert [(str(tag.id), tag.name) for tag in rows] == DEFAULT_PINNED_TAGS
    assert [tag.sort_order for tag in rows] == list(range(13))
    assert all(tag.pinned for tag in rows)
    assert all(tag.id.version == 4 for tag in rows)


def test_migrating_again_changes_nothing(session: Session) -> None:
    run_migrations(get_settings().data_dir)
    assert len(session.exec(select(Tag)).all()) == len(DEFAULT_PINNED_TAGS)


def test_children_are_deleted_with_their_recipe(session: Session) -> None:
    party = add_tag(session, "מסיבות")
    recipe = add_recipe(
        session,
        tags=[party],
        ingredients=[ingredient(0, "קמח")],
        steps=[step(0, "לערבב")],
    )
    session.delete(recipe)
    session.commit()
    assert session.exec(select(Ingredient)).all() == []
    assert session.exec(select(Step)).all() == []
    assert session.exec(select(RecipeTag)).all() == []
    assert session.get(Tag, party.id) is not None


def test_deleting_a_tag_detaches_it_from_recipes(session: Session) -> None:
    party = add_tag(session, "מסיבות")
    recipe = add_recipe(session, tags=[party])
    session.delete(party)
    session.commit()
    remaining = session.exec(
        select(RecipeTag).where(RecipeTag.recipe_id == recipe.id)
    ).all()
    assert remaining == []


@pytest.mark.parametrize("first, second", [("מסיבות", "מסיבות"), ("Party", "party")])
def test_tag_names_are_unique_ignoring_case(
    session: Session, first: str, second: str
) -> None:
    session.add(Tag(name=first))
    session.commit()
    session.add(Tag(name=second))
    with pytest.raises(IntegrityError):
        session.commit()


def test_a_seeded_name_cannot_be_added_again(session: Session) -> None:
    session.add(Tag(name="בוקר"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_a_recipe_can_have_no_tags_or_many(session: Session) -> None:
    bare = add_recipe(session)
    tagged = add_recipe(
        session, tags=[seeded_tag(session, "בוקר"), seeded_tag(session, "מאפה")]
    )
    links = session.exec(select(RecipeTag)).all()
    assert [link.recipe_id for link in links if link.recipe_id == bare.id] == []
    assert len([link for link in links if link.recipe_id == tagged.id]) == 2


def test_new_tags_are_not_pinned_by_default(session: Session) -> None:
    assert add_tag(session, "מסיבות").pinned is False
    assert add_tag(session, "חג", pinned=True).pinned is True


def test_unit_check_constraint_rejects_unknown_codes(session: Session) -> None:
    recipe = add_recipe(session)
    with pytest.raises(IntegrityError):
        session.exec(  # type: ignore[call-overload]
            text(
                "INSERT INTO ingredient (id, recipe_id, position, name, unit) "
                "VALUES (:id, :recipe, 0, 'x', 'bogus')"
            ).bindparams(id=uuid.uuid4().hex, recipe=recipe.id.hex)
        )


def test_models_and_migrations_agree(connection: Connection) -> None:
    with warnings.catch_warnings():
        # Alembic cannot reflect SQLite expression indexes, so it skips (and says so).
        warnings.filterwarnings("ignore", message=".*expression-based index.*")
        diff = compare_metadata(
            MigrationContext.configure(connection, opts={"compare_type": True}),
            metadata.metadata,
        )
    assert diff == []


def test_downgrade_removes_everything_and_upgrade_restores_it(
    connection: Connection,
) -> None:
    config = _alembic_config(connection)
    command.downgrade(config, "base")
    assert inspect(connection).get_table_names() == ["alembic_version"]
    command.upgrade(config, "head")
    assert "recipe" in inspect(connection).get_table_names()


def test_a_failed_migration_stops_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    def explode(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("migration failed")

    monkeypatch.setattr("app.core.migrate.command.upgrade", explode)
    with (
        pytest.raises(RuntimeError, match="migration failed"),
        TestClient(create_app()),
    ):
        pass
