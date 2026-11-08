# סטורי 5.5 — ביטול ושגיאות קריאות: מה השתנה ולמה

<div dir="rtl" style="direction: rtl; text-align: right;">

## ההחלטה (אדי, 2026-11-08)

- **אין שרשרת מנועים ואין cool down.** אם המנוע נכשל, הייבוא נכשל והמשתמש רואה הודעה ברורה. ב־2026-11-05 גם `gemini-3.5-flash-lite` וגם `gemini-3.5-flash` החזירו 503 באותו זמן, אז גיבוי מאותו ספק לא עוזר. לאפליקציה קטנה זה over-engineering.
- **Haiku (`anthropic`) הוא המנוע ברירת המחדל.** מחליפים מנוע בשורה אחת ב־`.env`: `LLM_PROVIDERS`.

## מה נבנה

**1. מנוע ברירת מחדל** — ב־`config.py` ו־`.env.example` ברירת המחדל היא `anthropic`. gemini ו־fake ממשיכים לעבוד. משתמשים רק במנוע הראשון ברשימה.

**2. `GET /api/imports/providers`** — מחזיר `[{name, timeout_s}]` של המנוע הפעיל. ה־client קורא אותו (hook בשם `useImportEngines` ב־`data-access`) ומגדיר לעצמו timeout של `timeout_s + 5` שניות. עד שהתשובה מגיעה נשאר ברירת המחדל, 95 שניות. ה־proxy של Vite הוגדר ל־120 שניות. uvicorn לא מגביל זמן של בקשה, אז אין מה לשנות שם.

**3. ביטול** — בזמן ייבוא (טקסט או קישור) מופיע כפתור "ביטול" ליד הספינר. הלחיצה קוראת ל־`AbortController.abort()`, הדיאלוג חוזר לטופס עם מה שהוקלד, בלי הודעת שגיאה, ושום דבר לא נשמר.
- אנלוגיה: זה כמו `unsubscribe()` או `takeUntil(cancel$)` ב־RxJS. הבקשה נעצרת בצד הדפדפן.
- **בצד השרת:** הבקשה רצה ב־thread pool ואי אפשר לעצור קריאה שכבר יצאה לספק. היא תסתיים ותירשם ב־`import_runs`. ביטול אמיתי בשרת יגיע עם SSE בסטורי 5.6.

**4. שגיאות בעברית** — `llm_timeout`, `llm_unavailable`, `llm_quota` מציגים: "יש בעיה זמנית בשירות ה־AI. אפשר לנסות שוב בעוד כמה דקות." עם כפתור "לנסות שוב", ובייבוא מקישור גם "להדביק את הטקסט במקום". `llm_invalid_output`, `provider_unavailable` ו־`request_timeout` (ה־client ויתר) מקבלים גם כפתור "לנסות שוב". כל המחרוזות ב־`he.json`.
- מנוע לא מוכר או בלי מפתח מחזיר עכשיו **400** `provider_unavailable` (היה 502).
- אנלוגיה: `AppError` + ה־handler ב־FastAPI הם כמו Exception Filter ב־Nest. הקוד נשאר יציב, וה־client מתרגם אותו להודעה.

## מסמכים שעודכנו

`CLAUDE.md` (כלל sprint-status), `sprint-status.yaml`, ‏AD-12, AD-40/42/43 ב־ARCHITECTURE-SPINE (AD-42 סומן DROPPED), וסטורי 5.5 ב־`epics.md` (הוקטן).

## בדיקות

pytest: endpoint ה־providers, ברירת המחדל, `provider_unavailable`, ומיפוי השגיאות (קיים). Vitest ו־MSW: ביטול (abort, בלי שגיאה, הקלט נשמר), ה־timeout של ה־client, וכל שגיאה עם ניסיון חוזר.

</div>
