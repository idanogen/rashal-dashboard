-- הוספת ערך "בוטל" ל-enum של סטטוס הזמנה (קריאות שירות כבר כוללות אותו).
-- מאפשר ביטול הזמנה שכבר לא רלוונטית.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'בוטל';
