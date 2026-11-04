"""Helpers that insert recipes and users straight into the migrated test database."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core.security import Role, hash_password
from app.recipes.models import IngredientItem, Recipe, StepItem
from app.tags.models import RecipeTag, Tag
from app.users.models import User


def seeded_tag(session: Session, name: str) -> Tag:
    return session.exec(select(Tag).where(Tag.name == name)).one()


def add_tag(session: Session, name: str, *, pinned: bool = False) -> Tag:
    tag = Tag(name=name, pinned=pinned)
    session.add(tag)
    session.commit()
    return tag


def add_recipe(
    session: Session,
    *,
    title: str = "שקשוקה",
    tags: Sequence[Tag] = (),
    ingredients: Sequence[IngredientItem] = (),
    steps: Sequence[StepItem] = (),
    created_at: datetime | None = None,
    **fields: Any,
) -> Recipe:
    values: dict[str, Any] = {
        "title": title,
        "base_servings": 4,
        "ingredients": list(ingredients),
        "steps": list(steps),
        **fields,
    }
    if created_at is not None:
        values["created_at"] = created_at
    recipe = Recipe(**values)
    session.add(recipe)
    session.flush()
    for tag in tags:
        session.add(RecipeTag(recipe_id=recipe.id, tag_id=tag.id))
    session.commit()
    session.refresh(recipe)
    return recipe


def ingredient(name: str, **fields: Any) -> IngredientItem:
    """An ingredient item; its place in the list is its order (AD-41)."""
    return IngredientItem(name=name, **fields)


def step(description: str, **fields: Any) -> StepItem:
    return StepItem(description=description, **fields)


def add_user(
    session: Session,
    *,
    email: str = "adi@example.com",
    name: str = "Adi",
    role: Role = Role.EDITOR,
    password: str = "correct horse",
    **fields: Any,
) -> User:
    user = User(
        email=email,
        name=name,
        role=role,
        password_hash=hash_password(password),
        **fields,
    )
    session.add(user)
    session.commit()
    return user
