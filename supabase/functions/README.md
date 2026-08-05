# Supabase Edge Functions — סנכרון פריוריטי של רשעל

מקור-האמת של הצינור שהחליף את Make (04/08/2026). הפונקציות חיות בפרויקט
`kukstfxtznymfkirdmty` ומתוזמנות דרך `pg_cron` (ראה `../migrations/20260804_sync_cron.sql`).

## הפונקציות
| פונקציה | תפקיד | תזמון |
|---------|-------|--------|
| `rashal-sync` | משיכת OData מפריוריטי → POST ל-`/api/priority-sync` (inbox). jobs: `pull-core` / `pull-pickups` / `pull-pickup-addresses` | כל 20/30 דק' בשעות פעילות |
| `rashal-push` | outbox: צ'אט/צילומים → כרטיס הלקוח בפריוריטי | כל 15 דק' |
| `rashal-watchdog` | בודק בריאות פר-job, מתריע במייל (Resend) | כל שעה |

## סודות נדרשים (Edge Function Secrets)
- `PRIORITY_USER`, `PRIORITY_PASSWORD` — משתמש API של shaal (הזין עידן ידנית)
- `PRIORITY_SYNC_SECRET` — הסוד המשותף מול ה-Vercel endpoints (`x-sync-secret`)
- `RESEND_API_KEY`, `ALERT_EMAIL`, `ALERT_FROM` — ל-watchdog

## פריסה
```
supabase functions deploy rashal-sync   --project-ref kukstfxtznymfkirdmty
supabase functions deploy rashal-push   --project-ref kukstfxtznymfkirdmty
supabase functions deploy rashal-watchdog --project-ref kukstfxtznymfkirdmty
```

## הערות
- הליבה העסקית (upsert/adoption/בעלות-שדות) נשארה ב-`/api/priority-*.ts` (Vercel). הפונקציות
  האלה מחליפות רק את מה ש-Make עשה: תזמון + משיכה + החזקת הסיסמה.
- עיקרון: אין כיבוי-על-כשל. כל קריאה עם retry×3+backoff (פריוריטי-קונקט מנתק לסירוגין, לקח #22).
- התוכנית המלאה: `~/Idan-HQ/meetings/rashal/2026-08-04-תוכנית-מעבר-Make-לקוד.md`
