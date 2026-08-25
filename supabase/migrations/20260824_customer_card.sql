-- כרטיס לקוח מאוחד: שכבת הזיהוי, וכל מה שקשור ללקוח אחד.
--
-- 🔴🔴 **הבעיה שזה פותר, כלשונו של עידן (24/08/2026):** "אני רוצה מקום
-- שירכז לי את ההיסטוריה של הפעילות עם הלקוח... וכך כאשר לקוח מתקשר
-- לנציג יש את כל המידע מול העיניים, כולל האם יש משלוח פתוח ואם כן האם
-- הוא שובץ לאספקה או לא."
--
-- 🔴🔴 **ולמה זה לא מחובר לפי מספר לקוח.** נמדד לפני הבנייה:
--   הזמנות        3,070 מתוך 7,477 עם מספר לקוח  (‎59% בלי)
--   קריאות שירות  2,971 מתוך 6,857                (‎57% בלי)
--   שיבוצים ביומן     1 מתוך   840                (אין מה לחבר)
--   סקרים             0 מתוך    29
-- מסך שמחבר לפי מספר לקוח בלבד היה מציג כחצי מההיסטוריה **ונראה שלם**,
-- והנציג היה אומר ללקוח "אין לך שום קריאה פתוחה" בקול בטוח.
--
-- ⭐ **לכן שלושה מפתחות בסדר יורד, וכל רשומה נושאת את הוודאות שלה:**
--   number ← מספר לקוח, ודאי
--   phone  ← טלפון מנורמל, כמעט ודאי
--   name   ← שם מדויק, השערה שמסומנת ככזאת במסך
--
-- 🔴 **והכלל שמונע את רוב טעויות הזיהוי: רשומה שיש עליה מספר לקוח אחר
-- שייכת למישהו אחר, נקודה.** התאמה לפי טלפון או שם נבדקת רק על רשומות
-- שאין עליהן מספר כלל. בלי הכלל הזה, לקוח עם אותו שם היה בולע את התיק
-- של השני.

-- 🔴 **ורשומה מאורכבת אינה רשומה שנעלמה.** באוגוסט 2026 אורכבו כאן
-- אלפי הזמנות וקריאות ישנות, וזו בדיוק ההיסטוריה שהמסך הזה נועד
-- להציג. לכן הזהות אינה מסננת אותן, והן מופיעות בציר הפעילות. הן
-- **לא** נספרות כפתוחות, אלא אם יש להן עצירה פעילה ביומן: עצירה כזאת
-- פירושה שנהג עדיין אמור לנסוע לשם.
-- נמדד: לקוח 013272224 מחזיק הזמנה מאורכבת עם עצירה מתוכננת ל-14/06.

-- ── מי רשאי ─────────────────────────────────────────────
-- ⭐ אותה קבוצה שרואה את מסכי המשרד ב-`lib/screen-access.ts`, כולל
-- "צפייה בלבד". 🔴 נהג **לא** נכלל: הוא רואה את הנסיעה שלו, לא את
-- התיק המלא של הלקוח.
create or replace function public.is_office_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  -- ⭐ קריאת שרת: `api/priority-context` רץ עם service_role ומעביר את
  -- הכרטיס לחלונית שבתוך פריוריטי. הוא כבר דורש משתמש מחובר בעצמו
  -- (`requireUser`), ולכן ההרשאה נאכפת שם. מפתח ה-service בשרת בלבד.
  select coalesce(auth.role(), '') = 'service_role'
      or public.current_user_role() in ('admin', 'team_manager', 'dispatcher', 'viewer');
$$;

comment on function public.is_office_staff() is
  'עובד משרד: admin · team_manager · dispatcher · viewer. נהג אינו נכלל.';

