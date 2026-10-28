import uuid
import warnings
from collections.abc import Iterator
from typing import Any

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
from app.core.migrate import MIGRATIONS_DIR, migration_transaction, run_migrations
from app.main import create_app
from app.recipes.models import Ingredient, Recipe, Step
from app.tags.models import RecipeTag, Tag
from tests.factories import (
    add_recipe,
    add_tag,
    add_user,
    ingredient,
    seeded_tag,
    step,
)

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
        "user",
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


def test_user_columns(connection: Connection) -> None:
    columns = {c["name"]: c for c in inspect(connection).get_columns("user")}
    assert set(columns) == {
        "id",
        "email",
        "name",
        "role",
        "password_hash",
        "is_blocked",
        "session_version",
        "created_at",
    }
    assert all(not column["nullable"] for column in columns.values())


def test_user_role_is_limited_to_editor_and_admin(connection: Connection) -> None:
    insert = text(
        "INSERT INTO user (id, email, name, role, password_hash, created_at) "
        "VALUES (:id, :email, 'x', :role, 'h', '2026-01-01')"
    )
    for role in ("editor", "admin"):
        connection.execute(
            insert.bindparams(id=uuid.uuid4().hex, email=f"{role}@x.com", role=role)
        )
    with pytest.raises(IntegrityError):
        connection.execute(
            insert.bindparams(id=uuid.uuid4().hex, email="o@x.com", role="owner")
        )


def test_users_are_not_blocked_by_default(connection: Connection) -> None:
    connection.execute(
        text(
            "INSERT INTO user (id, email, name, role, password_hash, created_at) "
            "VALUES ('u1', 'a@x.com', 'x', 'admin', 'h', '2026-01-01')"
        )
    )
    blocked = connection.execute(text("SELECT is_blocked FROM user")).scalar_one()
    assert blocked == 0


def test_recipe_authors_reference_users_and_are_cleared_with_them(
    session: Session,
) -> None:
    author = add_user(session)
    recipe = add_recipe(session, created_by=author.id, updated_by=author.id)
    session.delete(author)
    session.commit()
    session.refresh(recipe)
    assert recipe.created_by is None
    assert recipe.updated_by is None
    assert session.get(Recipe, recipe.id) is not None


@pytest.mark.parametrize("column", ["created_by", "updated_by"])
def test_a_recipe_cannot_name_an_author_that_does_not_exist(
    session: Session, column: str
) -> None:
    with pytest.raises(IntegrityError):
        ghost: dict[str, Any] = {column: uuid.uuid4()}
        add_recipe(session, **ghost)


def test_recipe_author_foreign_keys_are_declared(connection: Connection) -> None:
    keys = {
        key["constrained_columns"][0]: key
        for key in inspect(connection).get_foreign_keys("recipe")
    }
    for column in ("created_by", "updated_by"):
        assert keys[column]["referred_table"] == "user"
        assert keys[column]["options"]["ondelete"] == "SET NULL"


def _insert_recipe_with_children(connection: Connection) -> None:
    recipe_id, tag_id = uuid.uuid4().hex, uuid.UUID(DEFAULT_PINNED_TAGS[0][0]).hex
    connection.execute(
        text(
            "INSERT INTO recipe (id, title, base_servings, created_at, updated_at) "
            "VALUES (:id, 'שקשוקה', 4, '2026-01-01', '2026-01-01')"
        ).bindparams(id=recipe_id)
    )
    connection.execute(
        text(
            "INSERT INTO ingredient (id, recipe_id, position, name) "
            "VALUES (:id, :recipe, 0, 'ביצים')"
        ).bindparams(id=uuid.uuid4().hex, recipe=recipe_id)
    )
    connection.execute(
        text(
            "INSERT INTO step (id, recipe_id, position, description) "
            "VALUES (:id, :recipe, 0, 'לערבב')"
        ).bindparams(id=uuid.uuid4().hex, recipe=recipe_id)
    )
    connection.execute(
        text("INSERT INTO recipe_tag VALUES (:recipe, :tag)").bindparams(
            recipe=recipe_id, tag=tag_id
        )
    )
    connection.commit()


def test_upgrading_keeps_recipes_and_all_their_children(
    connection: Connection,
) -> None:
    """Rebuilding `recipe` for its new foreign keys must not cascade-delete rows."""
    config = _alembic_config(connection)
    command.downgrade(config, "0001")
    connection.commit()
    _insert_recipe_with_children(connection)

    with migration_transaction(connection):
        command.upgrade(config, "head")

    for table in ("recipe", "ingredient", "step", "recipe_tag"):
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
        assert count == 1, table


def test_foreign_keys_are_enforced_again_after_migrating(
    connection: Connection,
) -> None:
    with migration_transaction(connection):
        pass
    assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1


def test_a_migration_that_breaks_a_foreign_key_is_rolled_back(
    connection: Connection,
) -> None:
    with pytest.raises(RuntimeError, match="broken foreign key"):  # noqa: SIM117
        with migration_transaction(connection):
            connection.execute(
                text(
                    "INSERT INTO recipe (id, title, base_servings, created_by, "
                    "created_at, updated_at) "
                    "VALUES (:id, 'x', 1, :ghost, '2026-01-01', '2026-01-01')"
                ).bindparams(id=uuid.uuid4().hex, ghost=uuid.uuid4().hex)
            )
    assert connection.execute(text("SELECT count(*) FROM recipe")).scalar_one() == 0
    assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1


def test_a_failing_migration_still_turns_foreign_keys_back_on(
    connection: Connection,
) -> None:
    with pytest.raises(ValueError, match="boom"), migration_transaction(connection):
        raise ValueError("boom")
    assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1


def test_upgrading_keeps_users_and_starts_them_at_session_version_0(
    connection: Connection,
) -> None:
    config = _alembic_config(connection)
    command.downgrade(config, "0002")
    connection.commit()
    connection.execute(
        text(
            "INSERT INTO user (id, email, name, role, password_hash, created_at) "
            "VALUES ('u1', 'a@x.com', 'Adi', 'admin', 'h', '2026-01-01')"
        )
    )
    connection.commit()

    with migration_transaction(connection):
        command.upgrade(config, "head")

    row = connection.execute(
        text("SELECT email, role, session_version FROM user")
    ).one()
    assert tuple(row) == ("a@x.com", "admin", 0)


def test_the_case_insensitive_email_index_survives_both_directions(
    connection: Connection,
) -> None:
    """Rebuilding `user` through reflection would silently lose this index."""
    config = _alembic_config(connection)
    index = text(
        "SELECT count(*) FROM sqlite_master WHERE name = 'uq_user_lower_email'"
    )
    assert connection.execute(index).scalar_one() == 1

    command.downgrade(config, "0002")
    assert connection.execute(index).scalar_one() == 1
    columns = {c["name"] for c in inspect(connection).get_columns("user")}
    assert "session_version" not in columns

    command.upgrade(config, "head")
    assert connection.execute(index).scalar_one() == 1
