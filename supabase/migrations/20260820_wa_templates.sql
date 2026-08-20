-- מחסנית התבניות של החלונית, כטבלה ולא כקוד.
-- הוחל בפרודקשן 20/08/2026. ראה STATUS.md, סבב 20/08 ערב.
--
-- 🔴 הבעיה: המרשם היה קשיח בקוד, ולכן תבנית חדשה דרשה פריסה. ל-heyy אין
-- API לתבניות (נבדק חי: ארבעה נתיבים מחזירים 404), אז ממילא אי אפשר
-- למשוך את הרשימה משם. הטבלה היא המקום היחיד, ומנהל מוסיף שורה במסך.
--
-- ⭐ המשתנים **נגזרים מהנוסח** ולא נשמרים בנפרד. שני שדות שמתארים את
-- אותו דבר מתפצלים בשקט, ואז החלונית מבקשת שדה שהתבנית לא מכירה, heyy
-- לא מתלוננת, והערך מגיע ללקוח כחור בטקסט.
create table if not exists public.wa_templates (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,
  heyy_template_id    text not null,
  name                text not null,
  label               text not null,
  -- 🔴 הקטגוריה שמטא קבעה **אחרי האישור**, לא זו שהוגשה.
  category            text not null default 'utility'
                      check (category in ('utility', 'marketing')),
  body_preview        text not null,
  has_document_header boolean not null default false,
  active              boolean not null default true,
  sort_order          int not null default 100,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists wa_templates_active_idx on public.wa_templates (active, sort_order);
alter table public.wa_templates enable row level security;

create policy wa_templates_read on public.wa_templates
  for select to authenticated using (true);

-- 🔴 כתיבה דרך השרת בלבד. תבנית היא הרשאה לשלוח בשם החברה.
create policy wa_templates_write on public.wa_templates
  for all to service_role using (true) with check (true);

create trigger wa_templates_updated_at before update on public.wa_templates
  for each row execute function public.set_updated_at();
