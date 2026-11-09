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
from app.tags.schemas import TagCreate, TagUpdate, normalize_tag_name
from app.tags.service import TagService, get_tag_service

DEMO_FILE = Path(__file__).parent / "seed_data" / "demo_recipes.json"

logger = logging.getLogger(__name__)


class DemoTag(BaseModel):
    name: str
    pinned: bool = False


class DemoData(BaseModel):
    version: int
    tags: list[DemoTag]
    recipes: list[RecipeCreate]


def load_demo_data(path: Path = DEMO_FILE) -> DemoData:
    return DemoData.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _ensure_tags(tags: TagService, wanted: list[DemoTag]) -> None:
    """Create each tag the demo needs that is not there yet, pinned when it was."""
    existing = {tag.name for tag in tags.list_tags()}
    for item in wanted:
        name = normalize_tag_name(item.name)
        if name in existing:
            continue
        created = tags.create_tag(TagCreate(name=name))
        if item.pinned:
            tags.update_tag(created.id, TagUpdate(pinned=True))


def run_demo_seed(
    recipes: RecipeService,
    tags: TagService,
    data: DemoData | None = None,
) -> int:
    """Create the demo recipes, only into a library with no recipes. Returns how many.

    Running it again finds recipes and does nothing, so it never duplicates.
    """
    if recipes.list_recipes():
        return 0
    data = data or load_demo_data()
    _ensure_tags(tags, data.tags)
    for recipe in data.recipes:
        recipes.create_recipe(recipe)
    return len(data.recipes)


def seed_demo_on_first_start(session: Session, *, enabled: bool) -> int:
    """The startup hook: seed an empty library. Tests and e2e switch it off."""
    if not enabled:
        return 0
    tags = get_tag_service(session)
    service = get_recipe_service(session, tags, get_photo_service())
    created = run_demo_seed(service, tags)
    if created:
        logger.info("Demo seed: created %d recipes on first start.", created)
    return created
