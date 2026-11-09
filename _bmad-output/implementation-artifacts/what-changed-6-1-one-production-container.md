# Story 6.1: קונטיינר אחד לפרודקשן (מה השתנה ולמה)

> **בוטל 2026-11-09:** ‏Docker הוסר מהפרויקט, כי הוא מורכבות מיותרת לפרויקט דמו. ההסבר למטה נשאר כהיסטוריה. גם ההגשה של האתר הבנוי מ-FastAPI הוסרה: FastAPI הוא רק API, ו-Vite מגיש את האתר. פרטים: `what-changed-remove-docker.md`.

**המטרה:** `docker compose up --build` ופתיחת http://localhost:8000 מריצים את כל האפליקציה (React + FastAPI + SQLite + תמונות) כמו בפרודקשן, על כל מחשב שיש בו Docker.

## הקבצים

| קובץ | מה הוא עושה | למה |
|---|---|---|
| `Dockerfile` | בנייה בשני שלבים (multi-stage). שלב 1: אימג' של Node שמתקין את התלויות ובונה את ה־React עם Vite. שלב 2: אימג' Python רזה שמתקין רק את תלויות ה־runtime מתוך `uv.lock` ומעתיק אליו את התיקייה הבנויה של ה־React. | האימג' הסופי לא כולל Node, node_modules או כלי פיתוח, ולכן הוא קטן ובטוח יותר. זה הדפוס המקובל, בדומה לבניית Angular ב־Node והגשתה מ־nginx, רק שכאן FastAPI מגיש גם את ה־API וגם את הקבצים. |
| `.dockerignore` | מה לא נשלח ל־Docker בזמן הבנייה. | בעיקר `.env` (מפתחות!), `node_modules`, `.venv` ו־DB מקומי. כך סוד לא יכול להיכנס לאימג' בטעות, והבנייה מהירה יותר. |
| `docker-compose.yml` | שירות אחד (`app`), פורט 8000, volume בשם `app-data` שמחובר ל־`/data`. | ה־DB והתמונות נשמרים ב־volume ולכן שורדים restart ובנייה מחדש. רק `docker compose down -v` מוחק אותם. |
| `apps/recipe-service/app/main.py` | מחלקה חדשה `SpaFiles` שמגישה את ה־React הבנוי. | ראו "ה־SPA fallback" למטה. |
| `apps/recipe-service/app/core/config.py` | הגדרה חדשה `WEB_DIR` (ברירת מחדל: ריק). ערך ריק (`WEB_DIR=`) נחשב "לא מוגדר", כמו מפתחות ה־API. | רק האימג' מגדיר אותה. בפיתוח היא ריקה ו־Vite ממשיך להגיש את ה־React על 4200, כך ש־`npm run dev` לא השתנה בכלל. |
| `apps/recipe-service/.env.example` | הערה על Docker, ושורה ריקה `WEB_DIR=` (בדיקה קיימת דורשת שכל הגדרה תופיע בקובץ). | לא נוסף קובץ env שני: compose קורא את אותו `.env` שלך. |
| `tests/test_spa.py` | 6 בדיקות ל־fallback ולכותרות ה־cache. | מוכיחות ש־`/api`, `/media` ו־`/assets` אף פעם לא מקבלים את דף ה־HTML במקום קובץ חסר. |

## ה־SPA fallback (הרעיון החשוב)

ב־React Router הנתיבים (למשל `/recipes/123`) קיימים רק בדפדפן. אם מרעננים את הדף, השרת מקבל בקשה ל־`/recipes/123`, ואין קובץ כזה. לכן:

- בקשת **HTML** (ניווט של דפדפן) לנתיב שאין לו קובץ מקבלת את `index.html`, ו־React Router מציג את הדף הנכון. זה כמו `try_files ... /index.html` ב־nginx שמכירים מ־Angular.
- נתיבים שמתחילים ב־`/api` לא מקבלים אף פעם את הדף, כדי ש־API שגוי יחזיר 404 אמיתי ולא HTML.
- `/media` הוא mount נפרד שנרשם לפני ה־React, ולכן הוא תמיד מנצח.
- קובץ חסר תחת `/assets/` (למשל chunk ישן אחרי deploy) תמיד מחזיר 404 ולא HTML, אחרת הדפדפן היה מקבל HTML במקום JS ומציג שגיאה מבלבלת.

## Cache

- קבצים ב־`/assets/` מקבלים `immutable` לשנה: Vite שם בשם הקובץ hash של התוכן, כך שתוכן חדש = שם חדש.
- `index.html` מקבל `no-cache`, כדי שגרסה חדשה תופיע מיד.
- `/media` כבר קיבל cache ארוך מ־Story 3.7a.

## מפתחות וסודות

`JWT_SECRET` ו־`ANTHROPIC_API_KEY` נקראים מ־`apps/recipe-service/.env` שלך **בזמן ריצה בלבד** (`env_file`), ולא נכנסים לאימג'. compose כופה `ENV=production` ו־`COOKIE_SECURE=true`. דפדפנים מקבלים עוגיית Secure גם ב־`http://localhost`, ולכן ההתחברות עובדת.

## Healthcheck

`HEALTHCHECK` ב־Dockerfile קורא ל־`/api/health` כל 30 שניות. `docker compose ps` מציג `healthy`. ה־migrations רצים בעליית האפליקציה (AD-29), ולכן migration שנכשל עוצר את הקונטיינר.

## איך מריצים

```
docker compose up --build -d
docker compose exec app python -m app.cli create-admin --email you@example.com --name "Adi"
docker compose exec app python -m app.cli seed   # מתכוני דמו, לא חובה
```

ה־DB בקונטיינר חדש וריק. ה־DB של הפיתוח שלך (`apps/recipe-service/data`) לא נגע.

## מה לא נכלל (בכוונה)

אין reverse proxy (אם יתווסף, timeout של לפחות 120 שניות, AD-43). לוגים מובנים וגיבויים הם Story 6.2 (V3).
