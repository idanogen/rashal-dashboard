-- הודעת וואטסאפ מסווגת: אנושית או אוטומטית (סקר, תזכורת, בדרך אליך).
-- התצוגה מוסיפה ל-wa_messages את auto_kind מתוך whatsapp_outbound, כדי
-- שהתיבה תספור הודעות אנושיות ותציג את ההודעה האנושית האחרונה ולא את
-- הסקר האחרון (הקורא: api/_lib/thread.ts).
--
-- 🔴 התצוגה הוחלה דרך הכלי ב-15/09/2026 ומעולם לא נשמרה כקובץ. הקובץ הזה
-- הושלם בדיעבד ב-24/10/2026 מתוך pg_get_viewdef החי, אחרי
-- ש-test/migrations.test.mjs תפס את החסר. ההרשאות (revoke) שלה כבר היו
-- רשומות ב-20260915_stop_call_info.sql.
--
-- 🔴🔴 security_invoker חובה. בלעדיו התצוגה רצה בהרשאות היוצר ועוקפת את
-- ה-RLS של wa_messages (קריאה למשרד בלבד, is_office_staff): כל מחובר,
-- כולל נהג, היה קורא דרכה את כל השיחות. תצוגה חדשה על הטבלאות האלה
-- חייבת אותו דבר. [[security_definer_view_bypasses_rls]]

drop view if exists public.wa_messages_classified;
create view public.wa_messages_classified
  with (security_invoker = true) as
select m.id, m.conversation_id, m.heyy_message_id, m.vendor_message_id,
       m.direction, m.body, m.attachments, m.status, m.template_id,
       m.entity_type, m.entity_key, m.author, m.sent_at, m.created_at,
       m.media_state, m.media_tries,
       public.wa_auto_kind(m.direction, m.author, o.triggered_by, o.reminder_kind::text, m.body) as auto_kind
  from public.wa_messages m
  left join public.whatsapp_outbound o on o.wa_message_id = m.heyy_message_id;

-- הדפדפן קורא בלבד, ו-anon לא רואה את התצוגה בכלל (כמו במסד החי).
revoke all on public.wa_messages_classified from anon;
revoke insert, update, delete, truncate on public.wa_messages_classified from authenticated;
