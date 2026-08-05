-- שני מקורות הזבל שאותרו ב-05/08/2026, ושתי העמודות שסוגרות אותם.
--
-- מקור א: רשומות שמקושרות לפריוריטי אבל אף פעם לא נסגרו אצלנו. הסטטוס של
--   פריוריטי (ORDSTATUSDES / CALLSTATUSCODE) פשוט לא נמשך ולא נשמר, ולכן 96%
--   מההזמנות נשארו "ממתין לתאום" ו-96% מהקריאות "קריאה חדשה" לנצח.
--   האיסופים לא סבלו מזה כי אצלם STATDES כבר היה ממופה.
-- מקור ב: שאריות ה-webhook הישן של Make, בלי priority_*_id, שהפסיק לייצר
--   רשומות ב-04/08/2026. גוש סופי שלא גדל.

-- מקור א — הסטטוס הגולמי של פריוריטי, לצד הסטטוס התפעולי שהאפליקציה מנהלת.
alter table public.orders        add column if not exists priority_status text;
alter table public.service_calls add column if not exists priority_status text;

comment on column public.orders.priority_status is
  'ORDSTATUSDES כפי שהתקבל מפריוריטי (טיוטא/מאושרת לבצוע/בוצעה/שולמה/מבוטלת). מקור אמת לסגירה בלבד; order_status נשאר בבעלות האפליקציה.';
comment on column public.service_calls.priority_status is
  'CALLSTATUSCODE כפי שהתקבל מפריוריטי (לביצוע/שובצה/בוצעה/סופית/מבוטלת/להמשך טיפול). "שובצה" לא ממופה בכוונה — המשמעות ברשעל טרם אומתה.';

-- מקור ב — סימון ארכיון. הפיך: לא מוחקים כלום, רק מוציאים מהתצוגה.
alter table public.orders        add column if not exists archived_at timestamptz;
alter table public.orders        add column if not exists archived_reason text;
alter table public.service_calls add column if not exists archived_at timestamptz;
alter table public.service_calls add column if not exists archived_reason text;

-- אינדקסים חלקיים: המסכים שואלים "מה לא בארכיון", וזה הרוב המכריע.
create index if not exists orders_active_idx
  on public.orders (created_at desc) where archived_at is null;
create index if not exists service_calls_active_idx
  on public.service_calls (created_at desc) where archived_at is null;
create index if not exists orders_priority_status_idx
  on public.orders (priority_status) where archived_at is null;
create index if not exists service_calls_priority_status_idx
  on public.service_calls (priority_status) where archived_at is null;
