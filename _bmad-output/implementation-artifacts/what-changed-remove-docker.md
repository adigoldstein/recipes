# מה השתנה: הסרת Docker ופישוט ההגשה של האתר

## בקצרה

Docker הוסר מהפרויקט, כי הוא מורכבות מיותרת לפרויקט דמו שלא יוצא לפרודקשן. בנוסף, FastAPI כבר לא מגיש את אתר ה-React. החלוקה עכשיו פשוטה:

- **FastAPI** מגיש רק את ה-API (`/api`) ואת התמונות (`/media`).
- **Vite** מגיש את האתר, ומעביר (proxy) את `/api` ו-`/media` ל-FastAPI. לכן הדפדפן רואה כתובת אחת, ועוגיית ההתחברות עובדת בלי הגדרות CORS.

מריצים כמו קודם: `npm run dev`.

## מה נמחק

- `Dockerfile`, `docker-compose.yml` ו-`.dockerignore` (בשורש).
- ב-`app/main.py`: המחלקה `SpaFiles` (בערך 30 שורות) שהגישה את האתר הבנוי, והחיבור שלה לאפליקציה.
- ההגדרה `WEB_DIR` ב-`app/core/config.py` וב-`.env.example`.
- `tests/test_spa.py` (‏6 בדיקות של ההגשה הזאת).
- כל אזכור של Docker או של "קונטיינר" בהערות: `.env.example`, `app/core/rate_limit.py` ו-`apps/recipe-service/README.md`.

## מה נשאר

- `/api/health` עונה "השרת חי", ובדיקות ה-e2e מחכות לו. הוא היה כבר מהשלד הראשון.
- `/media` לתמונות, כמו קודם.

## בדיקות ה-e2e

הן עדיין בודקות את האתר הבנוי (build), אבל עכשיו Playwright מפעיל שני שרתים:

1. `scripts/start-server.mjs`: ‏FastAPI בלבד, על מסד נתונים חדש (פורט 8130).
2. `vite preview`: האתר הבנוי (פורט 8131), שמעביר את `/api` ו-`/media` ל-FastAPI.

ב-`apps/web/vite.config.mts`, ה-proxy מוגדר פעם אחת ומשמש גם את `vite` וגם את `vite preview`. הכתובת של FastAPI ניתנת לשינוי עם `API_ORIGIN`, וה-e2e משתמש בזה.

## בתכנון

- `epics.md`: סטורי 6.1 סומן "בוטל 2026-11-09", והטקסט המקורי שלו נשאר כהיסטוריה. גם תיאור אפיק 6 וסטורי 6.5 עודכנו.
- `ARCHITECTURE-SPINE.md`: ‏AD-15 הוא עכשיו "origin אחד דרך ה-proxy של Vite", עם הערה שהקונטיינר בוטל.
- `sprint-status.yaml`: ‏6.1 סומן DROPPED.
- `docs/prd.md` (ה-PRD הראשון): שורות ה-Docker סומנו כמבוטלות.
- `what-changed-6-1-one-production-container.md` נשאר כהיסטוריה, עם שורה בראש שאומרת שבוטל.

## במחשב שלך

ה-image ‏`bite-and-board:local` וה-volume ‏`recipes_app-data` עדיין קיימים ב-Docker Desktop. לא נגעתי בהם. אפשר למחוק אותם ידנית, אבל ב-volume יש `app.db` מ-8 בנובמבר.
