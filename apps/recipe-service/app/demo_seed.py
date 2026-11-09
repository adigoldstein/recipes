"""Demo recipes for a new install, loaded on a start that finds no recipes.

The recipes live in `seed_data/demo_recipes.json` (no photos, no ids, no authors) and
are created through `recipes.service`, so every rule a saved recipe follows applies.
The small `seed` CLI (`app.seed`) is separate: tests and the e2e suite rely on it.
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
    """A tag the demo uses, as it was. A missing one is created by the tag resolver
    (unpinned); the pinned ones are the defaults the migrations already create."""

    name: str
    pinned: bool = False


class DemoData(BaseModel):
    version: int
    tags: list[DemoTag]
    recipes: list[RecipeCreate]


def load_demo_data(path: Path = DEMO_FILE) -> DemoData:
    return DemoData.model_validate(json.loads(path.read_text(encoding="utf-8")))


def run_demo_seed(recipes: RecipeService, data: DemoData | None = None) -> int:
    """Create the demo recipes, only into a library with no recipes. Returns how many.

    All of them, and the tags they need, are saved in one transaction: an error
    leaves nothing behind. Running it again finds recipes and does nothing.
    """
    if recipes.list_recipes():
        return 0
    data = data or load_demo_data()
    return recipes.create_recipes(data.recipes)


def seed_demo_on_first_start(session: Session, *, enabled: bool) -> int:
    """The startup hook: seed an empty library. Tests and e2e switch it off."""
    if not enabled:
        return 0
    tags = get_tag_service(session)
    service = get_recipe_service(session, tags, get_photo_service())
    created = run_demo_seed(service)
    if created:
        logger.info("Demo seed: created %d recipes on first start.", created)
    return created
