-- 🔴 סקירת אבטחה, שכבת המשתמש המחובר (23/09/2026). פונקציות security definer
-- עוקפות RLS, ובלי בדיקת תפקיד בפנים כל חשבון מחובר (גם נהג) הריץ אותן:
-- חיפוש לקוחות לפי טלפון או טקסט, כתיבת הודעות וואטסאפ מזויפות לשרשור, שיוך
-- הודעות ושינוי שפה. אלה שרק השרת קורא (service role, או פונקציית definer אחרת
-- שרצה כבעלים) יוצאות מ-authenticated. `morning_report_default_date` נשארת
-- כי `morning_report()` (invoker) קוראת לה, והיא מחזירה תאריך בלבד.
do $$
declare f text;
begin
  foreach f in array array[
    'public.customer_extra_phones(text)',
    'public.wa_attribute_message(text, text, text, text)',
    'public.wa_customers_for_phone(text)',
    'public.wa_language_for(text, text)',
    'public.wa_pick_template(text, text, text, text)',
    'public.wa_record_message(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, timestamp with time zone)',
    'public.wa_suggest_customers(text)',
    'public.wa_template_key(text)',
    'public.wa_translate_value(text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- שינוי שפה נקרא גם מתיבת השיחות בדפדפן, ולכן נשאר פתוח למחוברים עם בדיקה:
-- משרד בלבד (`is_office_staff()` מחזירה true גם ל-service role).
do $$
declare def text;
begin
  def := pg_get_functiondef('public.wa_set_language(text, text, text)'::regprocedure);
  if def not ilike '%is_office_staff%' then
    def := regexp_replace(def, '\nbegin\n',
      E'\nbegin\n  if public.is_office_staff() is not true then\n    raise exception ''not authorized'';\n  end if;\n');
    execute def;
  end if;
end $$;
