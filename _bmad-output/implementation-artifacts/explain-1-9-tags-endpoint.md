# הסבר: נקודת הקצה `GET /api/tags`, שורה אחרי שורה

המטרה של הנקודה: להחזיר ל־frontend את כל התגיות כ־`[{id, name, pinned}]`, לפי סדר התצוגה (המוצמדות קודם), ואז לפי שם.

ההשוואות כאן הן ל־NestJS, TypeORM ו־Angular, כי זה העולם שמוכר. הן קירוב, לא זהות מדויקת.

## מבט על: מי עושה מה

```text
בקשה  GET /api/tags
  │
  ▼
router.py       ← מקבל את הבקשה, מחזיר תשובה        (Controller ב־Nest)
  │  קורא ל־
  ▼
service.py      ← ממיר מהטבלה אל צורת ה־API          (Service / Provider)
  │  קורא ל־
  ▼
repository.py   ← היחיד שמדבר עם ה־DB                (Repository ב־TypeORM)
  │  קורא ל־
  ▼
models.py       ← הטבלה `tag` ב־SQLite               (Entity)
```

הכיוון חד־כיווני: router מכיר רק את ה־service, ו־service מכיר רק את ה־repository. ה־router לא נוגע ב־DB בעצמו (כלל AD-1 בארכיטקטורה).

כל השכבות בתיקייה `apps/recipe-service/app/tags/`. את `recipes/` אפשר לקרוא כדוגמה: אותו מבנה בדיוק.

## 1. טבלה לעומת סכמה (`models.py` מול `schemas.py`)

**הטבלה: `Tag` ב־`models.py`** (Entity)

```python
class Tag(SQLModel, table=True):
    __tablename__ = "tag"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=40)
    pinned: bool = Field(default=False, ...)
    sort_order: int | None = None
```

- `table=True` אומר: המחלקה הזאת מייצגת טבלה אמיתית ב־DB.
- כל שדה הוא עמודה. `Tag` אחד הוא שורה אחת בטבלה.
- `sort_order: int | None` אומר שמותר שיהיה ריק (NULL). לתגיות המוצמדות יש מספר (0 עד 12), ולשאר אין.
- בצד ה־Entity ב־TypeORM זה `@Entity() class Tag { @PrimaryGeneratedColumn() id; @Column() name; ... }`.

**הסכמה: `TagRead` ב־`schemas.py`** (DTO)

```python
class TagRead(BaseModel):
    id: uuid.UUID
    name: str
    pinned: bool
```

- זו מחלקת Pydantic רגילה, בלי DB. היא מתארת את ה־**JSON שיוצא מה־API**.
- שימו לב: אין בה `sort_order`. ה־frontend לא צריך אותו, ולכן לא חושפים אותו.
- ב־Nest/Angular זה ה־DTO או ה־interface שה־frontend מקבל.

**למה שתי מחלקות?** כדי ששינוי בטבלה (למשל עמודה חדשה) לא ישנה בטעות את ה־API, ולהפך. ה־service הוא זה שמתרגם ביניהן.

דוגמה לשימוש: אילו `TagRead` היה שולח את `sort_order`, ה־frontend היה מקבל שדה שלא ביקש, והיה תלוי בו בטעות.

## 2. ה־repository: `list_all()`

```python
def list_all(self) -> Sequence[Tag]:
    """Every tag, pinned first, then by name."""
    statement = select(Tag).order_by(
        col(Tag.sort_order).asc().nulls_last(),
        func.lower(col(Tag.name)),
        col(Tag.id),
    )
    return self._session.exec(statement).all()
```

- `def list_all(self) -> Sequence[Tag]:` מתודה במחלקה `TagRepository`. `self` הוא ה־`this`. `-> Sequence[Tag]` אומר שהיא מחזירה רצף של `Tag`, וזה מה ש־mypy בודק.
- `select(Tag)` הוא `SELECT * FROM tag`: כל התגיות, בלי `WHERE`.
- `.order_by(a, b, c)` הוא `ORDER BY a, b, c`. ממיינים לפי a. אם שתי שורות שוות ב־a, מכריעים לפי b. אם גם b שווה, לפי c. הפסיקים הם מפרידים בין מפתחות המיון.

