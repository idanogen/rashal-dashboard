-- צוות השטח יוצא מהקוד ונכנס לטבלה.
--
-- 🔴 **הבעיה שנסגרת כאן (עמי, 23/08/2026):** הוספת נהג או טכנאי חדש
-- הייתה שינוי קוד ופריסה. השמות ישבו כטיפוס `driver_name` במסד ובשלושה
-- קבצים בקוד, ולכן קליטת עובד בשטח נעצרה עד שמישהו אצלנו פרס גרסה.
--
-- ⭐ **השם נשאר המפתח**, כי הוא מה שכל העצירות ההיסטוריות מחזיקות. שינוי
-- שם מתפשט דרך `on update cascade` ולא משאיר יתומים.
--
-- הצבע נשמר כמפתח מהפלטה ולא כמחלקת Tailwind: Tailwind גוזר מחלקות
-- בזמן בנייה, ומחרוזת שמגיעה מהמסד לא תיווצר לעולם.

create table if not exists public.assignees (
  name        text primary key,
  kind        text not null check (kind in ('driver', 'technician', 'both')),
  phone       text,
  color       text not null default 'slate'
              check (color in ('blue','emerald','purple','amber','cyan','rose',
                               'indigo','teal','orange','fuchsia','lime','sky','slate')),
  active      boolean not null default true,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.assignees is 'נהגי חלוקה וטכנאי שירות. מקור האמת לשיבוץ עצירות.';
comment on column public.assignees.kind is 'driver = חלוקה · technician = שירות · both = שניהם';
comment on column public.assignees.active is 'עובד שעזב מסומן לא פעיל ולא נמחק, כדי שהעצירות ההיסטוריות שלו יישארו קריאות.';

-- זרע מדויק לפי המצב שהיה בקוד ב-23/08/2026.
insert into public.assignees (name, kind, phone, color, sort_order) values
  ('דוד',   'both',       '058-5868780', 'blue',    1),
  ('רודי',  'driver',     '050-8334248', 'emerald', 2),
  ('מוחמד', 'driver',     '0522906066',  'purple',  3),
  ('מוהנד', 'driver',     '052-5079808', 'amber',   4),
  ('אולג',  'technician', '050-4466123', 'cyan',    5),
  ('ישראל', 'technician', '054-9018939', 'rose',    6),
  ('אבי',   'technician', '058-6699369', 'indigo',  7)
on conflict (name) do nothing;

-- ── המרת שלוש העמודות מ-enum לטקסט ─────────────────────────────────────
-- 🔴 **שלוש-עשרה מדיניויות RLS משוות מול `current_user_driver()`**, וכל
-- אחת מהן חוסמת שינוי טיפוס של העמודה. הן לא נכתבות כאן מחדש ביד:
-- הן נשמרות מ-`pg_pol` ומוחזרות מהטקסט השמור. שכתוב ידני של מדיניות
-- אבטחה הוא בדיוק המקום שבו טעות הקלדה אחת פותחת נתונים בשקט.
--
-- אימות שבוצע: טביעת האצבע (md5 של כל 73 המדיניויות) הייתה זהה לפני
-- ואחרי, ו-804 העצירות נשארו במלואן.

do $mig$
declare
  r record;
  stmt text;
begin
  create temp table _pol_backup on commit drop as
    select tablename, policyname, cmd, permissive, roles, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual,'') || coalesce(with_check,'')) ilike '%current_user_driver%';

  for r in select * from _pol_backup loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  alter table public.calendar_stops alter column driver        type text using driver::text;
  alter table public.routes         alter column driver        type text using driver::text;
  alter table public.profiles       alter column linked_driver type text using linked_driver::text;

  drop function if exists public.current_user_driver();
  execute $fn$
    create function public.current_user_driver()
    returns text language sql stable security definer set search_path to 'public' as $body$
      select linked_driver from public.profiles where id = auth.uid() and disabled = false limit 1;
    $body$;
  $fn$;

  for r in select * from _pol_backup loop
    stmt := format('create policy %I on public.%I as %s for %s to %s',
                   r.policyname, r.tablename, r.permissive, r.cmd,
                   (select string_agg(quote_ident(x), ',') from unnest(r.roles) x));
    if r.qual       is not null then stmt := stmt || format(' using (%s)',      r.qual);       end if;
    if r.with_check is not null then stmt := stmt || format(' with check (%s)', r.with_check); end if;
    execute stmt;
  end loop;
end
$mig$;

-- השם הוא המפתח, ולכן שינוי שם מתפשט ולא משאיר יתומים.
alter table public.calendar_stops
  add constraint calendar_stops_driver_fkey
  foreign key (driver) references public.assignees(name) on update cascade;

alter table public.routes
  add constraint routes_driver_fkey
  foreign key (driver) references public.assignees(name) on update cascade;

alter table public.profiles
  add constraint profiles_linked_driver_fkey
  foreign key (linked_driver) references public.assignees(name) on update cascade;

drop type if exists public.driver_name;

alter table public.assignees enable row level security;

create policy assignees_read_all on public.assignees
  for select to authenticated using (true);
