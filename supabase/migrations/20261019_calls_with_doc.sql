-- ═══════════════════════════════════════════════════════════════════════════
-- חיווי "יש טופס קריאה" בדשבורד (19/10/2026)
--
-- עידן: "אני רוצה שיהיה גם במערכת על המחשב שיהיה חיווי לקובץ". הדשבורד שואל
-- בבת אחת לאילו קריאות נקלט טופס מהמייל (service_call_docs), ומצייר תג על
-- הכרטיס בפאנל הקריאות ועל עצירת שירות ביומן. הטופס עצמו כבר מוצג בכרטיס
-- הקריאה (call_info_payload → 'doc').
--
-- הרשאה כמו stops_call_info_counts: משרד רואה הכל, נהג רק קריאה שיש לו
-- עצירה עליה. התשובה מחזירה רק קריאות שיש להן טופס שאינו מבוטל; מה שלא
-- חזר = אין טופס.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.calls_with_doc(p_call_ids uuid[])
returns table (call_id uuid, docno text, doc_status text)
language sql stable security definer
set search_path = public
as $$
  select sc.id, d.docno, d.status
    from public.service_calls sc
    cross join lateral public.service_call_latest_doc(sc.priority_call_id) d
   where sc.id = any(p_call_ids)
     and coalesce(cardinality(p_call_ids), 0) <= 300
     and sc.priority_call_id is not null
     and d.id is not null
     and coalesce(d.status, '') <> 'מבוטלת'
     and (
       public.is_office_staff() is true
       or (public.current_user_role() = 'driver' and exists (
             select 1
               from public.calendar_stops cs
              where cs.service_call_id = sc.id
                and cs.driver = public.current_user_driver()
                and cs.delivery_date <= public.israel_today()))
     );
$$;
revoke all on function public.calls_with_doc(uuid[]) from public, anon;
grant execute on function public.calls_with_doc(uuid[]) to authenticated;