שלושת המפתחות:

1. `col(Tag.sort_order).asc().nulls_last()`
   - `asc()` הוא עולה: 0, 1, 2...
   - `nulls_last()` שם את הריקים (NULL) בסוף. רק למוצמדות יש `sort_order`, לכן הן יוצאות קודם, בסדר התצוגה שהוגדר להן. האחרות באות אחריהן.
2. `func.lower(col(Tag.name))`
   - `lower` הופך את השם לאותיות קטנות רק לצורך ההשוואה. הערך עצמו לא משתנה.
   - בלעדיו, אות גדולה באנגלית ("Cherry") הייתה ממוינת לפני אות קטנה ("banana"). בעברית אין אותיות גדולות, ואין הבדל.
   - זה אותו מיון שכבר מופיע ב־`list_for_recipes` ובתגיות שמוטמעות בכל מתכון (AD-20).
3. `col(Tag.id)`
   - ה־`id` ייחודי. הוא שובר שוויון: אם שתי תגיות זהות בשני המפתחות הראשונים, ה־`id` קובע ביניהן סדר קבוע. בלעדיו הסדר ביניהן עלול להשתנות בין הרצות, והבדיקות היו הופכות ללא יציבות.

**מה זה `col(...)`?** `Tag.sort_order` מוגדר בקוד כ־`int | None`, כלומר mypy רואה מספר ולא עמודה. `col()` אומר: "תתייחס לזה כאל עמודה ב־DB", וכך אפשר לקרוא עליה `.asc()` ולהעביר אותה ל־`lower`. אין צורך להעמיק בזה.

- `self._session.exec(statement)` מריץ את השאילתה על ה־DB. `self._session` הוא החיבור, כמו ה־`EntityManager` ב־TypeORM.
- `.all()` מחזיר רשימה של כל השורות כאובייקטי `Tag`.

## 3. ה־service: `list_tags()`

```python
def list_tags(self) -> list[TagRead]:
    """Every tag, pinned first, then by name."""
    return [
        TagRead(id=tag.id, name=tag.name, pinned=tag.pinned)
        for tag in self._repository.list_all()
    ]
```

- ה־service מקבל `TagRepository` בבנאי (`self._repository`), בדיוק כמו Provider שמקבל תלות ב־Nest.
- `self._repository.list_all()` מחזיר רשימת `Tag` (טבלאות).
- ה־list comprehension בונה מכל `Tag` אובייקט `TagRead` חדש, בשלושת השדות. זה המעבר מ־Entity ל־DTO.
- השורה `[... for tag in ...]` שקולה ל־`.map(tag => new TagRead(...))` ב־TypeScript.

באותו קובץ `get_tags` עושה את אותו דבר עבור תגיות של מתכונים, עם `TagRef`.

## 4. ה־router: `list_tags` ו־`Depends`

```python
ServiceDep = Annotated[TagService, Depends(get_tag_service)]

@router.get("")
def list_tags(service: ServiceDep) -> list[TagRead]:
    return service.list_tags()
```

