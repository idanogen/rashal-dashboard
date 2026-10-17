-- ─── מתג "מקבל הודעות אוטומטיות" לכל מספר של הלקוח (עידן, 13/10/2026) ─────
--
-- הרקע: מ-06/09 ההודעות האוטומטיות (בקשת תמונה, "בדרך אליך", סקר) יוצאות
-- לטלפון הראשי וגם לכל מספר שקישרנו ללקוח (`customer_contacts`), בלי אפשרות
-- לבחור. עידן, כשבנינו "שלח למספר אחר" מהתיבה: "הוא יקבל את ההודעות אבל
-- יהיה מנגנון שיאפשר להעביר למספר השני", והבחירה הייתה מתג ליד כל מספר.
--
-- ⭐ המודל: שורה ב-`customer_auto_muted` = המספר הזה לא מקבל הודעות
-- אוטומטיות של הלקוח הזה. בלי שורה = מקבל (ברירת המחדל לא השתנתה). אותה
-- טבלה לראשי ולמקושרים, כי ה"ראשי" הוא רק המספר שעל הרשומה.
--
-- 🔴 לעולם לא אפס נמענים: אם כל המספרים כבויים, יוצא לראשי כמו קודם. המסך
-- גם לא נותן לכבות את האחרון, אבל השולח לא סומך על המסך.

create table if not exists public.customer_auto_muted (
  customer_number text not null,
  phone_e164      text not null,
  muted_by        text,
  muted_at        timestamptz not null default now(),
  primary key (customer_number, phone_e164)
);

alter table public.customer_auto_muted enable row level security;
drop policy if exists office_read_customer_auto_muted on public.customer_auto_muted;
create policy office_read_customer_auto_muted on public.customer_auto_muted
  for select to authenticated using ((select public.is_office_staff()));
-- כתיבה רק דרך `customer_set_auto_messages`.

-- ─── מי מקבל: מערך מסודר, הראשון הוא "הנמען" והשאר נוספים ─────────────────
-- הראשי קודם (אם לא כבוי), אחריו המקושרים שאינם כבויים. ריק → הראשי.
create or replace function public.customer_auto_recipients(p_customer text, p_main text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  with cand as (
    select p_main as p, 0 as ord where p_main is not null and p_main <> ''
    union all
    select cc.phone_e164, 1 from public.customer_contacts cc
     where p_customer is not null and cc.customer_number = p_customer
       and cc.phone_e164 ~ '^\+9725\d{8}$'
  ), live as (
    select distinct on (c.p) c.p, c.ord from cand c
     where not exists (select 1 from public.customer_auto_muted m
                        where m.customer_number = p_customer and m.phone_e164 = c.p)
     order by c.p, c.ord
  )
  select coalesce((select array_agg(l.p order by l.ord, l.p) from live l),
                  case when p_main is null or p_main = '' then '{}'::text[] else array[p_main] end);
$$;
revoke all on function public.customer_auto_recipients(text, text) from public, anon, authenticated;
grant execute on function public.customer_auto_recipients(text, text) to service_role;

-- `customer_extra_phones` נשארת לתאימות ומכבדת את המתג. ההגדרה ב-20260906.

-- ─── הדלת: הפעלה וכיבוי מהמסך ─────────────────────────────────────────────
-- משרד שעובד (לא צופה ולא נהג). מחזירה {"result":"muted"|"unmuted"}.
-- שגיאות: 'not authorized' · 'not a mobile number' · 'last recipient'.
create or replace function public.customer_set_auto_messages(p_customer text, p_phone text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local  text;
  v_e164   text;
  v_main   text;
  v_author text;
  v_live   int;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (public.current_user_role() in ('admin', 'team_manager', 'dispatcher', 'management')) is not true then
    raise exception 'not authorized';
  end if;
  if p_customer is null or btrim(p_customer) = '' then
    raise exception 'no customer';
  end if;
  v_local := public.wa_normalize_phone(p_phone);
  if v_local is null or v_local !~ '^05\d{8}$' then
    raise exception 'not a mobile number';
  end if;
  v_e164 := '+972' || substr(v_local, 2);

  if p_enabled is true then
    delete from public.customer_auto_muted where customer_number = p_customer and phone_e164 = v_e164;
    return jsonb_build_object('result', 'unmuted', 'phone_local', v_local);
  end if;

  -- 🔴 לא מכבים את האחרון: הראשי בכרטיס + המקושרים, פחות הכבויים ופחות זה.
  select public.wa_normalize_phone(c.phone) into v_main
    from public.priority_customers c where c.custname = p_customer;
  select count(*) into v_live from (
    select '+972' || substr(v_main, 2) as p where v_main ~ '^05\d{8}$'
    union
    select cc.phone_e164 from public.customer_contacts cc
     where cc.customer_number = p_customer and cc.phone_e164 ~ '^\+9725\d{8}$'
  ) x
  where x.p <> v_e164
    and not exists (select 1 from public.customer_auto_muted m
                     where m.customer_number = p_customer and m.phone_e164 = x.p);
  if v_live = 0 then
    raise exception 'last recipient';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.username, 'משתמש') into v_author
    from public.profiles p where p.id = auth.uid();
  insert into public.customer_auto_muted (customer_number, phone_e164, muted_by)
  values (p_customer, v_e164, coalesce(v_author, 'משתמש'))
  on conflict (customer_number, phone_e164) do nothing;
  return jsonb_build_object('result', 'muted', 'phone_local', v_local);
end;
$$;
revoke all on function public.customer_set_auto_messages(text, text, boolean) from public, anon;
grant execute on function public.customer_set_auto_messages(text, text, boolean) to authenticated, service_role;

-- ─── שינויים בפונקציות קיימות (ההגדרה בקובץ המקורי של כל אחת) ──────────────
-- 🔴 כל פונקציה מוגדרת בקובץ אחד בלבד (test/migrations.test.mjs), ולכן הגרסאות
-- החדשות נכתבו במקום הישנות:
--   customer_phone_book (20261008): מחזירה גם את הכבויים, כשורות 'muted'. בלי
--     שינוי בצורת התשובה, כדי שאפליקציית הנהגים (שמסננת linked/priority) לא תישבר.
--   customer_extra_phones (20260906): מדלגת על מספרים כבויים.

--   media_claim_due (20260830) · survey_claim_due (20260820) · on_way_claim (20260831):
--   הנמען הראשון ממערך הנמענים (`customer_auto_recipients`), השאר כ-extra_phones.
-- עד היום: phone_e164 = הטלפון שעל הרשומה, extra_phones = המקושרים.
-- מעכשיו: אם הראשי כבוי, הנמען הוא המקושר הראשון שפעיל. פונקציות הקצה לא
-- משתנות: הן שולחות ל-phone_e164 ואז לכל extra_phones.
