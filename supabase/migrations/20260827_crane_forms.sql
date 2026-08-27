-- ראה migration שהוחל ב-Supabase: crane_forms (27/08/2026)
-- טפסי מנוף: רשימת בדיקה לטכנאי, ואישור קבלת הדרכה
--
-- 🔴 **הקובץ הזה שוחזר מהמסד ב-27/08/2026 אחרי שהתגלה שהוא חסר.**
-- המיגרציה הוחלה דרך הכלי ולא נשמרה כקובץ, ולכן המאגר הפסיק לתאר את
-- הסכימה בלי שום שגיאה. יש על זה עכשיו בדיקה ב-`test/migrations.test.mjs`.
--
-- 🔴 עידן ושלומי, 20/08/2026: "כשהנהג מגיע לבדיקת מנוף הוא צריך שיהיה
-- לו במערכת צ'קליסט למילוי", ו"באספקת מנוף הלקוח צריך לקבל מדריך
-- למשתמש ולחתום על טופס".
--
-- ⭐ **התשובות נשמרות כ-jsonb ולא כעמודות.** הטופס הוא מסמך בטיחות
-- שמשתנה עם מדריך היצרן, ועמודה לכל פריט הייתה מחייבת מיגרציה בכל
-- עדכון נוסח. `checklist_version` שמור עם כל מילוי, ולכן טופס שנחתם
-- לפני שנה נשאר קריא בדיוק כפי שנחתם.
--
-- 🔴 **והזהות נשמרת פעמיים בכוונה:** גם `crane_serial` וגם הקישור
-- לעצירה. המספר הסידורי הוא מה שמזהה את **המנוף** לאורך שנים, והעצירה
-- היא מה שמזהה את **הביקור**. אחד מהם לבדו מאבד חצי מהשאלות שנשאל
-- אחר כך. [[customer_360_identity_is_the_product]]

create table if not exists public.crane_forms (
  id uuid primary key default gen_random_uuid(),

  -- מה זה
  form_type text not null check (form_type in ('inspection', 'training')),
  checklist_version int not null default 1,

  -- על מה
  crane_serial text,
  customer_name text,
  customer_number text,

  -- מאיפה הגיע
  stop_id uuid references public.calendar_stops(id) on delete set null,
  service_call_id uuid references public.service_calls(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,

  -- מה נענה
  answers jsonb not null default '{}'::jsonb,
  verdict text check (verdict in ('ok', 'out_of_service')),
  notes text,

  -- מי
  technician_name text,
  technician_user uuid references auth.users(id) on delete set null,
  recipient_name text,
  recipient_id_number text,
  recipient_relation text,
  -- חתימה מצוירת, data URL. נשמרת בשורה כי היא קטנה ואינה נשלפת לרשימות.
  recipient_signature text,

  -- פרטי הערסל שסופק (טופס ההדרכה בלבד)
  sling_manufacturer text,
  sling_production_date text,
  sling_serial text,

  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists crane_forms_serial_idx on public.crane_forms (crane_serial, submitted_at desc);
create index if not exists crane_forms_stop_idx on public.crane_forms (stop_id);
create index if not exists crane_forms_call_idx on public.crane_forms (service_call_id);

alter table public.crane_forms enable row level security;

-- ⭐ הטכנאי ממלא מהשטח, ולכן `authenticated` ולא צוות משרד בלבד.
-- 🔴 אבל **אין מחיקה ואין עדכון**: טופס בטיחות חתום שאפשר לערוך אחרי
-- החתימה אינו טופס חתום. תיקון נעשה במילוי חדש, וההיסטוריה נשמרת.
drop policy if exists crane_forms_read on public.crane_forms;
create policy crane_forms_read on public.crane_forms
  for select to authenticated using (true);

drop policy if exists crane_forms_insert on public.crane_forms;
create policy crane_forms_insert on public.crane_forms
  for insert to authenticated with check (true);

comment on table public.crane_forms is
  'טפסי מנוף חתומים. inspection = רשימת בדיקה לטכנאי, training = אישור קבלת הדרכה. ללא עדכון וללא מחיקה: טופס חתום שניתן לערוך אינו חתום.';