- `router = APIRouter(prefix="/tags", tags=["tags"])` (כבר קיים בקובץ): כל נתיב בקובץ מתחיל ב־`/tags`, ו־`main.py` מוסיף לפניו `/api`. לכן `@router.get("")` נהיה `GET /api/tags`. הסימן `""` הוא "בלי המשך".
- `@router.get(...)` הוא Decorator, כמו `@Get()` ב־Nest.
- **`Depends`** הוא ה־Dependency Injection של FastAPI. `Depends(get_tag_service)` אומר: "לפני שתקרא לפונקציה, תריץ את `get_tag_service` (שבונה `TagService` עם `TagRepository` ועם session של DB), ותעביר לי את התוצאה". כמו שה־constructor injection ב־Nest מזריק Provider.
- `Annotated[TagService, Depends(get_tag_service)]` הוא סוג מוצהר בשורה אחת: "פרמטר מסוג `TagService` שמגיע מ־`Depends`". נותנים לו שם, `ServiceDep`, כדי לא לחזור עליו בכל נקודה. זה בדיוק מה ש־`recipes/router.py` עושה.
- `-> list[TagRead]` הוא טיפוס ההחזרה, והוא גם ה־**response model**: FastAPI משתמש בו כדי לתעד את התשובה ב־OpenAPI ולהמיר את התוצאה ל־JSON. אין צורך בפרמטר `response_model` נפרד.
- ה־router לא מכיל לוגיקה. הוא רק קורא ל־`service.list_tags()` ומחזיר.

### שם הפונקציה קובע את שם ה־hook

ב־`main.py` יש `generate_operation_id` שמחבר `{tag}_{function}`. כאן ה־tag הוא `tags` והפונקציה היא `list_tags`, ולכן ה־`operationId` של הנקודה הוא **`tags_list_tags`**. הבדיקה `test_operation_id_and_response_schema_are_published` מוודאת את זה.

השם הזה לא סתם: מכאן נוצר שם ה־hook בצד ה־frontend (ראו הסעיף הבא). לכן מקפידים על שמות `verb_noun` לפונקציות הנתיב.

## 5. איך ה־frontend מקבל את `tagsListTagsOptions`

אף שורה בצד ה־frontend לא נכתבת ביד. הכול נוצר מהנקודה:

1. **`nx run recipe-service:openapi`** מייצר את `libs/data-access/openapi.json`: תיאור מלא של ה־API (נתיבים, סוגים, שמות פעולות) ישירות מקוד ה־FastAPI, בלי להריץ שרת ובלי DB.
2. **`openapi-ts`** (hey-api) קורא את הקובץ הזה ומייצר ב־`libs/data-access/src/generated`:
   - את הטיפוס `TagRead` (מ־`TagRead` ב־Pydantic): `{ id: string; name: string; pinned: boolean }`.
   - פונקציית קריאה `tagsListTags()` ל־`GET /api/tags`.
   - את ה־hook helpers של TanStack Query: **`tagsListTagsOptions()`** ו־`tagsListTagsQueryKey()`, בשם שנגזר מ־`operationId` (`tags_list_tags` ← `tagsListTags` + `Options`).
3. הפקודה `npx nx run data-access:generate` עושה את שני השלבים יחד. ב־CI מריצים אותה שוב ובודקים ש־`git diff` נקי, כך שה־frontend והשרת לעולם לא יסטו זה מזה.

ובדף הספרייה (`libs/feature-recipes`), השימוש הוא:

```ts
const tags = useQuery(tagsListTagsOptions());
```

`tags.data` הוא `TagRead[]`, כבר ממוין. הדף מציג ממנו את צ'יפים של התגיות המוצמדות (`pinned`), ובודק ש־id שמופיע ב־URL (`?tags=`) קיים באמת.

## סיכום: מסלול של בקשה אחת

1. הדפדפן שולח `GET /api/tags`.
2. FastAPI מוצא את `list_tags` ב־`tags/router.py`, ומריץ קודם את `Depends` שבונה `TagService`.
3. ה־router קורא ל־`service.list_tags()`.
4. ה־service קורא ל־`repository.list_all()`.
5. ה־repository מריץ `SELECT * FROM tag ORDER BY ...` ומחזיר רשימת `Tag`.
6. ה־service ממיר כל `Tag` ל־`TagRead`, והרשימה חוזרת ל־router.
7. FastAPI ממיר את הרשימה ל־JSON, לפי `list[TagRead]`.
8. ה־frontend מקבל `[{id, name, pinned}, ...]` דרך `tagsListTagsOptions`.
