"""Helpers that insert recipes and users straight into the migrated test database."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.core.security import Role, hash_password
from app.recipes.models import Ingredient, Recipe, Step
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
    ingredients: Sequence[Ingredient] = (),
    steps: Sequence[Step] = (),
    created_at: datetime | None = None,
    **fields: Any,
) -> Recipe:
    values: dict[str, Any] = {"title": title, "base_servings": 4, **fields}
    if created_at is not None:
        values["created_at"] = created_at
    recipe = Recipe(**values)
    recipe.ingredients = list(ingredients)
    recipe.steps = list(steps)
    session.add(recipe)
    session.flush()
    for tag in tags:
        session.add(RecipeTag(recipe_id=recipe.id, tag_id=tag.id))
    session.commit()
    session.refresh(recipe)
    return recipe


# Replaced by the relationship when the recipe is flushed.
_UNSET = uuid.UUID(int=0)


def ingredient(position: int, name: str, **fields: Any) -> Ingredient:
    return Ingredient(recipe_id=_UNSET, position=position, name=name, **fields)


def step(position: int, description: str, **fields: Any) -> Step:
    return Step(recipe_id=_UNSET, position=position, description=description, **fields)


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
