-- מסך בית אישי למשתמש (עידן 25/11/2026): אילונה נוחתת כל בוקר על "הבוקר שלי".
-- ריק = ברירת המחדל של התפקיד (סדרן → מסך הסדרן, שאר הצוות → הדשבורד).
-- נקבע במסד בלבד (אין עריכה מהדפדפן); הנתב קורא אותו ב-HomeByRole.
alter table public.profiles add column if not exists home_screen text;
comment on column public.profiles.home_screen is 'מסך הבית של המשתמש, למשל /my-day. ריק = לפי התפקיד.';

update public.profiles set home_screen = '/my-day' where full_name = 'אילונה' and home_screen is null;
