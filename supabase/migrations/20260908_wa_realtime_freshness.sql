-- תיבת הוואטסאפ עוברת מטיימר לדחיפה.
--
-- 🔴 הרקע (08/09/2026): הדשבורד שאב את `api/conversation` 14,077 פעמים ביממה
-- כדי לתפוס בערך 60 הודעות, כלומר 235 שאילתות על כל אירוע אחד. כתובת IP אחת
-- של המשרד אחראית ל-10,621 מהן, והיא לא יורדת לאפס בלילה. זו הייתה כל צריכת
-- המעבד של החשבון ב-Vercel.
--
-- ⭐ המבנה כאן זהה לזה שנבנה ב-07/09 לשאר המסך: ערוץ חי לדחיפה מיידית,
-- ובדיקת טריות זולה כשכבה שנייה. `whatsapp_inbound` ו-`whatsapp_outbound`
-- כבר היו בפרסום החי, ורק `wa_conversations` חסרה.

alter publication supabase_realtime add table public.wa_conversations;

-- שתי חותמות חדשות: `wa-inbox` ו-`wa-thread`.
-- 🔴 השמות הם בדיוק מפתחות ה-query בצד הלקוח (WA_INBOX_KEY ו-threadKey),
-- כי probeFreshness עושה invalidateQueries על שם החותמת. שינוי שם באחד
-- הצדדים משתיק את הרענון בלי שגיאה.
--
-- ⭐ הפונקציה נשארת SECURITY DEFINER ולכן לא נדרש שינוי הרשאות, והיא מחזירה
-- חותמת זמן בלבד ולעולם לא תוכן של הודעה.
create or replace function public.sync_freshness()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'pull_at', (select max(started_at) from public.sync_runs where job = 'pull-core' and status = 'success'),
    'pull_status', (select status from public.sync_runs where job = 'pull-core' order by started_at desc limit 1),
    'marks', jsonb_build_object(
      'orders',        (select max(updated_at) from public.orders),
      'serviceCalls',  (select max(updated_at) from public.service_calls),
      'pickups',       (select max(updated_at) from public.pickups),
      'calendarStops', (select max(updated_at) from public.calendar_stops),
      'routes',        (select max(updated_at) from public.routes),
      -- רשימת השיחות זזה גם בלי הודעה חדשה (שיוך, סימון כנקרא, סטטוס),
      -- ולכן היא נמדדת ב-updated_at ולא ב-last_message_at.
      'wa-inbox',      (select max(updated_at) from public.wa_conversations),
      -- 🔴 לטבלאות ההודעות אין updated_at, רק created_at. הן מוסיפות שורות
      -- ולא מעדכנות אותן, ולכן זה המדד הנכון.
      'wa-thread',     greatest(
                         (select max(created_at) from public.whatsapp_inbound),
                         (select max(created_at) from public.whatsapp_outbound)
                       )
    )
  )
$function$;
