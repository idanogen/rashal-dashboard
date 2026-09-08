-- הודעות בארבע שפות, שלב ב (08/09/2026): לקוח עם שפה שמורה מקבל ישר את
-- התבנית בשפה שלו. המנועים (בדרך אליך, תמונה, סקר, תיאום) שואלים את
-- `wa_pick_template` לכל נמען, ומקבלים את מזהה התבנית לשפה שלו, או את
-- ברירת המחדל (העברית, עם כפתורי השפה) כל עוד תבנית בשפה הזאת לא אושרה.
--
-- 🔴 הטבלה מתמלאת רק אחרי אישור של מטא לכל תבנית. שורה שחסרה = עברית.
create table if not exists public.wa_template_langs (
  key text not null,
  lang text not null check (lang in ('he','en','ar','ru','th')),
  heyy_template_id text not null,
  approved_at timestamptz default now(),
  primary key (key, lang)
);
alter table public.wa_template_langs enable row level security;
drop policy if exists wa_template_langs_select_office on public.wa_template_langs;
create policy wa_template_langs_select_office on public.wa_template_langs for select to authenticated using (true);

-- לנמען אחד: השפה שלו והתבנית שתישלח אליו.
create or replace function public.wa_pick_template(
  p_key text, p_phone text, p_customer text default null, p_default text default null)
returns table(lang text, template_id text)
language sql stable security definer set search_path = public as $$
  with l as (select public.wa_language_for(p_phone, p_customer) as lang)
  select l.lang,
         coalesce((select t.heyy_template_id from public.wa_template_langs t
                    where t.key = p_key and t.lang = l.lang), p_default)
    from l;
$$;

-- ערך מרשימה סגורה (טכנאי / נהג / לאספקת הציוד / המוצר שברשותך) בשפה.
create or replace function public.wa_translate_value(p_value text, p_lang text)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select body from public.wa_texts where key = 'v:' || btrim(p_value) and lang = p_lang), p_value);
$$;

revoke all on function public.wa_pick_template(text, text, text, text) from public, anon;
revoke all on function public.wa_translate_value(text, text) from public, anon;
grant execute on function public.wa_pick_template(text, text, text, text) to service_role;
grant execute on function public.wa_translate_value(text, text) to service_role;
