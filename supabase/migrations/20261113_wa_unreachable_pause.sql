-- ─── מספר שאינו בוואטסאפ: הפסקה של 30 יום וסימון על הקריאה (13/11/2026, הכרעת עידן) ───
--
-- מדידה 13/11: 201 מתוך 206 כשלונות בחודש הם "המספר אינו מספר וואטסאפ", על 89 לקוחות,
-- עד 7 ניסיונות ללקוח. מטא מחזירה את הכשלון באיחור (סטטוס דרך ה-webhook), כך ש-heyy
-- מקבל את ההודעה, המנוע רושם "נשלח", ובקשת התמונה נראית בדשבורד "ממתין לתמונה" כשהיא
-- בכלל לא הגיעה.
--
-- 1. `wa_phone_paused`: מספר שנכשל כך ב-30 הימים האחרונים, ולא הגיעה אליו אף הודעה אחרי
--    הכשלון, לא מקבל הודעות אוטומטיות. הבדיקה ב-`api/_lib/unreachable.ts` (heyy-send לקורא
--    מכונתי, ותזכורות הערב). שליחה ידנית מהמשרד לא נחסמת. שורת "paused:" שנרשמת על דילוג
--    אינה כשלון אמיתי ולכן לא מאריכה את ההפסקה; אחרי 30 יום מנסים שוב.
-- 2. `trg_media_request_undeliverable`: כשהכשלון מגיע על בקשת תמונה, הבקשה עוברת ל-failed.
--    התג בכרטיס הקריאה אומר "לא הגיע בוואטסאפ, להתקשר", והתזכורת לא יוצאת אל מספר מת.

create or replace function public.wa_phone_paused(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with last_fail as (
    select max(created_at) at from whatsapp_outbound
     where phone_e164 = p_phone
       and status::text = 'failed'
       and status_detail ilike '%unable to deliver%'
       and status_detail not like 'paused:%'
       and not coalesce(is_demo, false)
       and created_at > now() - interval '30 days'
  )
  select coalesce((
    select lf.at is not null and not exists (
      select 1 from whatsapp_outbound d
       where d.phone_e164 = p_phone and d.status::text in ('delivered', 'read') and d.created_at > lf.at)
    from last_fail lf), false);
$$;
revoke all on function public.wa_phone_paused(text) from public, anon, authenticated;
grant execute on function public.wa_phone_paused(text) to service_role;

create index if not exists whatsapp_outbound_phone_created_idx on public.whatsapp_outbound (phone_e164, created_at desc);

create or replace function public.media_request_undeliverable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text = 'failed'
     and new.status_detail ilike '%unable to deliver%'
     and new.triggered_by like 'media-request-%' then
    update media_requests
       set state = 'failed',
           send_error = 'לא הגיע בוואטסאפ: המספר אינו מחובר לוואטסאפ',
           send_claimed_at = null
     where phone_e164 = new.phone_e164
       and state in ('first_sent', 'reminder_sent');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_media_request_undeliverable on public.whatsapp_outbound;
create trigger trg_media_request_undeliverable
  after update of status on public.whatsapp_outbound
  for each row
  when (new.status is distinct from old.status)
  execute function public.media_request_undeliverable();

-- השלמה חד פעמית: בקשות פתוחות שהכשלון שלהן כבר הגיע לפני הטריגר (כולל "אין מענה", שבפועל לא הגיעו).
update public.media_requests m
   set state = 'failed', send_error = 'לא הגיע בוואטסאפ: המספר אינו מחובר לוואטסאפ', send_claimed_at = null
 where m.state in ('first_sent', 'reminder_sent', 'no_response')
   and not m.is_test
   and exists (select 1 from public.whatsapp_outbound o
                where o.phone_e164 = m.phone_e164
                  and o.triggered_by like 'media-request-%'
                  and o.status::text = 'failed'
                  and o.status_detail ilike '%unable to deliver%'
                  and o.created_at >= coalesce(m.first_sent_at, m.created_at) - interval '1 minute');
