# סטורי 5.6 — התקדמות ייבוא חיה (SSE): מה השתנה ולמה

<div dir="rtl" style="direction: rtl; text-align: right;">

## ההחלטה (אדי, 2026-11-08)

בלי הצגה חיה של מצרכים. ה־stream מכיל רק אירועי `stage`, ‏`draft` ו־`error`. אין parsing חלקי של JSON.

## מה נבנה

**1. השרת עונה ב־`text/event-stream`.** ב־`POST /api/imports/text` וב־`/url` התשובה היא stream של אירועים.
- אנלוגיה: זה כמו Observable שהשרת שולח, או `@Sse()` ב־Nest. הלקוח מאזין לאירועים עד שמגיע `draft` או `error`.
- `stage` מגיע עם `{name, status}`. השלבים: `fetch`, ‏`extract`, ‏`translate`, ‏`validate`, ‏`convert_units`. הסטטוסים: `started`, ‏`done`, ‏`skipped`.
- בייבוא מטקסט `fetch` הוא `skipped`. `translate` הוא `done` אם המודל תרגם, אחרת `skipped`. התרגום קורה בתוך קריאת ה־LLM, ולכן הוא מדווח ממש אחרי `extract`.
- בדיקות שעונות בסטטוס HTTP רגיל נשארות לפני שה־stream מתחיל: הרשאות, CSRF, מכסה יומית (429), טקסט ארוך (413) ומנוע לא זמין (400). כשל בשלב `fetch` או בקריאה למודל מגיע כאירוע `error` עם קוד AD-28. כל הקודים וההודעות העבריות מ־5.5 נשארו.

**2. ביטול אמיתי בשרת.** הספקים (Anthropic ו־Gemini) עברו ל־`httpx.AsyncClient`, והייבוא רץ כ־asyncio task.
- כשהלקוח מתנתק, ה־task מבוטל והקריאה למנוע נעצרת. זה כמו `takeUntil(disconnect$)` ב־RxJS.
- ההרצה נרשמת ב־`import_runs` עם `outcome = "cancelled"`. העמודה היא טקסט חופשי, אז אין migration.
- למה polling כל 0.25 שניות על `request.is_disconnected()`: uvicorn לא מפסיק תגובה שממתינה בלי לשלוח כלום.
- הורדת הדף (`fetch`) היא קוד חוסם, ורצה ב־thread. בביטול אנחנו מפסיקים לחכות לה והיא מסתיימת לבד בתוך 15 השניות שלה.

**3. הלקוח.** `streamImport` ב־`libs/data-access` קורא את ה־stream עם `fetch` ו־stream reader (`EventSource` לא יכול לעשות POST או לשלוח כותרת CSRF).
- הוא מחזיר את ה־draft, או זורק שגיאה בצורת ה־API `{code, detail, params}`. כך כל הטיפול בשגיאות מ־5.5 נשאר כמו שהיה.
- ביטול: `AbortController`, כמו קודם.
- timeout: אם ה־stream שותק יותר מ־`timeout_s + 5` שניות, מתקבל `request_timeout`.

**4. הדיאלוג.** רשימת שלבים בעברית (checklist) שמתעדכנת בזמן אמת: ספינר לשלב שרץ ו־V לשלב שהסתיים. שלבים שדולגו לא מוצגים. אין פס אחוזים. "ביטול", "לנסות שוב" ו"להדביק את הטקסט במקום" נשארו.

**5. OpenAPI.** מודלי האירועים נוספו ל־OpenAPI, ו־client הגנרי נוצר מחדש. הפונקציות הגנריות של הייבוא לא בשימוש, כי הקריאה עוברת דרך `streamImport`.

## בדיקות

- pytest: סדר האירועים (טקסט, קישור, מתורגם), שגיאה אחרי תחילת ה־stream, שגיאה לפני ה־stream, ניתוק לקוח שמבטל את הקריאה ונרשם כ־`cancelled`, וסגירת ה־stream באמצע.
- Vitest ו־MSW: ה־checklist, אירוע `error`, stream שנקטע, שגיאה לפני ה־stream, ביטול ו־timeout.

## נדחה

- הצגה חיה של מצרכים (הוחלט שלא).
- ה־Vite proxy ו־uvicorn ללא שינוי. proxy-timeout של 120 שניות כבר מוגדר מ־5.5.

</div>
