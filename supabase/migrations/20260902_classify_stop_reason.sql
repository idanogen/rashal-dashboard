-- ראה migration שהוחל ב-Supabase: classify_stop_reason (02/09/2026)
-- סיווג סיבת "לא בוצע" לרשימה סגורה, במסד ולא בדפדפן.
--
-- 🔴 **למה במסד.** אותה עצירה נסגרת משני מקומות, מסך הנהג בווב
-- ומאפליקציית הנהגים שהיא ריפו נפרד, ובעתיד גם מהמשרד. סיווג בצד
-- הלקוח היה מסווג במקום אחד ומשאיר את השני שקט, וזה בדיוק המצב שבו מדד
-- נראה תקין ומודד חצי מהאוכלוסייה. [[notification_routed_by_name_match_drops_half]]
--
-- ⭐ **הרשימה זהה למילה במסך** (`NotCompletedReasonDialog`). כשהנהג לוחץ
-- על סיבה מהירה, הטקסט נכתב מילה במילה, ולכן ההתאמה כאן אינה ניחוש.
--
-- 🔴 **וההתאמה היא תחילית ולא הכלה.** "לא הצלחתי ליצור קשר" בתוך משפט
-- ארוך יכול להיות גם תיאור של משהו אחר; מה שנכתב **בתחילת** ההערה הוא
-- מה שהנהג בחר. מה שלא מתאים נשאר בלי סיווג בכוונה, ומופיע בדוח כ"אחר",
-- כי מספר שמנחשים בו גרוע ממספר חסר.

create or replace function public.classify_stop_reason()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_note text := trim(coalesce(new.resolution_note, ''));
  v_reason text;
begin
  if v_note = '' or new.resolution_reason is not null then
    return new;
  end if;

  select r into v_reason
    from unnest(array[
      'הלקוח לא היה בבית', 'הלקוח ביטל', 'כתובת שגויה',
      'לא הצלחתי ליצור קשר', 'חוסר במלאי / ציוד', 'אין גישה / חניה',
      'הציוד שסופק לא התאים', 'חסר חלק, צריך להזמין', 'נדרש תיקון נוסף',
      'הלקוח ביקש להחליף', 'נדרשת התאמה במעבדה', 'סופק חלקית'
    ]) as r
   where v_note = r or v_note like r || '%'
   -- ⭐ הארוכה ביותר קודמת, אחרת סיבה שהיא תחילית של אחרת תגבר עליה.
   order by length(r) desc
   limit 1;

  new.resolution_reason := v_reason;
  return new;
end;
$$;

drop trigger if exists trg_classify_stop_reason on public.calendar_stops;
create trigger trg_classify_stop_reason
  before insert or update of resolution_note on public.calendar_stops
  for each row execute function public.classify_stop_reason();

revoke all on function public.classify_stop_reason() from public, anon, authenticated;

comment on function public.classify_stop_reason() is
  'מסווג את סיבת "לא בוצע" לרשימה הסגורה לפי תחילית ההערה. נולד 02/09/2026 אחרי ש-123 אירועים נכתבו ב-85 ניסוחים שונים.';

-- השלמה רטרואקטיבית באותו כלל בדיוק.
update public.calendar_stops cs
   set resolution_reason = m.r
  from (
    select cs2.id, (
      select r from unnest(array[
        'הלקוח לא היה בבית', 'הלקוח ביטל', 'כתובת שגויה',
        'לא הצלחתי ליצור קשר', 'חוסר במלאי / ציוד', 'אין גישה / חניה',
        'הציוד שסופק לא התאים', 'חסר חלק, צריך להזמין', 'נדרש תיקון נוסף',
        'הלקוח ביקש להחליף', 'נדרשת התאמה במעבדה', 'סופק חלקית'
      ]) as r
      where trim(cs2.resolution_note) like r || '%'
      order by length(r) desc limit 1
    ) as r
    from public.calendar_stops cs2
    where cs2.resolution_reason is null and trim(coalesce(cs2.resolution_note,'')) <> ''
  ) m
 where m.id = cs.id and m.r is not null;
