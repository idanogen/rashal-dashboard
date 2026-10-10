-- ─── ספר הטלפונים של הלקוח: לראות ולהוסיף ביד (עמי, 06-07/10/2026) ──────────
--
-- הבקשה: "לתת אופציה לשלוח תבנית (אנא שלח תמונות) למספר נוסף שהלקוח מוסר
-- לי בנוסף למספרים שיש במערכת", ו"שאני יכול לעדכן נייד נוסף או חדש, וכנ"ל
-- הטכנאי".
--
-- ⭐ המנגנון כבר קיים מ-06/09: `customer_contacts` הוא היעד של כל ההודעות
-- האוטומטיות (בקשת תמונות, תזכורת, סקר) בנוסף לטלפון הראשי, ומה שנכנס לשם
-- נכתב גם לפריוריטי כאיש קשר (`priority_contact_candidates` → CUSTPERSONNEL).
-- מה שחסר היה **דלת ידנית**: עד היום מספר נכנס רק מתוך שיחת וואטסאפ שנכנסה.
-- שתי הפונקציות כאן הן הדלת: אחת לקרוא את הספר, אחת להוסיף מספר.
--
-- 🔴 מספר "חדש" לא מחליף את הטלפון בכרטיס הלקוח בפריוריטי. אנחנו לא כותבים
-- לכרטיס הלקוח, רק לאנשי הקשר שלו. המסך אומר את זה במילים.
--
-- הרשאה: `driver_customer_visible(p_customer)` מחזירה true למשרד, ולנהג רק
-- כשהלקוח הזה בסידור שלו ב-30 הימים האחרונים. אותו שומר שמגן על תמונות
-- הוואטסאפ, ולכן גם הטכנאי באפליקציה יוכל להוסיף מספר מהשטח.

-- ─── קריאה: הטלפון הראשי, מה שקישרנו, ומה שיש בפריוריטי ─────────────────
-- 'linked'   = customer_contacts: יעד להודעות אוטומטיות, נכתב לפריוריטי.
-- 'priority' = אנשי קשר מפריוריטי (priority_contacts): לזיהוי נכנס בלבד,
--              לא יעד להודעות (החלטת 06/09: לרוב פיזיותרפיסט או הנהלת חשבונות).
create or replace function public.customer_phone_book(p_customer text)
returns table (
  kind               text,
  phone_local        text,
  label              text,
  created_by         text,
  created_at         timestamptz,
  priority_pushed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.driver_customer_visible(p_customer) is not true then
    raise exception 'not authorized';
  end if;
  return query
    select 'linked'::text, cc.phone_local, cc.label, cc.created_by, cc.created_at, cc.priority_pushed_at
      from public.customer_contacts cc
     where cc.customer_number = p_customer
    union all
    select 'priority'::text, p.phone_local,
           nullif(concat_ws(' · ', nullif(btrim(pc.name), ''), nullif(btrim(pc.position_des), '')), ''),
           null::text, pc.synced_at, null::timestamptz
      from public.priority_contacts pc
      cross join lateral (
        values (public.wa_normalize_phone(pc.cellphone)),
               (public.wa_normalize_phone(pc.phonenum)),
               (public.wa_normalize_phone(pc.officephone))
      ) as p(phone_local)
     where pc.custname = p_customer
       and p.phone_local is not null and p.phone_local <> ''
       -- מספר שכבר קישרנו לא מופיע פעמיים.
       and not exists (select 1 from public.customer_contacts x
                        where x.customer_number = p_customer and x.phone_local = p.phone_local)
     order by 1, 5;
end;
$$;
revoke all on function public.customer_phone_book(text) from public, anon;
grant execute on function public.customer_phone_book(text) to authenticated, service_role;

-- ─── הוספה ביד ────────────────────────────────────────────────────────────
-- מחזירה מה קרה, כי "הוספתי" ו"כבר היה" הם שני דברים שונים לנציג:
--   {"result":"added"|"already_linked"|"is_main_phone", "phone_local":"05..."}
-- נייד בלבד (05X): הודעות וואטסאפ לא יוצאות לקווי, ומספר שלא יקבל כלום
-- היה נראה כמו תקלה.
create or replace function public.customer_add_contact(p_customer text, p_phone text, p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local  text;
  v_main   text;
  v_author text;
  v_existing uuid;
begin
  if public.driver_customer_visible(p_customer) is not true then
    raise exception 'not authorized';
  end if;
  v_local := public.wa_normalize_phone(p_phone);
  if v_local is null or v_local !~ '^05\d{8}$' then
    raise exception 'not a mobile number';
  end if;

  select public.wa_normalize_phone(c.phone) into v_main
    from public.priority_customers c where c.custname = p_customer;
  if v_main = v_local then
    return jsonb_build_object('result', 'is_main_phone', 'phone_local', v_local);
  end if;

  select cc.id into v_existing from public.customer_contacts cc
   where cc.customer_number = p_customer and cc.phone_local = v_local;

  select coalesce(nullif(btrim(p.full_name), ''), p.username, 'משתמש') into v_author
    from public.profiles p where p.id = auth.uid();

  perform public.wa_remember_contact(p_customer, v_local, p_label, coalesce(v_author, 'משתמש'), 'linked_by_user');

  return jsonb_build_object(
    'result', case when v_existing is null then 'added' else 'already_linked' end,
    'phone_local', v_local
  );
end;
$$;
revoke all on function public.customer_add_contact(text, text, text) from public, anon;
grant execute on function public.customer_add_contact(text, text, text) to authenticated, service_role;
