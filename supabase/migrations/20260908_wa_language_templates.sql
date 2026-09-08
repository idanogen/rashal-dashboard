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

-- 08/09/2026 ערב: התבניות בעברית עם ארבעת כפתורי השפה הוגשו ב-heyy ואושרו.
-- שורת 'he' = "עברית עם כפתורי שפה": מה שלקוח בלי שפה שמורה מקבל.
-- (תזכורת לתמונה והזמנה לסקר ממתינות לאישור: 3c987206… ו-d42b7c89…)
insert into public.wa_template_langs (key, lang, heyy_template_id) values
  ('rashal_visit_coordination', 'he', '6de91880-1642-4ef4-8eca-2a963117bcc3'),
  ('on_the_way',                'he', '952c082c-ac62-4210-9f30-aec8ccef3883'),
  ('media_first',               'he', 'c97d0aae-894b-4c13-9a8b-cc5aa3cae7c1')
on conflict (key, lang) do update set heyy_template_id = excluded.heyy_template_id, approved_at = now();

-- מזהה → מפתח: קודם הטבלה של השפות (התבניות החדשות אינן ב-wa_templates
-- עד הסנכרון הבא), ואז המקורות הישנים.
create or replace function public.wa_template_key(p_template_id text)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select l.key from public.wa_template_langs l where l.heyy_template_id = p_template_id limit 1),
    (select regexp_replace(t.key, '_lang$', '') from public.wa_templates t where t.heyy_template_id = p_template_id limit 1),
    (select case when s.template_v2_id = p_template_id then 'on_the_way'
                 when s.template_id = p_template_id then 'on_the_way_v1' end
       from public.on_way_settings s
      where p_template_id in (s.template_id, s.template_v2_id) limit 1),
    (select case when m.template_first_id = p_template_id then 'media_first'
                 when m.template_reminder_id = p_template_id then 'media_reminder' end
       from public.media_request_settings m
      where p_template_id in (m.template_first_id, m.template_reminder_id) limit 1),
    (select 'survey_invite' from public.survey_settings v where v.template_id = p_template_id limit 1));
$$;
