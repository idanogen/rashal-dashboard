-- כסף רק למי שמורשה, נאכף במסד (עידן, 09/09/2026: "לא להציג לאף אחד ערך
-- מספרי שקשור לכסף חוץ משלומי ורונן, גם לא בטעות"). הרקע: עמי ואבירם
-- (מנהלי צוות) מקבלים את דשבורד ההנהלה, ולכן כל סכום חייב להיעצר לפני
-- הדפדפן ולא רק להיות מוסתר בו.
--
-- מה כבר היה סגור: חשבוניות, חשבוניות מרכזות, קבלות ותיעוד גבייה
-- (מדיניות management_reads_*). מה דלף לכל המשרד: `delivery_notes.total_price`
-- ו-`pickups.total_price` (מדיניות authenticated_all_*), וסכומי המסמכים
-- בתוך `customer_card` (security definer, תוקן בקובץ המקור 20260825).
--
-- 🔴 הרשאת עמודה ב-Postgres היא תוספת ולא הפחתה: כל עוד יש SELECT על
-- הטבלה כולה, REVOKE על עמודה אחת לא עושה כלום. לכן: מורידים את ה-SELECT
-- הטבלאי ומעניקים SELECT על כל העמודות חוץ מהסכום. 🔴 עמודה חדשה באחת
-- משתי הטבלאות דורשת GRANT מפורש כאן, אחרת הקוד לא יראה אותה.
-- הקוד (`src/lib/documents.ts`, `src/lib/pickups.ts`) שולף עמודות מפורשות
-- ולא `*`, כי `*` מול הרשאות עמודה נכשל.

revoke select on public.delivery_notes from authenticated;
grant select (id, priority_doc_id, priority_doc, customer_number, customer_name, doc_date, status,
              invoiced, source_order, warehouse, agent, opened_by, total_qty, priority_udate,
              archived_at, archived_reason, created_at, updated_at, distributed_on)
  on public.delivery_notes to authenticated;

revoke select on public.pickups from authenticated;
revoke all on public.pickups from anon;
grant select (id, priority_pickup_id, priority_doc, customer_number, customer_name, phone, address, city,
              priority_status, pickup_date, source_order, delivery_note, reference, to_warehouse, agent,
              opened_by, total_qty, lines, priority_udate, pickup_status, duplicate_of, created_at,
              updated_at, archived_at, archived_reason)
  on public.pickups to authenticated;

-- הסכומים למי שרואה כסף, דרך פונקציה ולא דרך הטבלה, כדי שהשער יהיה אחד.
create or replace function public.delivery_note_totals(p_ids uuid[])
returns table(id uuid, total_price numeric)
language sql stable security definer set search_path = public as $$
  select n.id, n.total_price from public.delivery_notes n
   where n.id = any(p_ids) and public.is_management();
$$;
revoke all on function public.delivery_note_totals(uuid[]) from public, anon;
grant execute on function public.delivery_note_totals(uuid[]) to authenticated, service_role;
