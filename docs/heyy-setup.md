# heyy.io ↔ rashal-dashboard — מדריך הפעלה

> מסמך זה מסביר איך להחליף את ה-**מצב דמו** לחיבור אמיתי ל-heyy.io כשהחשבון יאושר.
>
> נכון להיום (2026-05-24) המערכת **רצה במצב דמו** — כל "שליחה" נשמרת ב-DB אבל לא יוצאת לוואטסאפ.

---

## ארכיטקטורה — מבט-על

```
┌─────────────────────┐  user clicks button   ┌────────────────────────┐
│ Dashboard (Vite SPA)│ ────────────────────▶ │ /api/heyy-send         │
│ - WhatsAppActions   │                       │ (Vercel serverless)    │
│ - WhatsAppPage      │                       └───────────┬────────────┘
└─────────────────────┘                                   │
                                                    HEYY_MODE=demo?
                                              ┌──────────┴──────────┐
                                            yes                     no
                                              │                     │
                                       log to DB only        POST to heyy.io
                                              │                     │
                                              └─────────┬───────────┘
                                                        ▼
                                              whatsapp_outbound row

Customer replies on WhatsApp:
heyy → POST /api/heyy-webhook → parse → match order → update orders.customer_reply_status
                                      → write whatsapp_inbound row → realtime push to dashboard
```

## קבצים מרכזיים

| מה | איפה |
|---|---|
| Browser-side heyy client | `src/lib/heyy/client.ts` |
| Templates registry (לעדכן עם UUIDs אמיתיים) | `src/lib/heyy/templates.ts` ⭐ |
| Phone format utils | `src/lib/heyy/phone.ts` (+ עותק ב-`api/_lib/phone.ts`) |
| Server-side heyy client | `api/_lib/heyy-server.ts` |
| Webhook receiver | `api/heyy-webhook.ts` |
| Send endpoint | `api/heyy-send.ts` |
| Daily cron | `api/cron-daily-reminders.ts` |
| UI — actions on each order | `src/components/whatsapp/WhatsAppActions.tsx` |
| UI — central WhatsApp page | `src/pages/WhatsAppPage.tsx` |
| DB schema | `supabase/migrations/20260524_whatsapp_integration.sql` |

---

## שלב 0 — DB migration (חד-פעמי, גם במצב דמו)

1. פתח את Supabase Dashboard → SQL Editor
2. New query → העתק את כל התוכן של `supabase/migrations/20260524_whatsapp_integration.sql` → Run
3. אמת:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name LIKE 'whatsapp_%';
   ```
   צריך לראות: `whatsapp_inbound`, `whatsapp_outbound`, `whatsapp_reminder_log`
4. אמת שב-`orders` נוספו העמודות:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'orders' AND column_name IN (
     'delivery_date', 'scheduled_reminder_at',
     'customer_reply_status', 'customer_requested_time', 'last_reminder_at'
   );
   ```

## שלב 1 — Vercel ENV vars

ב-Vercel Dashboard → Project rashal-dashboard → Settings → Environment Variables:

| Var | Value | Scope |
|---|---|---|
| `SUPABASE_URL` | `https://kukstfxtznymfkirdmty.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | (Service Role key מ-Supabase Settings → API) | Production, Preview, Development |
| `HEYY_MODE` | `demo` (לעת עתה) → `real` (אחרי אישור) | Production, Preview |
| `HEYY_API_KEY` | (יישלח מ-heyy לאחר פתיחת חשבון) | Production, Preview |
| `HEYY_CHANNEL_ID` | (UUID מ-heyy UI → Channels) | Production, Preview |
| `HEYY_WEBHOOK_SECRET` | random string (לדוגמה: `openssl rand -hex 24`) | Production, Preview |

**שים לב:** `SUPABASE_SERVICE_ROLE_KEY` הוא מפתח רגיש — אסור ב-VITE_ prefix, אסור לחשוף ל-browser. ההפרדה כבר עשויה — רק `api/` משתמש בו.

## שלב 2 — קבלת חשבון heyy

1. הרשם ב-https://heyy.io
2. חבר ערוץ WhatsApp Business (לוקח 1-3 ימים אם צריך אימות עסק חדש מול Meta)
3. אחרי האימות:
   - העתק את `API Key` מההגדרות → הגדר ב-Vercel כ-`HEYY_API_KEY`
   - העתק את `Channel ID` של הערוץ → הגדר ב-Vercel כ-`HEYY_CHANNEL_ID`

## שלב 3 — רישום Templates ל-Meta

ב-heyy UI → Tools → **Create new template**, צור את 3 ה-templates הבאים. **הגדר אותם כ-Utility (לא Marketing)** — חיסכון של 5-10× בעלות.

### Template 1: `delivery_reminder`

**Category:** Utility
**Language:** Hebrew (he)
**Body:**
```
שלום {{1}},
תזכורת על משלוח של ראש"ל ציוד רפואי היום בין השעות {{2}}-{{3}}.
כתובת: {{4}}
לשאלות: 03-XXXXXXX
```

### Template 2: `schedule_request`

**Category:** Utility
**Language:** Hebrew (he)
**Body:**
```
שלום {{1}},
נשמח לתאם איתכם משלוח של ראש"ל ציוד רפואי.
מתי נוח לכם לקבל? נא לענות אחת מהאפשרויות:
בוקר / צהריים / אחה"צ / ערב
```

### Template 3: `team_notification`

**Category:** Utility
**Language:** Hebrew (he)
**Body:**
```
שלום {{1}},
{{2}}
```

**אישור Meta לוקח 24-48 שעות.** אחרי שכל אחד מאושר, heyy יחזיר לך `templateId` (UUID).

## שלב 4 — עדכון Template IDs בקוד

ב-`src/lib/heyy/templates.ts` החלף את ה-placeholder IDs:

```ts
// לפני:
delivery_reminder: { ..., templateId: 'DEMO-delivery-reminder', ... }

