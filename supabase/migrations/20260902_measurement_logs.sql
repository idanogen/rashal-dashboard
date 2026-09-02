-- ראה migration שהוחל ב-Supabase: measurement_logs (02/09/2026)
-- הלוגים שחסרו כדי שאפשר יהיה למדוד את הצוות (בקשת עידן).
--
-- ⭐ **הרקע:** מדידה של 90 יום הראתה שלוש שאלות שאי אפשר לענות עליהן
-- מהנתונים, ולא בגלל שהמידע לא נאסף אלא בגלל **שהוא לא נשמר במקום
-- שאפשר לספור בו**:
-- 1. `arrived_at` היה מלא ב-**1 מתוך 1,075** עצירות, בזמן שיומן הפעילות
--    מחזיק **715 אירועי הגעה**. השעה נרשמה, פשוט לא על העצירה.
-- 2. סיבת "לא בוצע" נרשמה ביומן הפעילות ב-123 אירועים, ועל העצירה עצמה
--    רק ב-26 מתוך 127. מי שקורא את העצירה לא רואה למה היא לא בוצעה.
-- 3. הסיבה היא טקסט חופשי: **85 ניסוחים שונים ל-123 אירועים**, ולכן
--    אי אפשר לספור "כמה פעמים הלקוח לא היה בבית".
--
-- 🔴 **הפתרון לשעת ההגעה הוא טריגר ולא קוד בדפדפן.** ההגעה נלחצת משני
-- מקומות, מסך הנהג בווב **ומאפליקציית הנהגים**, ותיקון בצד אחד היה
-- משאיר את השני שקט. המסד הוא המקום היחיד ששניהם עוברים דרכו.
-- [[endpoint_hardening_orphans_callers]]

-- ── 1. סיבה קנונית לצד הטקסט החופשי ──────────────────────────────────
--
-- ⭐ **הרשימה הסגורה כבר קיימת במסך** (`NotCompletedReasonDialog`), והיא
-- רק מילאה את שדה הטקסט. מעכשיו הבחירה נשמרת גם כערך משלה, והטקסט
-- החופשי נשאר כמו שהוא. אין כאן שינוי בעבודה של הנהג.
alter table public.calendar_stops
  add column if not exists resolution_reason text;

comment on column public.calendar_stops.resolution_reason is
  'הסיבה מהרשימה הסגורה, כדי שאפשר יהיה לספור. הניסוח החופשי נשאר ב-resolution_note. נולד 02/09/2026.';

-- ── 2. שעת ההגעה נחתמת במסד ──────────────────────────────────────────
--
-- 🔴 **רק כשהיא ריקה.** נהג שחוזר ללקוח באותו יום, או שלוחץ "הגעתי"
-- פעמיים, לא אמור לדרוס את הרגע שבו באמת הגיע.
create or replace function public.stamp_stop_arrival()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'in_progress'
     and coalesce(old.status, '') is distinct from 'in_progress'
     and new.arrived_at is null then
    new.arrived_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_stop_arrival on public.calendar_stops;
create trigger trg_stamp_stop_arrival
  before update on public.calendar_stops
  for each row execute function public.stamp_stop_arrival();

revoke all on function public.stamp_stop_arrival() from public, anon, authenticated;

comment on function public.stamp_stop_arrival() is
  'חותמת שעת הגעה על מעבר ל-in_progress, פעם אחת. נולד 02/09/2026, אחרי ש-arrived_at היה מלא ב-1 מתוך 1,075.';

-- ── 3. השלמת ההיסטוריה מיומן הפעילות ────────────────────────────────
--
-- ⭐ **ההיסטוריה לא אבודה.** 708 מתוך 715 אירועי ההגעה מצביעים על עצירה
-- שקיימת, ולכן אפשר להחזיר את השעה אחורה ולא להתחיל למדוד מאפס.
update public.calendar_stops cs
   set arrived_at = a.first_arrival
  from (
    select entity_id, min(occurred_at) as first_arrival
      from public.activity_events
     where action = 'arrival'
     group by entity_id
  ) a
 where a.entity_id = cs.id
   and cs.arrived_at is null;

update public.calendar_stops cs
   set resolution_note = a.reason
  from (
    select distinct on (entity_id) entity_id, metadata->>'reason' as reason
      from public.activity_events
     where action = 'stop_not_completed'
       and coalesce(metadata->>'reason', '') <> ''
     order by entity_id, occurred_at desc
  ) a
 where a.entity_id = cs.id
   and cs.status = 'not_completed'
   and cs.resolution_note is null;

-- ⭐ ומה שכבר נכתב בדיוק כאחת הסיבות מהרשימה מסווג רטרואקטיבית. השאר
-- נשאר בלי סיווג בכוונה: ניחוש על טקסט חופשי הוא בדיוק מה שהופך מדד
-- למספר שאי אפשר לסמוך עליו.
update public.calendar_stops cs
   set resolution_reason = trim(cs.resolution_note)
 where cs.resolution_reason is null
   and trim(coalesce(cs.resolution_note, '')) in (
     'הלקוח לא היה בבית', 'הלקוח ביטל', 'כתובת שגויה',
     'לא הצלחתי ליצור קשר', 'חוסר במלאי / ציוד', 'אין גישה / חניה',
     'הציוד שסופק לא התאים', 'חסר חלק, צריך להזמין', 'נדרש תיקון נוסף',
     'הלקוח ביקש להחליף', 'נדרשת התאמה במעבדה', 'סופק חלקית'
   );

-- אינדקס לדוח: הסיבות נספרות לפי תאריך.
create index if not exists calendar_stops_reason_idx
  on public.calendar_stops (delivery_date desc, resolution_reason)
  where resolution_reason is not null;
