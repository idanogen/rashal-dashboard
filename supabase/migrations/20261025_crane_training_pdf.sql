-- ═══════════════════════════════════════════════════════════════════════════
-- טופס ההדרכה למנוף מקבל PDF ונכנס לכרטיס הלקוח בפריוריטי (25/10/2026)
--
-- עמי צילם את טופס האספקה של לוזון ושאל "איפה אני רואה את הטפסים האלה":
-- טפסי המנוף נשמרו עד היום רק כשורה ב-`crane_forms`, בלי PDF, בלי צירוף
-- לפריוריטי ובלי מסך שמציג אותם. מהיום טופס הדרכה חתום מקבל PDF (נבנה
-- בלקוח, כמו טפסי הקופות), עולה לדלי `signed-forms` תחת `<stop_id>/`,
-- ונרשם אירוע שהצינור הקיים דוחף לכרטיס הלקוח (CUSTEXTFILE_SUBFORM).
--
-- ⭐ שני צעדים ולא אחד: ההכנסה ל-`crane_forms` נשארת כמו שהיא (תאימות
-- אחורה לאפליקציה בגרסת OTA ישנה), וה-PDF מצורף אחריה בקריאה נפרדת.
-- כשל בצירוף לא מפיל את הטופס החתום: החתימה כבר נשמרה.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.crane_forms add column if not exists pdf_path text;
alter table public.crane_forms add column if not exists priority_event_id text;

-- ─── צירוף ה-PDF לטופס מנוף שכבר נשמר ────────────────────────────────────
--
-- אותן בדיקות כמו `submit_signed_form`: ההרשאה דרך העצירה, והנתיב חייב
-- להתחיל במזהה העצירה (אחרת נהג יכול היה לצרף קובץ לטופס של מישהו אחר).
-- 🔴 ה-RLS על `crane_forms` אוסר עדכון בכוונה (טופס חתום לא נערך); העדכון
-- כאן הוא security definer, נוגע רק ב-`pdf_path`/`priority_event_id`, ורק
-- כשהם עדיין ריקים. תוכן הטופס לא ניתן לשינוי גם מכאן.
create or replace function public.attach_crane_form_pdf(
  p_form_id uuid,
  p_pdf_path text,
  p_file_des text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_form  public.crane_forms;
  v_stop  public.calendar_stops;
  v_event text := gen_random_uuid()::text;
  v_cust  text;
  v_rows  integer;
begin
  select * into v_form from public.crane_forms where id = p_form_id;
  if not found then raise exception 'crane form not found'; end if;
  if v_form.stop_id is null then raise exception 'crane form has no stop'; end if;

  select * into v_stop from public.calendar_stops where id = v_form.stop_id;
  if not found or public.stop_form_access(v_stop) is not true then
    raise exception 'not authorized';
  end if;
  if p_pdf_path is null or p_pdf_path !~ ('^' || v_stop.id::text || '/') then
    raise exception 'pdf path must start with the stop id';
  end if;

  update public.crane_forms
     set pdf_path = p_pdf_path
   where id = p_form_id and pdf_path is null;
  get diagnostics v_rows = row_count;
  -- עדכון שתפס אפס שורות אינו שגיאה שקטה: PDF כבר מצורף, לא דורסים.
  if v_rows = 0 then raise exception 'pdf already attached'; end if;

  v_cust := coalesce(nullif(trim(v_form.customer_number), ''),
                     nullif(trim(v_stop.customer_number), ''),
                     (select nullif(trim(customer_number), '') from public.orders where id = v_form.order_id));

  -- בלי מספר לקוח, או לקוח שאין לו כרטיס אצלנו (לקוח בדיקה), אין לאן לצרף
  -- בפריוריטי. הטופס וה-PDF נשמרים אצלנו בכל מקרה (כמו ב-submit_signed_form).
  if v_cust is not null and exists (select 1 from public.priority_customers where custname = v_cust) then
    insert into public.timeline_events (
      id, order_id, service_call_id, calendar_stop_id, customer_number, type, user_id, user_name,
      content, files, metadata)
    values (
      v_event, v_form.order_id, v_form.service_call_id, v_form.stop_id, v_cust, 'file_upload', 'driver-app',
      coalesce(v_form.technician_name, v_stop.driver),
      'טופס נחתם: ' || coalesce(p_file_des, 'טופס מנוף'), array[coalesce(p_file_des, 'טופס מנוף') || '.pdf'],
      jsonb_build_object('fileUrls', jsonb_build_array('sb://signed-forms/' || p_pdf_path),
                         'fileDes', p_file_des, 'craneFormId', p_form_id, 'formKey', 'crane-' || v_form.form_type));
    update public.crane_forms set priority_event_id = v_event where id = p_form_id;
  end if;
end;
$$;
revoke all on function public.attach_crane_form_pdf(uuid, text, text) from public, anon;
grant execute on function public.attach_crane_form_pdf(uuid, text, text) to authenticated;

-- ─── אספקות מנוף שנסגרו בלי אישור הדרכה חתום (לוואצ'דוג) ─────────────────
--
-- טופס המנוף בכוונה אינו חוסם סגירת עצירה (נהג שהלקוח לא בבית חייב לסגור),
-- ולכן העצירה של לוזון (22/10) נסגרה בלי הדרכה ואף אחד לא ידע. מהיום
-- הוואצ'דוג מתריע. אותו כלל זיהוי מנוף כמו `lib/crane-identity.ts` וכמו
-- `stop_form_context`: המק"ט, לא התיאור.
-- שעתיים חסד אחרי הסגירה, כי הטכנאי ממלא לפעמים את הטופס אחרי שסימן בוצע.
create or replace function public.crane_training_missing()
returns table (
  stop_id uuid, customer_name text, customer_number text, driver text,
  delivery_date date, completed_at timestamptz, order_docno text, crane_model text
)
language sql stable security definer
set search_path = public
as $$
  select s.id, s.customer_name, s.customer_number, s.driver,
         s.delivery_date, s.completed_at, o.priority_order_id,
         (select i->>'part' from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i
           where coalesce(i->>'part', '') ~* '^G[0-9]{3}E?$' limit 1)
    from public.calendar_stops s
    join public.orders o on o.id = s.order_id
   where s.status = 'completed'
     and s.service_call_id is null
     and s.completed_at between now() - interval '7 days' and now() - interval '2 hours'
     and exists (select 1 from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i
                  where coalesce(i->>'part', '') ~* '^G[0-9]{3}E?$')
     and not exists (select 1 from public.crane_forms cf
                      where cf.form_type = 'training'
                        and (cf.stop_id = s.id or cf.order_id = s.order_id))
   order by s.completed_at;
$$;
revoke all on function public.crane_training_missing() from public, anon, authenticated;
