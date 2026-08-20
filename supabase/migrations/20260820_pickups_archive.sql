-- איסופים: עמודת ארכיון, במקביל למה שכבר קיים ב-orders וב-service_calls
-- (20260805_priority_status_and_archive.sql).
--
-- הרקע: משיכת ההיסטוריה מ-01/01/2026 מביאה מאות איסופים ישנים. חלקם עדיין
-- "טיוטא" בפריוריטי, כלומר לפי המיפוי הרגיל הם היו נוחתים כ"ממתין לתאום"
-- ומציפים את רשימת העבודה של הסדרן בעבודה שאיש לא מתכוון לבצע.
--
-- ארכיון ולא מחיקה: השורה קיימת במסד לדוחות ולהיסטוריה, פשוט לא מוצגת.
-- הפיך לחלוטין: update pickups set archived_at = null where archived_reason = '...'
alter table public.pickups add column if not exists archived_at    timestamptz;
alter table public.pickups add column if not exists archived_reason text;

comment on column public.pickups.archived_at is
  'לא null = מוסתר מהמסכים. לא נמחק לעולם, רק מוצא מהתצוגה.';

-- המסכים שואלים "מה לא בארכיון", וזה הרוב המכריע.
create index if not exists pickups_active_idx
  on public.pickups (created_at desc) where archived_at is null;
