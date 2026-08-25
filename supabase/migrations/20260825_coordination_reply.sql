-- תשובת הלקוח על תיאום ההגעה חוזרת אל העצירה ביומן.
--
-- 🔴🔴 **הפער שזה סוגר, והוא היה שקט לגמרי.** `heyy-webhook` פירש את
-- תשובת הלקוח (`parseCustomerReply`) וכתב אותה ל-`orders`, ו**מעולם לא
-- נגע ב-`calendar_stops`**. רק הסימולטור שבדפדפן (`src/lib/heyy/db.ts`)
-- עדכן את העצירה, ולכן בדמו הכל עבד. בפרודקשן הסדרן היה רואה
-- "WA נשלח" לנצח, גם אחרי שהלקוח אישר. [[label_and_math_from_two_mechanisms]]
--
-- ⭐ הפונקציה יושבת במסד ולא בשרת, כדי שהנרמול של הטלפון יהיה **אותו
-- נרמול** שכל שאר המערכת משתמשת בו. 821 מתוך 824 העצירות עם טלפון
-- עוברות אותו.

create or replace function public.wa_apply_coordination_reply(
  p_phone  text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_local text := public.wa_normalize_phone(p_phone);
  v_new   text;
  v_stop  uuid;
begin
  if v_local is null then
    return null;
  end if;

  v_new := case p_status
             when 'מתאים'      then 'customer_confirmed'
             when 'לא מתאים'   then 'customer_rejected'
             when 'בקשת שינוי' then 'customer_change'
             else null
           end;
  if v_new is null then
    return null;
  end if;

  -- 🔴🔴 **רק עצירה ששלחנו עליה שאלה, ורק בחלון סביר.**
  -- "כן" של לקוח אינו אישור גורף: בלי התנאי הזה הוא היה מסמן עצירה
  -- אקראית שלו כמתואמת. ובמערכת הזאת יש מאות עצירות פתוחות בתאריכי
  -- עבר, ולכן בלי חלון הזמן תשובה של היום הייתה מאשרת שיבוץ מלפני
  -- חודשים. [[stale_item_is_not_a_dead_item]]
  select s.id into v_stop
    from public.calendar_stops s
   where public.wa_normalize_phone(s.phone) = v_local
     and s.status in ('planned', 'in_progress')
     and s.coordination_method = 'whatsapp'
     and s.coordination_status in ('whatsapp_sent', 'customer_confirmed',
                                   'customer_rejected', 'customer_change')
     and s.coordinated_at > now() - interval '14 days'
     and s.delivery_date >= current_date - 1
   order by s.delivery_date asc, s.coordinated_at desc
   limit 1;

  if v_stop is null then
    return null;
  end if;

  update public.calendar_stops
     set coordination_status = v_new::coordination_status,
         coordinated_at      = now()
   where id = v_stop;

  return v_stop;
end;
$$;

comment on function public.wa_apply_coordination_reply(text, text) is
  'תשובת לקוח על תיאום הגעה ← העצירה ביומן. מחזיר את מזהה העצירה, או NULL אם אין התאמה.';

revoke all on function public.wa_apply_coordination_reply(text, text)
  from public, anon, authenticated;
grant execute on function public.wa_apply_coordination_reply(text, text) to service_role;
