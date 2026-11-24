-- ════════════════════════════════════════════════════════════════════════
-- רשימת בדיקה לטכנאי בכיסא גלגלים ממונע (שלומי 03/11/2026, עמי ועידן 10/11/2026)
--
-- שלומי: "להכניס את הרשימה המצורפת לאפליקציית הטכנאים בזהה לתהליך שבוצע
-- בעולם המנופים", "חתימות חובה". הרשימה עצמה: `src/lib/chair-checklist.ts`.
--
-- ⭐ אותה טבלה כמו טפסי המנוף (`crane_forms`), סוג חדש `chair_inspection`.
-- כך תור האפליקציה (בלי קליטה) שומר אותה בלי שינוי.
--
-- 🔴 שדות חדשים ולא `crane_kind`: גרסת אפליקציה ישנה מציגה לכל `crane_kind`
-- את רשימת המנוף וחוסמת "בוצע" בלעדיה. לכן הכיסא חוזר ב-`checklist_kind` /
-- `checklist`, שגרסה ישנה פשוט לא קוראת.
--
-- 🔴 אין שער במסד (בשונה מ-`trg_crane_form_gate`): טכנאי על גרסה ישנה לא
-- יכול למלא את הרשימה, ושער במסד היה נועל לו כל קריאה על כיסא ממונע.
-- החובה נאכפת באפליקציה (`crane-gate.ts`). שער במסד, אם יוחלט, רק אחרי
-- שכל המכשירים על הגרסה החדשה.
--
-- הכלל "קריאה על כיסא ממונע" = המילה "ממונע" בתיאור המכשיר (`device_desc`).
-- נמדד 10/11 על 60 יום: 330 קריאות (179 משובצות), כולן כיסאות ממונעים של
-- PRIDE / SUNRISE; מחוץ לכלל נשארו רק 6 קריאות "מערכת עזר להנעה" (לא כיסא).
-- ════════════════════════════════════════════════════════════════════════

-- 24/11/2026: + `chair_delivery`, טופס ההוראות והבטיחות באספקת כיסא ממונע (ראה `stop_chair_delivery` למטה).
alter table public.crane_forms drop constraint if exists crane_forms_form_type_check;
alter table public.crane_forms add constraint crane_forms_form_type_check
  check (form_type in ('inspection', 'training', 'chair_inspection', 'chair_delivery'));

comment on table public.crane_forms is
  'טפסי בדיקה והדרכה חתומים. inspection = רשימת בדיקה למנוף, training = אישור הדרכה למנוף, '
  'chair_inspection = רשימת בדיקה לכיסא ממונע, chair_delivery = הוראות ובטיחות באספקת כיסא ממונע. ללא עדכון וללא מחיקה: טופס חתום שניתן לערוך אינו חתום.';

-- איזו רשימת בדיקה (שאינה של מנוף) העצירה דורשת. null = אין.
create or replace function public.stop_checklist_kind(s public.calendar_stops)
returns text
language sql stable security definer
set search_path = public
as $$
  select case
           when c.device_name ~* '^G[0-9]{3}E?$' then null   -- מנוף: `stop_crane_kind`
           when c.device_desc ~ 'ממונע' then 'chair_inspection'
         end
    from (select 1) x
    left join public.service_calls c on c.id = s.service_call_id;
$$;
revoke all on function public.stop_checklist_kind(public.calendar_stops) from public, anon;
grant execute on function public.stop_checklist_kind(public.calendar_stops) to authenticated;

-- ─── אספקת כיסא ממונע (עמי ומיכאל 23/11/2026, הכרעת עידן 24/11) ─────────────
-- באספקה של כיסא ממונע הלקוח חותם על "הוראות הפעלה, בטיחות, תחזוקה ואחריות"
-- (`src/lib/chair-delivery.ts`). תזכורת לפני "סופק", לא חסימה: אין שער במסד.
-- הכלל: שורה בהזמנה שהתיאור שלה מתחיל ב"כסא ממונע" / "כסא גלגלים ממונע".
-- 🔴 לא "ממונע" בכל מקום: אביזרים נושאים את המילה ("חגורת אגן- ממונע Q400",
-- "Tilt חשמלי- ממונע"). נמדד 24/11 על 120 יום: 23 מ-721 עצירות אספקה, אפס אביזר בלבד.
-- מחזיר {kind, desc, part, serial} של שורת הכיסא, או null.
create or replace function public.stop_chair_delivery(s public.calendar_stops)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('kind', 'chair_delivery', 'desc', i->>'desc', 'part', i->>'part',
                            'serial', nullif(trim(coalesce(i->>'serial', '')), ''))
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i
   where o.id = s.order_id
     and s.source_type in ('delivery', 'customer')
     and coalesce(i->>'desc', '') ~ '^[^א-ת]*(כסא|כיסא)( גלגלים)? ממונע'
   limit 1;
$$;
revoke all on function public.stop_chair_delivery(public.calendar_stops) from public, anon;
grant execute on function public.stop_chair_delivery(public.calendar_stops) to authenticated;

-- מצב הטפסים לרשימת עצירות: שתי עמודות נוספות. שינוי טיפוס ההחזרה מחייב drop.
drop function if exists public.stops_form_status(uuid[]);
create function public.stops_form_status(p_stop_ids uuid[])
returns table (
  stop_id uuid, form_signed boolean, crane_kind text, crane_signed boolean,
  checklist_kind text, checklist_signed boolean,
  chair_delivery boolean, chair_delivery_signed boolean
)
language sql stable security definer
set search_path = public
as $$
  -- ⭐ 18/10/2026: תעודת משלוח חתומה (`delivery_note`) היא לא טופס הקופה,
  -- ולא מכבה את התזכורת "טופס קופה חסר". המצב שלה ב-`stops_delivery_notes`.
  select s.id,
         exists (select 1 from public.signed_forms f
                  where f.stop_id = s.id and f.form_key <> 'delivery_note'),
         public.stop_crane_kind(s),
         -- 24/11/2026: רק טופס מנוף מכבה את שער המנוף, לא טופס כיסא באותה עצירה.
         exists (select 1 from public.crane_forms cf
                  where cf.stop_id = s.id and cf.form_type in ('inspection', 'training')),
         k.kind,
         k.kind is not null and exists (select 1 from public.crane_forms cf
                                         where cf.stop_id = s.id and cf.form_type = k.kind),
         -- 24/11/2026: עמודות חדשות, גרסת אפליקציה ישנה לא קוראת אותן.
         public.stop_chair_delivery(s) is not null,
         exists (select 1 from public.crane_forms cf where cf.stop_id = s.id and cf.form_type = 'chair_delivery')
    from public.calendar_stops s
    cross join lateral (select public.stop_checklist_kind(s) as kind) k
   where s.id = any(p_stop_ids)
     and public.stop_read_access(s) is true;
$$;
revoke all on function public.stops_form_status(uuid[]) from public, anon;
grant execute on function public.stops_form_status(uuid[]) to authenticated;

-- `stop_form_context` (20261016_signed_forms.sql) מחזירה מ-10/11 גם `checklist`:
-- {kind, serial, model} לקריאה על כיסא ממונע. ההגדרה המלאה שם.
