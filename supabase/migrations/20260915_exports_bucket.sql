-- דלי פרטי לקבצי ייצוא חד פעמיים (15/09/2026).
-- נוצר עבור הפונקציה rashal-invoice-lines (דוח "מה נמכר לאיזו קופה"), שמעלה לכאן
-- את שורות החשבוניות ומחזירה קישור חתום לשעה. אין מדיניות גישה: רק service role.
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;