// אחרי:
delivery_reminder: { ..., templateId: '<UUID-מאושר-מ-heyy>', ... }
```

הקוד יזהה אוטומטית את ההחלפה — Templates עם prefix `DEMO-` עוברים גם דרך החיבור האמיתי (גם אם `HEYY_MODE=real`) **לא** יישלחו ל-Meta — הם יוחזרו עם שגיאה ברורה ב-`status_detail`.

## שלב 5 — הגדרת ה-Webhook ב-heyy

ב-heyy UI → Channels → הערוץ → Settings → Webhooks → **WhatsApp Message Received**:

| שדה | ערך |
|---|---|
| URL | `https://rashal-dashboard.vercel.app/api/heyy-webhook` |
| Method | `POST` |
| Custom header (אופציונלי אך מומלץ) | `X-Heyy-Secret: <ערך של HEYY_WEBHOOK_SECRET>` |

## שלב 6 — מעבר מ-demo ל-real

ב-Vercel Dashboard → Environment Variables, שנה:

```
HEYY_MODE=real
```

ואז:
```
vercel --prod
```

או דרך push ל-master (assuming auto-deploy).

## שלב 7 — בדיקה אחרי המעבר

1. פתח את הדשבורד → /whatsapp → אמור להעלם ה-Badge "מצב דמו פעיל"
2. בדף /whatsapp → טאב "תזכורת יומית" → לחץ "הרץ עכשיו ידנית" — בדוק שאין הזמנות עם delivery_date=today, או שכן והן נשלחו
3. בחר הזמנה בודדת בדשבורד → לחץ "שלח תזכורת משלוח" → המקבל אמור לקבל הודעה ב-WhatsApp תוך כמה שניות
4. ענה מהטלפון שלך → אמור להופיע ב-/whatsapp → טאב "הודעות נכנסות" תוך 2-3 שניות (realtime)

## טבלת אנטי-פטרנים — מה לא לעשות

| ❌ אל תעשה | ✅ עשה במקום |
|---|---|
| לדחוף `HEYY_API_KEY` ל-git | תמיד דרך Vercel Env Vars |
| להשתמש ב-`VITE_*` prefix לסודות שרת | רק ל-public values (URL, anon key, mode flag) |
| להחזיר 4xx/5xx מ-`api/heyy-webhook` בלי סיבה אמיתית | תמיד 200 חוץ מ-DB-down — אחרת heyy ייעשה retry בלולאה |
| לסמוך על `200 OK` שהודעה נשלחה | בדוק `waMessageId !== ''` ו-`status !== 'PENDING'` |
| לשלוח טקסט חופשי לנהג שלא ענה ב-24h האחרונות | חובה template — האפליקציה מטפלת בזה אוטומטית כשמשתמשים ב-`sendReminder` |

## מבנה DB — סיכום

```
public.whatsapp_inbound       — כל הודעה שנכנסה (גם demo)
public.whatsapp_outbound      — כל ניסיון שליחה (גם demo + נכשלים)
public.whatsapp_reminder_log  — תיעוד לצורך cooldown 24-48h

public.orders (עמודות חדשות)
├── delivery_date              — תאריך משלוח (date) — לקרון
├── scheduled_reminder_at      — תזכורת ידנית עתידית
├── customer_reply_status      — מתאים/לא מתאים/בקשת שינוי/ממתין
├── customer_requested_time    — טקסט חופשי שהלקוח שלח
└── last_reminder_at           — cache של ההודעה האחרונה שיצאה
```

## בעיות נפוצות

| בעיה | פתרון |
|---|---|
| `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY` | בדוק שה-ENV vars מוגדרים ב-Vercel **ושעשית redeploy** אחרי |
| Webhook לא נקרא | (1) URL חייב להתחיל ב-https (Vercel נותן בחינם) (2) HEYY_WEBHOOK_SECRET תואם בין Vercel ל-heyy UI |
| `waMessageId` ריק | חלון 24h סגור → השתמש ב-template |
| Template נדחה | (1) חרגת מ-1024 תווים? (2) פורמט placeholders שגוי? (3) שפה לא נתמכת? |
| Realtime לא מעדכן את ה-inbox | ודא שה-publication הופעלה (חלק מה-SQL — שורה `ALTER PUBLICATION ...`) |

## פיתוח מקומי

ב-`.env` המקומי (לא נדחף ל-git):
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_HEYY_MODE=demo
```

ל-API functions ב-Vercel CLI:
```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

`vercel dev` יריץ גם את ה-Vite SPA וגם את ה-functions ב-`/api`.
