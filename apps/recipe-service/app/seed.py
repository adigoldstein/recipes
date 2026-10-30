"""Demo recipes (FR-12), created through `recipes.service` and idempotent by title.

The default pinned tags come from the migrations: the seed refers to them by name and
never creates them. Free tags are created on first use by the tag resolver (AD-25).
Amounts are exact decimals: ½ is 0.5 and ⅓ is 0.333 (AD-31).
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from app.photos.service import PhotoService
from app.recipes.schemas import (
    IngredientCreate,
    IngredientUpdate,
    RecipeCreate,
    RecipeUpdate,
    StepCreate,
)
from app.recipes.service import RecipeService
from app.recipes.units import Unit
from app.tags.schemas import TagInput

HALF = Decimal("0.5")  # ½
THIRD = Decimal(1) / 3  # ⅓, stored as 0.333


def _recipe(
    title: str,
    *,
    tags: tuple[str, ...],
    servings: int,
    prep: int | None,
    cook: int | None,
    description: str,
    ingredients: tuple[tuple[str, Decimal | int | None, Unit | None], ...],
    steps: tuple[str, ...],
    notes: str | None = None,
) -> RecipeCreate:
    return RecipeCreate(
        title=title,
        description=description,
        notes=notes,
        base_servings=servings,
        prep_time_minutes=prep,
        cook_time_minutes=cook,
        tags=[TagInput(name=name) for name in tags],
        ingredients=[
            IngredientCreate(
                name=name,
                amount=None if amount is None else Decimal(amount),
                unit=unit,
            )
            for name, amount, unit in ingredients
        ],
        steps=[StepCreate(description=text) for text in steps],
    )


SEED_RECIPES: tuple[RecipeCreate, ...] = (
    _recipe(
        "שקשוקה",
        tags=("בוקר", "בראנץ'", "עיקרית"),
        servings=4,
        prep=10,
        cook=25,
        description="ביצים בעגבניות חריפות, כמו בבית.",
        ingredients=(
            ("שמן זית", 3, Unit.TBSP),
            ("בצל", 1, Unit.UNIT),
            ("שום", 3, Unit.CLOVE),
            ("עגבניות מרוסקות", 1, Unit.CAN),
            ("פפריקה", 1, Unit.TSP),
            ("ביצים", 5, Unit.UNIT),
            ("מלח", None, None),
        ),
        steps=(
            "מטגנים בצל ושום בשמן זית עד שהבצל שקוף.",
            "מוסיפים עגבניות ופפריקה ומבשלים 10 דקות.",
            "יוצרים גומחות, שוברים לתוכן ביצים ומכסים עד שהחלבון מתייצב.",
        ),
    ),
    _recipe(
        "סלט ירקות קצוץ",
        tags=("מנה ראשונה/סלט", "תוספת", "צהריים"),
        servings=4,
        prep=15,
        cook=None,
        description="סלט ישראלי טרי וקצוץ דק.",
        ingredients=(
            ("מלפפונים", 3, Unit.UNIT),
            ("עגבניות", 3, Unit.UNIT),
            ("מיץ לימון", HALF, Unit.CUP),
            ("שמן זית", 3, Unit.TBSP),
            ("מלח", None, None),
        ),
        steps=("קוצצים את הירקות לקוביות קטנות.", "מתבלים ומערבבים מיד לפני ההגשה."),
    ),
    _recipe(
        "מרק עדשים כתומות",
        tags=("מרק", "ערב", "צהריים"),
        servings=6,
        prep=10,
        cook=30,
        description="מרק חם ומחמם, מוכן בחצי שעה.",
        ingredients=(
            ("עדשים כתומות", 2, Unit.CUP),
            ("גזר", 2, Unit.UNIT),
            ("בצל", 1, Unit.UNIT),
            ("כמון", 1, Unit.TSP),
            ("מים", 2, Unit.L),
            ("מלח", None, None),
        ),
        steps=(
            "מטגנים בצל וגזר, מוסיפים כמון ועדשים.",
            "מוסיפים מים ומבשלים 25 דקות.",
            "טוחנים בבלנדר ומתבלים.",
        ),
    ),
    _recipe(
        "חזה עוף על האש",
        tags=("עיקרית", "ערב", "על האש"),
        servings=4,
        prep=20,
        cook=15,
        description="חזה עוף עסיסי מהמנגל.",
        ingredients=(
            ("חזה עוף", 800, Unit.G),
            ("שמן זית", 2, Unit.TBSP),
            ("שום", 2, Unit.CLOVE),
            ("פפריקה מעושנת", 1, Unit.TSP),
            ("מלח ופלפל", None, None),
        ),
        steps=(
            "מתבלים את העוף ומשרים לפחות שעה.",
            "צולים על גחלים חמות 6 דקות מכל צד.",
            "מנוחה של 5 דקות לפני החיתוך.",
        ),
        notes="אפשר להשרות בלילה במקרר.",
    ),
    _recipe(
        "לחמניות חמאה",
        tags=("מאפה", "בוקר"),
        servings=12,
        prep=30,
        cook=20,
        description="לחמניות רכות וריחניות.",
        ingredients=(
            ("קמח", 500, Unit.G),
            ("חלב פושר", 250, Unit.ML),
            ("חמאה מומסת", 80, Unit.G),
            ("שמרים יבשים", 2, Unit.TSP),
            ("סוכר", 1, Unit.TBSP),
            ("מלח", 1, Unit.TSP),
        ),
        steps=(
            "לשים את כל החומרים עד לקבלת בצק חלק.",
            "מתפיחים שעה, מחלקים ל-12 כדורים ומתפיחים שוב.",
            "אופים ב-190 מעלות כ-20 דקות.",
        ),
    ),
    _recipe(
        "עוגת שוקולד",
        tags=("קינוח", "מסיבות"),
        servings=10,
        prep=20,
        cook=40,
        description="עוגה עשירה לימי הולדת וחגים.",
        ingredients=(
            ("שוקולד מריר", 200, Unit.G),
            ("חמאה", 150, Unit.G),
            ("סוכר", THIRD, Unit.CUP),
            ("ביצים", 4, Unit.UNIT),
            ("קמח", HALF, Unit.CUP),
            ("קקאו", 2, Unit.TBSP),
        ),
        steps=(
            "ממיסים שוקולד וחמאה יחד.",
            "מקציפים ביצים עם סוכר ומערבבים פנימה את השוקולד והקמח.",
            "אופים ב-170 מעלות 40 דקות.",
        ),
    ),
    _recipe(
        "לימונדה עם נענע",
        tags=("משקה", "מסיבות"),
        servings=6,
        prep=10,
        cook=None,
        description="לימונדה קרה ומרעננת לקיץ.",
        ingredients=(
            ("לימונים", 6, Unit.UNIT),
            ("סוכר", THIRD, Unit.CUP),
            ("מים קרים", 1, Unit.L),
            ("נענע", 1, Unit.PACKAGE),
            ("קרח", None, None),
        ),
        steps=("סוחטים את הלימונים.", "מערבבים עם סוכר ומים, מוסיפים נענע וקרח."),
    ),
    _recipe(
        "חומוס ביתי",
        tags=("רוטב/ממרח", "נשנוש", "פינגר פוד"),
        servings=6,
        prep=15,
        cook=None,
        description="חומוס חלק עם טחינה ולימון.",
        ingredients=(
            ("חומוס מבושל", 2, Unit.CUP),
            ("טחינה גולמית", HALF, Unit.CUP),
            ("מיץ לימון", 3, Unit.TBSP),
            ("שום", 1, Unit.CLOVE),
            ("מים קרים", 4, Unit.TBSP),
            ("מלח", None, None),
        ),
        steps=("טוחנים את כל החומרים עד לקבלת קרם חלק.", "מגישים עם שמן זית."),
    ),
    _recipe(
        "כדורי בשר קטנים",
        tags=("פינגר פוד", "מסיבות", "מנה ראשונה/סלט"),
        servings=8,
        prep=25,
        cook=15,
        description="כדורי בשר קטנים לנשנוש בעמידה.",
        ingredients=(
            ("בשר בקר טחון", 500, Unit.G),
            ("פירורי לחם", HALF, Unit.CUP),
            ("ביצה", 1, Unit.UNIT),
            ("פטרוזיליה", 1, Unit.PACKAGE),
            ("מלח ופלפל", None, None),
        ),
        steps=(
            "מערבבים את כל החומרים ויוצרים כדורים קטנים.",
            "אופים ב-200 מעלות 15 דקות.",
        ),
    ),
    _recipe(
        "אורז לבן",
        tags=("תוספת", "ערב"),
        servings=4,
        prep=5,
        cook=20,
        description="אורז פריד לכל ארוחה.",
        ingredients=(
            ("אורז בסמטי", 2, Unit.CUP),
            ("מים רותחים", 3, Unit.CUP),
            ("שמן", 1, Unit.TBSP),
            ("מלח", None, None),
        ),
        steps=(
            "מטגנים את האורז בשמן דקה.",
            "מוסיפים מים ומלח, מכסים ומבשלים 15 דקות על להבה נמוכה.",
        ),
    ),
)


# Openly licensed sample photos for the recipes they match (`seed_photos/CREDITS.md`).
SEED_PHOTO_DIR = Path(__file__).parent / "seed_photos"
SEED_PHOTOS = {
    "שקשוקה": "shakshuka.jpg",
    "עוגת שוקולד": "cake.jpg",
    "חזה עוף על האש": "chicken.jpg",
}
PHOTO_CREDIT_DOMAIN = "commons.wikimedia.org"

# A recipe that was tuned after it was created, so one ingredient shows its original
# (FR-7): the sugar went from 1 cup to ½ cup. Made by create, then update.
TUNED_RECIPE = _recipe(
    "עוגיות חמאה",
    tags=("קינוח", "מאפה"),
    servings=24,
    prep=20,
    cook=12,
    description="עוגיות פריכות וקלות להכנה.",
    ingredients=(
        ("קמח", 300, Unit.G),
        ("חמאה רכה", 200, Unit.G),
        ("סוכר", 1, Unit.CUP),
        ("ביצה", 1, Unit.UNIT),
    ),
    steps=("מקציפים חמאה וסוכר.", "מוסיפים ביצה וקמח, יוצרים כדורים ואופים."),
)
SEED_TOTAL = len(SEED_RECIPES) + 1


def _tuned(service: RecipeService, recipe_id: uuid.UUID) -> None:
    """Halve the sugar in the tuned recipe, as an editor would."""
    saved = service.get_recipe(recipe_id)
    changes = RecipeUpdate.model_validate(
        {
            **TUNED_RECIPE.model_dump(),
            "tags": [{"id": tag.id} for tag in saved.tags],
            "ingredients": [
                IngredientUpdate(
                    id=item.id,
                    name=item.name,
                    amount=HALF if item.name == "סוכר" else item.amount,
                    unit=item.unit,
                    note=item.note,
                )
                for item in saved.ingredients
            ],
        }
    )
    service.update_recipe(recipe_id, changes)


@dataclass(frozen=True)
class SeedResult:
    created: int
    skipped: int


def _with_photo(recipe: RecipeCreate, photos: PhotoService | None) -> RecipeCreate:
    """The recipe with its sample photo stored and attached, when it has one."""
    name = SEED_PHOTOS.get(recipe.title)
    if photos is None or name is None:
        return recipe
    key = photos.store((SEED_PHOTO_DIR / name).read_bytes())
    return recipe.model_copy(update={"photo_key": key})


def run_seed(service: RecipeService, photos: PhotoService | None = None) -> SeedResult:
    """Create each demo recipe whose title does not exist yet.

    With `photos`, the recipes that have a sample photo get it, with its credit.
    """
    existing = {summary.title for summary in service.list_recipes()}
    created = 0
    for recipe in SEED_RECIPES:
        if recipe.title in existing:
            continue
        service.create_recipe(
            _with_photo(recipe, photos),
            photo_credit_domain=PHOTO_CREDIT_DOMAIN,
        )
        created += 1
    if TUNED_RECIPE.title not in existing:
        _tuned(service, service.create_recipe(TUNED_RECIPE).id)
        created += 1
    return SeedResult(created=created, skipped=SEED_TOTAL - created)
