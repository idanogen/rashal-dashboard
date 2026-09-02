-- ═══════════════════════════════════════════════════════════════
-- פירוק מנגנון הכפילויות: הוא סימן שתי הזמנות שונות כאותה הזמנה
-- ═══════════════════════════════════════════════════════════════
--
-- 🔴🔴 **מה נמדד (01/09/2026, בעקבות שתי שורות בריצת ההשוואה של הבוקר):**
-- הטריגר מסמן כפילות לפי שם+טלפון+כתובת+עיר בחלון של חמש דקות, **בלי
-- מספר המסמך של פריוריטי**. מאז המעבר למשיכת OData לכל שורה יש מספר מסמך
-- ועליו מדד ייחודי (`orders_priority_id_key`), ולכן אותו מסמך **אינו יכול
-- פיזית להיכנס פעמיים**, וזה נמדד: **אפס** זוגות כפילויות הם אותו מסמך.
--
-- ⭐ **וההוכחה היא הסחורה:** ב-4,763 מתוך 4,975 זוגות ההזמנות (96%) שתי
-- ההזמנות נושאות פריטים שונים לגמרי. לוי עטרה (01/09): כיסא גלגלים
-- EASY LIFE T מול כרית JAY UNION. בית נועם: זרוע משענת ראש מול כרית ION.
--
-- 🔴 **ולמה זה נראה כמו "חמש דקות" והתנהג כמו "אותו יום":** פריוריטי שולח
-- על הזמנות תאריך **בלי שעה** (42,251 מתוך 42,908 בחצות), ולכן 4,930 מתוך
-- הזוגות חולקים חותמת זמן זהה בדיוק. החלון מעולם לא מדד חמש דקות.
--
-- ⭐ **והעד הנקי הוא האיסופים:** הם נבנו כולם בעידן המשיכה, אין עליהם
-- טריגר כפילויות כלל, ואין בהם ולו כפילות אחת מתוך 16,870 שורות.
--
-- **מה שנשאר מסומן בכוונה:** זוגות שבצד אחד שלהם אין מספר מסמך. אלה
-- שאריות ה-webhook הישן של Make (21/04 עד 03/08/2026), ושם הכפילות הייתה
-- אמיתית ובשבילה המנגנון נבנה מלכתחילה.
--
-- גיבוי מלא של 8,652 הסימונים: public.dedup_snapshot_20260901. אין מחיקה
-- של שורה אחת, רק ניקוי דגל.

begin;

-- 1. הטריגרים יורדים. הפונקציות נשארות במסד כתיעוד, בלי מי שיקרא להן.
drop trigger if exists mark_new_order_as_duplicate_trg on public.orders;
drop trigger if exists mark_new_service_call_as_duplicate_trg on public.service_calls;

comment on function public.mark_new_order_as_duplicate() is
  'לא מחובר לשום טריגר מ-01/09/2026. סימן שני מסמכי פריוריטי שונים כאותה הזמנה.';
comment on function public.mark_new_service_call_as_duplicate() is
  'לא מחובר לשום טריגר מ-01/09/2026. ראה 20260901_retire_dedup_trigger.sql.';

-- 2. ניקוי הדגל, אך ורק כשלשני הצדדים יש מספר מסמך, כלומר כששני הצדדים
--    הם ודאית שני מסמכים שונים בפריוריטי.
--
-- 🔴 **`updated_at` מושתק לאורך הניקוי, וזה לא קוסמטיקה.** מסנן הטעינה של
-- המסך נשען עליו (`updated_at >= cutoff and not closed`), וכבר נשרפנו על
-- זה ב-25/08 כשייבוא היסטורי הקפיץ את כל השורות והמסך טען 40,402 הזמנות.
-- ניקוי דגל תצוגה אינו "נגעו ברשומה", ולכן הוא לא מזיז את השעון שלה.
alter table public.orders        disable trigger orders_updated_at;
alter table public.service_calls disable trigger service_calls_updated_at;

update public.orders d
   set duplicate_of = null
  from public.orders h
 where h.id = d.duplicate_of
   and d.priority_order_id is not null
   and h.priority_order_id is not null;

update public.service_calls d
   set duplicate_of = null
  from public.service_calls h
 where h.id = d.duplicate_of
   and d.priority_call_id is not null
   and h.priority_call_id is not null;

alter table public.orders        enable trigger orders_updated_at;
alter table public.service_calls enable trigger service_calls_updated_at;

commit;
