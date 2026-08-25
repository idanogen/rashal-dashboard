/**
 * תצוגה מקדימה לצילום, בלי התחברות ובלי מסד.
 *
 * 🔴 **מסך ההתחברות חוסם צילום אוטומטי**, ולכן הרכיב האמיתי מרונדר כאן
 * לבדו מול ה-CSS המהודר. זה מה שמאפשר לראות עיצוב לפני מסירה במקום
 * לשלוח אותו לעידן ולגלות ממנו. [[screenshot_behind_a_login]]
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { CustomerCardBody } from '@/components/customer/CustomerCard';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import { FIXTURE } from '@/preview/customer-fixture';

/**
 * 🔴 **המצב הריק מצולם גם הוא, כי הוא המצב של רוב הלקוחות.** נמדד
 * 25/08/2026: 2,374 מתוך 5,006 לקוחות עם פריט אחד לפחות, כלומר יותר
 * ממחצית יראו את המסך הזה בלי שום ציוד. [[empty_state_must_speak]]
 */
const EMPTY = {
  ...FIXTURE,
  // 🔴 והמקרה שנתפס מצילום של עידן: טלפון שאינו רשום בפריוריטי, לקוחה
  // מוכרת, וציוד שכן קיים. הכרטיס חייב לומר איך הוא זיהה אותה.
  customer: { ...FIXTURE.customer, identifiedBy: 'survey' as const, identifiedHint: 'אלחרר פרלה' },
  // 🔴 בדיוק המקרה שעידן צילם: אין שום פריט פתוח, אבל יש לה מנוף.
  open: { orders: [], calls: [], pickups: [], notes: [] },
  // 🔴 ממוין כמו שהמסד מחזיר. תצוגה מקדימה שאינה ממוינת הייתה מסתירה
  // ממני בדיוק את מה שהיא נועדה להראות.
  timeline: [
    ...FIXTURE.timeline.slice(0, 4),
    { at: '2026-08-17T00:00:00Z', kind: 'equipment' as const,
      title: 'מכשיר אצל הלקוח: G175', ref: null,
      detail: 'מנוף חשמלי SUNRISE MEDICAL למשקל עד 175 ק"ג · באחריות עד 12/01/2028',
      match: 'number' as const },
  ].sort((a, b) => (a.at < b.at ? 1 : -1)),
  stock: FIXTURE.stock,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        {/* ⭐ הכפתור שפותח את הכרטיס מכל רשימה, בשני הגדלים. עידן,
            25/08/2026: "הכפתור של הכרטיס קטן מידי ולא מובן מספיק." */}
        <div className="mb-3 flex items-center gap-3 rounded-xl border bg-white p-3">
          <span className="text-xs font-bold text-slate-500">הכפתור מכל רשימה:</span>
          <span className="flex items-center gap-1 text-[13px] font-semibold text-slate-900">
            אלחרר פרלה
            <CustomerCardButton customerNumber="8449321" name="אלחרר פרלה" />
          </span>
          <span className="flex items-center gap-1 text-[12px] text-slate-700">
            שורה במסך הסדרן
            <CustomerCardButton customerNumber="8449321" name="אלחרר פרלה" compact />
          </span>
        </div>
        <CustomerCardBody data={FIXTURE} />
        <div className="mt-8 mb-2 text-xs font-bold text-slate-500">המצב הריק, כפי שרוב הלקוחות ייראו</div>
        <CustomerCardBody data={EMPTY} />
      </div>
    </div>
  </StrictMode>,
);
