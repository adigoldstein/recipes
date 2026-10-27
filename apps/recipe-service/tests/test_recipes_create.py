import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlmodel import Session, col, func, select

from app.core.errors import AppError, ErrorCode
from app.recipes.models import Recipe
from app.recipes.schemas import IngredientCreate, RecipeCreate, StepCreate
from app.recipes.service import RecipeService, get_recipe_service
from app.recipes.units import Unit
from app.tags.models import Tag
from app.tags.schemas import TagInput
from app.tags.service import get_tag_service
from tests.factories import add_tag, seeded_tag


def make_service(session: Session) -> RecipeService:
    return get_recipe_service(session, get_tag_service(session))


def new_recipe(**fields: object) -> RecipeCreate:
    values: dict[str, object] = {"title": "פשטידה", "base_servings": 4, **fields}
    return RecipeCreate.model_validate(values)


def test_create_returns_full_recipe_with_positions(
    client: TestClient, session: Session
) -> None:
    created = make_service(session).create_recipe(
        new_recipe(
            ingredients=[
                IngredientCreate(name="קמח", amount=Decimal("0.5"), unit=Unit.CUP),
                IngredientCreate(name="מלח"),
            ],
            steps=[StepCreate(description="א"), StepCreate(description="ב")],
        )
    )
    assert [i.name for i in created.ingredients] == ["קמח", "מלח"]
    assert created.ingredients[0].amount == Decimal("0.5")
    assert created.ingredients[1].amount is None
    assert all(i.original is None for i in created.ingredients)
    assert [s.description for s in created.steps] == ["א", "ב"]


def test_create_resolves_ids_and_names(client: TestClient, session: Session) -> None:
    brunch = seeded_tag(session, "בראנץ'")
    existing = add_tag(session, "Party")
    created = make_service(session).create_recipe(
        new_recipe(
            tags=[
                TagInput(id=brunch.id),
                TagInput(name="  party "),  # reuses "Party", case-insensitive
                TagInput(name="על   האש"),  # new, spaces collapsed
                TagInput(id=brunch.id),  # duplicate collapses
            ]
        )
    )
    assert {t.name for t in created.tags} == {"בראנץ'", "Party", "על האש"}
    assert len(created.tags) == 3
    assert existing.id in {t.id for t in created.tags}
    assert session.exec(select(func.count()).select_from(Tag)).one() == 13 + 2


def test_unknown_tag_id_rolls_back_the_recipe(
    client: TestClient, session: Session
) -> None:
    with pytest.raises(AppError) as exc:
        make_service(session).create_recipe(
            new_recipe(tags=[TagInput(name="חדשה"), TagInput(id=uuid.uuid4())])
        )
    assert exc.value.status_code == 404
    assert exc.value.body.code == ErrorCode.TAG_NOT_FOUND
    assert session.exec(select(func.count()).select_from(Recipe)).one() == 0
    assert session.exec(select(Tag).where(col(Tag.name) == "חדשה")).first() is None


@pytest.mark.parametrize(
    "bad",
    [{}, {"id": uuid.uuid4(), "name": "x"}, {"name": "   "}, {"name": "x" * 41}],
)
def test_tag_input_validation(bad: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        TagInput.model_validate(bad)
