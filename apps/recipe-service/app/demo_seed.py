"""Adds demo recipes when the app starts and the library has no recipes.

The recipes are in `seed_data/demo_recipes.json` (no photos, ids or authors). They are
created through `recipes.service`, so they follow the same rules as any saved recipe.
The small `seed` CLI (`app.seed`) is a different thing, used by the tests and e2e.
"""

import json
import logging
from pathlib import Path

from pydantic import BaseModel
from sqlmodel import Session

from app.photos.service import get_photo_service
from app.recipes.schemas import RecipeCreate
from app.recipes.service import RecipeService, get_recipe_service
from app.tags.service import get_tag_service

DEMO_FILE = Path(__file__).parent / "seed_data" / "demo_recipes.json"

logger = logging.getLogger(__name__)


class DemoTag(BaseModel):
    """A tag used by a demo recipe.

    If the tag does not exist yet, it is created as a regular (not pinned) tag. The
    pinned tags already exist, because the migrations create them.
    """

    name: str
    pinned: bool = False


class DemoData(BaseModel):
    version: int
    tags: list[DemoTag]
    recipes: list[RecipeCreate]


def load_demo_data(path: Path = DEMO_FILE) -> DemoData:
    return DemoData.model_validate(json.loads(path.read_text(encoding="utf-8")))


def run_demo_seed(recipes: RecipeService, data: DemoData | None = None) -> int:
    """Adds the demo recipes if the library is empty. Returns how many were added.

    All the recipes and their tags are saved in one transaction, so if something
    fails, nothing is saved. If the library already has recipes, it does nothing.
    """
    if recipes.list_recipes():
        return 0
    data = data or load_demo_data()
    return recipes.create_recipes(data.recipes)


def seed_demo_on_first_start(session: Session, *, enabled: bool) -> int:
    """Runs at app startup and adds the demo recipes to an empty library.

    Tests and e2e turn it off with `enabled=False`.
    """
    if not enabled:
        return 0
    tags = get_tag_service(session)
    service = get_recipe_service(session, tags, get_photo_service())
    created = run_demo_seed(service)
    if created:
        logger.info("Demo seed: created %d recipes on first start.", created)
    return created
