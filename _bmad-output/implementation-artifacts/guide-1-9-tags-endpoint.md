# מדריך: כתיבת `GET /api/tags` (סטורי 1.9)

המטרה: נקודת קצה ציבורית שמחזירה את כל התגיות כ־`[{id, name, pinned}]`, ממוינות לפי `sort_order` (המוצמדות קודם), ואחר כך לפי שם.

הבדיקות כבר כתובות ב־`apps/recipe-service/tests/test_tags_api.py` והן נכשלות עד שהנקודה קיימת. זו כל המשימה: להפוך אותן לירוקות.

הרעיון המרכזי (כמו ב־NestJS): **router ← service ← repository**, והחיבור ביניהם דרך `Depends`. הדוגמה לחיקוי היא מודול `recipes` (`list_recipes`), ולצדה `tags/repository.py` שכבר מכיל שאילתת מיון דומה (`list_for_recipes`).

## השלבים (סדר מומלץ: מלמטה למעלה)

### 1. הסכמה: `app/tags/schemas.py`

להוסיף מחלקת `TagRead(BaseModel)` עם שלושה שדות: `id: uuid.UUID`, `name: str`, `pinned: bool`.
זה כמו `TagRef` שכבר קיימת בקובץ, בתוספת `pinned`. השם `TagRead` חשוב: הבדיקה בודקת אותו ב־OpenAPI, ומכאן ייווצר הטיפוס בצד ה־frontend.

### 2. ה־repository: `app/tags/repository.py`

להוסיף למחלקה `TagRepository` מתודה, למשל `list_all(self) -> Sequence[Tag]`, שמחזירה את כל התגיות.
את ה־`order_by` אפשר להעתיק מ־`list_for_recipes`: `sort_order` עולה עם `nulls_last()`, אחר כך `func.lower(col(Tag.name))`, ובסוף `col(Tag.id)` כמפתח שובר־שוויון.
ה־repository מדבר עם ה־DB בלבד: בלי לוגיקה עסקית ובלי schemas של API.

### 3. ה־service: `app/tags/service.py`

להוסיף ל־`TagService` מתודה `list_tags(self) -> list[TagRead]` שקוראת ל־`self._repository.list_all()` וממירה כל `Tag` ל־`TagRead(id=..., name=..., pinned=...)`.
כך ה־service מחזיר schemas ולא טבלאות (מודלים של DB). הוא כבר מקבל את ה־repository בבנאי, ו־`get_tag_service` כבר קיים בתחתית הקובץ.

### 4. ה־router: `app/tags/router.py`

כרגע יש שם רק `router = APIRouter(prefix="/tags", tags=["tags"])`. להוסיף, בדומה ל־`app/recipes/router.py`:

- הגדרת תלות: `ServiceDep = Annotated[TagService, Depends(get_tag_service)]`
- פונקציה `list_tags(service: ServiceDep) -> list[TagRead]` עם הדקורטור `@router.get("")`

שני דברים שכדאי להבין:

- **שם הפונקציה קובע את שם ה־hook.** ה־`operationId` נבנה כ־`{tag}_{function}`, כלומר `tags_list_tags`, ומכאן ה־hook שנוצר בצד ה־frontend. לכן השם `list_tags` הוא לא סתם העדפה.
- **טיפוס ההחזרה (`-> list[TagRead]`) הוא ה־response model.** FastAPI לוקח אותו לתיעוד ה־OpenAPI ולסינון התשובה, בלי `response_model=` נפרד.

### 5. רישום ב־`main.py`: אין מה לעשות

`tags_router` כבר רשום ב־`ROUTERS` ב־`app/main.py`. כל מה שנוסף ל־`router` ב־`tags/router.py` נכנס לאפליקציה אוטומטית. כדאי להיכנס לקובץ ולראות איך זה עובד.

## בדיקה

מתוך `apps/recipe-service`:

```bash
uv run pytest tests/test_tags_api.py
```

כשהכול ירוק, להריץ את כל הבדיקות והכלים:

```bash
npx nx run-many -t lint typecheck test -p recipe-service
```

טיפים לתקלות:

- `404` בבדיקות: הנתיב לא נרשם. לבדוק שהדקורטור הוא `@router.get("")` ולא `"/"`.
- `KeyError: '/api/tags'` בבדיקת ה־OpenAPI: אותה סיבה.
- `mypy`: לוודא שיש טיפוס החזרה מפורש לכל פונקציה.

## אחרי שהנקודה עובדת

לעדכן את ה־frontend (מייצר מחדש את `openapi.json` ואת ה־hooks, כולל `tagsListTagsOptions`):

```bash
npx nx run data-access:generate
```

ואז לעדכן אותי, ואני ממשיך לחבר את שורת הצ'יפים של התגיות בספרייה.
