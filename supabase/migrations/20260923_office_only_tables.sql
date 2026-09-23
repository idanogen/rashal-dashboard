-- 🔴 סקירת אבטחה, שכבת המשתמש המחובר (23/09/2026). טבלאות עם מדיניות
-- `using (true)` נפתחו לכל חשבון מחובר, כולל נהג: יומן הוובהוק של heyy (מטען
-- גולמי עם הודעות לקוחות וטלפונים), סקרי לקוחות, תעודות משלוח, טפסים חתומים,
-- יומני מנועים. אף אחת מהן לא נקראת באפליקציית הנהגים או במסך הנהג; כולן
-- במסכי משרד (סקרים, דשבורד ההנהלה, מנופים). מעכשיו: משרד בלבד.
-- הכתיבה של השרת עוברת ב-service role ולא מושפעת.
-- 🔴 נשארו פתוחות למחוברים בכוונה, כי הנהג צריך אותן: `timeline_events`,
-- `pickups`, `profiles`, `assignees`. צמצום שלהן = תוכנית נפרדת מול אפליקציית הנהגים.

do $$
declare r record;
begin
  for r in select tablename, policyname, cmd from pg_policies
            where schemaname = 'public'
              and (tablename, policyname) in (
                ('heyy_webhook_log', 'heyy_webhook_log_read'),
                ('customer_surveys', 'authenticated_read_customer_surveys'),
                ('activity_events', 'activity_events_select_authenticated'),
                ('feedback_messages', 'feedback_messages_select'),
                ('feedback_threads', 'feedback_threads_select'),
                ('survey_engine_runs', 'authenticated_read_survey_engine_runs'),
                ('media_request_runs', 'authenticated_read_media_request_runs'),
                ('on_way_runs', 'authenticated_read_on_way_runs'),
                ('reconcile_runs', 'authenticated_read_reconcile_runs'),
                ('customer_language', 'customer_language_select_office'),
                ('delivery_notes', 'authenticated_all_delivery_notes'),
                ('signed_forms', 'authenticated_all_signed_forms'),
                ('crane_sync_history', 'authenticated_all_crane_sync_history'))
  loop
    if r.cmd = 'ALL' then
      execute format('alter policy %I on public.%I using ((select public.is_office_staff())) with check ((select public.is_office_staff()))', r.policyname, r.tablename);
    else
      execute format('alter policy %I on public.%I using ((select public.is_office_staff()))', r.policyname, r.tablename);
    end if;
  end loop;
end $$;

-- שתי תצוגות שעוקפות RLS (definer / ממומשת) עם שמות וטלפונים של כל הלקוחות.
-- נקראות רק בשרת (`api/priority-context`) ובפונקציות definer.
revoke all on public.contact_phones from authenticated;
revoke all on public.customer_directory from authenticated;
