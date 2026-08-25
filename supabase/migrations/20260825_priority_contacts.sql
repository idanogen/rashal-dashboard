-- אנשי הקשר של הלקוח, מתוך `CUSTPERSONNEL_SUBFORM` בפריוריטי.
--
-- 🔴🔴 **הבעיה שזה פותר, וזה לא "עוד שדה".** אצל ר.שעל הלקוח הוא
-- מטופל, ומי שכותב בוואטסאפ הוא בן משפחה עם טלפון משלו. נמדד
-- 25/08/2026: **13 מתוך 38 השיחות, שליש מהתיבה, היו "לא מזוהות"**,
-- והנציגה ראתה "לא רשום אצלנו ציוד" על לקוחה שיש לה מנוף שסופק שבוע
-- קודם. הטלפון של בן המשפחה יושב **כאן**, ולא בכרטיס הלקוח.
--
-- ⭐ **וזה השתנה אצל הלקוח לאחרונה.** נמדד דרך `dry=1` בארבעה חלונות:
-- לקוחות שנפתחו ב-2014 ← 22% עם אנשי קשר · 2019 ← 21% · **2024 ← 92%** ·
-- 2026 ← 76%. ר.שעל התחילו למלא את זה ברצינות סביב 2023, ולכן דווקא
-- הלקוחות שכותבים לנו היום מכוסים. בית הידע של רוני תוקן בהתאם.
--
-- 🔴 **המלכודת של פריוריטי:** בתת-הטופס `PHONE` הוא **מזהה שורה פנימי**
-- (integer), לא טלפון. הטלפון האמיתי ב-`CELLPHONE` / `PHONENUM` /
-- `OFFICEPHONE`. לקח מאומת של רוני, 12/07/2026.

create table if not exists public.priority_contacts (
  custname     text not null,
  name         text not null default '',
  position_des text,
  cellphone    text,
  phonenum     text,
  officephone  text,
  email        text,
  status_des   text,
  synced_at    timestamptz not null default now(),
  -- 🔴 **אין בתת-הטופס מזהה יציב שאפשר לסמוך עליו** (`PHONE` הפנימי
  -- משתנה בין סביבות), ולכן המפתח נגזר מהתוכן.
  contact_key  text generated always as (
    lower(btrim(coalesce(name, ''))) || '|' || coalesce(btrim(cellphone), '')
  ) stored,
  primary key (custname, contact_key)
);

comment on table public.priority_contacts is
  'אנשי קשר של לקוח מפריוריטי. הטלפון של בן המשפחה שכותב בוואטסאפ יושב כאן, לא בכרטיס הלקוח.';

-- ── חיפוש לפי טלפון ─────────────────────────────────────
--
-- ⭐ **שורה לכל טלפון, ולא שורה לכל איש קשר.** לאיש קשר אחד יכולים
-- להיות נייד, קווי ומשרד, וכולם מספרים שממנו הוא עשוי לכתוב.
create or replace view public.contact_phones as
  select c.custname, c.name, c.position_des, p.phone_local, p.kind
    from public.priority_contacts c
    cross join lateral (
      values ('cell', public.wa_normalize_phone(c.cellphone)),
             ('landline', public.wa_normalize_phone(c.phonenum)),
             ('office', public.wa_normalize_phone(c.officephone))
    ) as p(kind, phone_local)
   where p.phone_local is not null and p.phone_local <> '';

comment on view public.contact_phones is
  'שורה לכל טלפון של איש קשר. זו נקודת החיפוש: טלפון ← לקוח.';

create index if not exists priority_contacts_cell_idx
  on public.priority_contacts (public.wa_normalize_phone(cellphone));
create index if not exists priority_contacts_phonenum_idx
  on public.priority_contacts (public.wa_normalize_phone(phonenum));
create index if not exists priority_contacts_office_idx
  on public.priority_contacts (public.wa_normalize_phone(officephone));
create index if not exists priority_contacts_custname_idx
  on public.priority_contacts (custname);

-- ── הרשאות ──────────────────────────────────────────────
--
-- 🔴 **קריאה לעובדי משרד בלבד, וכתיבה דרך השרת בלבד.** אלה טלפונים של
-- בני משפחה של מטופלים. `anon` לא מקבל דבר, ולאף תפקיד אין מדיניות
-- כתיבה: הסנכרון עובר ב-service_role.
alter table public.priority_contacts enable row level security;
revoke all on public.priority_contacts from anon, authenticated;
grant select on public.priority_contacts to authenticated;
grant select on public.contact_phones to authenticated;

drop policy if exists contacts_read_office on public.priority_contacts;
create policy contacts_read_office on public.priority_contacts
  for select to authenticated
  using (public.is_office_staff());
