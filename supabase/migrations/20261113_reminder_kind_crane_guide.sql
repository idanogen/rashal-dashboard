-- מדריך הבטיחות למנוף (cron-daily-reminders, הודלק 13/11) כותב reminder_kind='crane_guide'
-- ל-whatsapp_outbound ול-whatsapp_reminder_log, והערך לא היה ב-enum: ההודעה הייתה יוצאת ללקוח,
-- שתי הכתיבות נדחות, ואין לא יומן ולא חסם כפילות. נמצא 13/11 לפני הריצה הראשונה (ראשון 15/11).
alter type public.whatsapp_reminder_kind add value if not exists 'crane_guide';