-- ── חיפוש לקוח ──────────────────────────────────────────
--
-- מקבל מה שהנציג הקליד: טלפון, מספר לקוח, שם, או מספר מסמך.
--
-- ⭐ **מספר מסמך הוא נקודת כניסה אמיתית ולא קישוט:** לקוח מתקשר עם
-- תעודה ביד ומקריא את המספר שעליה.
-- 🔴 ברירת המחדל הועלתה מ-12 ל-25 ב-25/08/2026. עידן: "בחיפוש
-- קורן אני מצפה גם למצוא שלומי קורן." יש 28 לקוחות שהשם שלהם מכיל
-- "קורן", 15 מהם מתחילים בו, והתקרה של 12 חתכה בדיוק את מי שהשם
-- הפרטי שלו קדם. **הדירוג היה נכון והתקרה הסתירה אותו.**
create or replace function public.customer_search(p_query text, p_limit int default 25)
returns table (
  customer_number text,
  customer_name   text,
  phone           text,
  phone_local     text,
  city            text,
  match_kind      text,
  score           int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  q      text := btrim(coalesce(p_query, ''));
  digits text;
  norm   text;
  lim    int  := least(greatest(coalesce(p_limit, 12), 1), 50);
begin
  if public.is_office_staff() is not true then
    raise exception 'not authorized';
  end if;
  if q = '' then
    return;
  end if;

  digits := regexp_replace(q, '\D', '', 'g');
  norm   := public.wa_normalize_phone(q);

  return query
  with hits as (
    -- מספר לקוח מדויק
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'number'::text as match_kind, 100 as score
      from public.customer_directory d
     where d.customer_number = q or (digits <> '' and d.customer_number = digits)

    union all
    -- טלפון. 🔴 **המפתח החזק בפועל:** נמדד ב-24/08/2026 שמתוך 4,853
    -- מספרי טלפון, 4,774 מובילים ללקוח אחד ויחיד ורק 79 משותפים.
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'phone', 95
      from public.customer_directory d
     where norm is not null and d.phone_local = norm

    union all
    -- מספר מסמך: הזמנה · קריאת שירות · איסוף · תעודת משלוח
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'document', 90
      from public.customer_directory d
     where length(q) >= 4
       and d.customer_number in (
             select o.customer_number from public.orders o
              where upper(o.priority_order_id) = upper(q) and coalesce(o.customer_number,'') <> ''
             union all
             select c.customer_number from public.service_calls c
              where upper(c.priority_call_id) = upper(q) and coalesce(c.customer_number,'') <> ''
             union all
             select p.customer_number from public.pickups p
              where p.priority_doc::text = digits and coalesce(p.customer_number,'') <> ''
             union all
             select n.customer_number from public.delivery_notes n
              where n.priority_doc::text = digits and coalesce(n.customer_number,'') <> ''
           )

    union all
    -- שם.
    --
    -- 🔴🔴 **תחילת מילה, ולא תחילת שורה.** עידן, 25/08/2026: "בחיפוש
    -- קורן אני מצפה גם למצוא שלומי קורן." הדירוג הקודם נתן 70 רק למי
    -- שהשם שלו **מתחיל** ב"קורן", ו-50 לכל השאר. ומכיוון שיש עשרות
    -- לקוחות בשם "קורן משהו", הם מילאו את כל שתים-עשרה השורות
    -- ו"שלומי קורן" לא הופיע לעולם. הדירוג היה נכון והתקרה הסתירה אותו.
    --
    -- ⭐ בעברית שם מלא הוא שתי מילים בשני סדרים ("קורן אורית" מול
    -- "שלומי קורן"), ולכן ההתאמה הנכונה היא לתחילת **כל מילה**.
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'name',
           case
             when d.customer_name ilike q || '%' then 72
             when d.customer_name ~* ('(^|\s)' || regexp_replace(q, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g')) then 70
             else 50
           end
      from public.customer_directory d
     where length(q) >= 2 and d.customer_name ilike '%' || q || '%'

    union all
    -- חלק ממספר טלפון. 🔴 לפחות ארבע ספרות: שלוש מחזירות חצי מהתיבה
    -- וזה נראה כמו חיפוש שבור.
    select d.customer_number, d.customer_name, d.phone, d.phone_local, d.city,
           'phone-part', 60
      from public.customer_directory d
     -- ⭐ על העמודה המחושבת שבמחסן, כדי שהאינדקס יעבוד.
     where length(digits) between 4 and 9
       and d.phone_digits like '%' || digits || '%'
  )
  select h.customer_number, h.customer_name, h.phone, h.phone_local, h.city,
         (array_agg(h.match_kind order by h.score desc))[1],
         max(h.score)
    from hits h
   group by h.customer_number, h.customer_name, h.phone, h.phone_local, h.city
   order by max(h.score) desc, h.customer_name
   limit lim;
end;
$$;

comment on function public.customer_search(text, int) is
  'חיפוש לקוח לפי טלפון · מספר לקוח · שם · מספר מסמך. מחזיר מועמדים עם סוג ההתאמה.';

-- ── הכרטיס עצמו ─────────────────────────────────────────
-- ── כרטיס הלקוח: ההגדרה **אינה כאן** ────────────────────
--
-- 🔴🔴 **`customer_card` מוגדרת אך ורק ב-`20260825_customer_stock.sql`.**
-- עד 25/08/2026 היא הייתה כתובה בשני הקבצים, ובאותו יום זה נשך: הרצתי
-- את הקובץ הזה אחרי הקובץ החדש כדי לתקן את דירוג החיפוש, והחזרתי בלי
-- לשים לב גרסה ישנה של הכרטיס. **התוצאה הייתה ש"מה יש אצל הלקוח" חזר
-- ריק לכל לקוח במערכת**, בלי שגיאה ובלי סימן, עד שעידן שם לב.
--
-- ⭐ פונקציה מוגדרת בקובץ אחד בלבד. `test/migrations.test.mjs` אוכף
-- את זה. [[dual_implementation_needs_byte_identical_guard]]

-- 🔴 **הרשאה מפורשת לתפקיד המחובר בלבד.** `anon` לא מקבל דבר: מדובר
-- בתיק המלא של מטופל.
revoke all on function public.customer_search(text, int) from public, anon;
revoke all on function public.customer_card(text, text) from public, anon;
grant execute on function public.customer_search(text, int) to authenticated;
grant execute on function public.customer_card(text, text) to authenticated;

-- אינדקסים לחיפושי הזהות. הטבלאות קטנות, אבל הכרטיס נפתח בזמן שלקוח
-- על הקו ולכן שווה שהוא ייפתח מיד.
create index if not exists orders_customer_number_idx        on public.orders (customer_number);
create index if not exists service_calls_customer_number_idx on public.service_calls (customer_number);
create index if not exists pickups_customer_number_idx       on public.pickups (customer_number);
create index if not exists delivery_notes_customer_idx       on public.delivery_notes (customer_number);
