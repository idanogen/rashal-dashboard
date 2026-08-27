/* eslint-disable react-refresh/only-export-components --
   קובץ הרנדור לצילום בלבד, ואינו נטען באפליקציה. הכלל הזה נוגע לנוחות
   של רענון חם בפיתוח, ואין לו משמעות במסך שרץ פעם אחת בתוך Chrome
   headless. הופרד כאן במפורש כדי שהוא לא ייבלע ברעש של שאר הפרויקט. */
/**
 * תצוגה מקדימה לצילום, בלי התחברות ובלי מסד.
 *
 * 🔴 **מסך ההתחברות חוסם צילום אוטומטי**, ולכן הרכיב האמיתי מרונדר כאן
 * לבדו מול ה-CSS המהודר. זה מה שמאפשר לראות עיצוב לפני מסירה במקום
 * לשלוח אותו לעידן ולגלות ממנו. [[screenshot_behind_a_login]]
 */
import { StrictMode } from 'react';
import type React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { CustomerCardBody } from '@/components/customer/CustomerCard';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import { FIXTURE } from '@/preview/customer-fixture';
import { DuplicateScheduleWarningDialog } from '@/components/deliveries/DuplicateScheduleWarningDialog';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { DriverStopCard } from '@/pages/DriverDashboardPage';
import { AuthProvider } from '@/lib/auth-context';
import { GlobalChatProvider } from '@/context/GlobalChatContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CalendarStop } from '@/types/calendar-stop';

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

/**
 * ⭐ **דיאלוג הכפילות, שני המצבים שלו.**
 *
 * 🔴 הדיאלוג הזה הוא מודאל, ולכן אי אפשר לראות אותו במסך הרגיל בלי לשחזר
 * קונפליקט אמיתי ביומן. `?view=dup` מרנדר אותו לבדו, וזו הדרך היחידה
 * לראות בעיניים איזה כפתור ראשי לפני שמוסרים.
 */
function stop(over: Partial<CalendarStop>): CalendarStop {
  return {
    id: Math.random().toString(36).slice(2),
    deliveryDate: '2026-05-14',
    driver: 'רודי',
    sequence: 0,
    sourceType: 'delivery',
    customerName: 'כהן דוד',
    status: 'planned',
    ...over,
  } as CalendarStop;
}

const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

function DupPreview() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl border bg-white p-4 text-sm">
          <b>מצב א: השיבוץ הקיים בתאריך שכבר עבר.</b> זה המקרה של עמי, ו-294
          מתוך 299 העצירות הפעילות נראות ככה. הפעולה הראשית צריכה להיות
          "כבר בוצע, סגור אותו".
        </div>
        <DuplicateScheduleWarningDialog
          open
          onOpenChange={() => {}}
          conflicts={[{ customerName: 'כהן דוד', city: 'ראשון לציון', existing: [stop({})] }]}
          onCancel={() => {}}
          onReschedule={() => {}}
          onCloseExisting={() => {}}
          targetDate="2026-08-28"
        />
      </div>
    </div>
  );
}

function DupPreviewFuture() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <DuplicateScheduleWarningDialog
          open
          onOpenChange={() => {}}
          conflicts={[{ customerName: 'לוי שרה', city: 'חיפה', existing: [stop({ deliveryDate: tomorrow, customerName: 'לוי שרה' })] }]}
          onCancel={() => {}}
          onReschedule={() => {}}
          onCloseExisting={() => {}}
          targetDate="2026-08-30"
        />
      </div>
    </div>
  );
}

/**
 * ⭐ **מסך הנהג, שני המצבים שבהם הכפתורים משתנים.**
 * 🔴 "המשך טיפול" מופיע **רק אחרי הגעה**, וזו הכרעה שצריך לראות בעיניים:
 * מי שלא הגיע ללקוח לא יכול להיות "בוצע חלקית".
 */
function driverStop(over: Partial<CalendarStop>): CalendarStop {
  return {
    id: 'p1',
    deliveryDate: new Date().toISOString().slice(0, 10),
    driver: 'רודי',
    sequence: 0,
    sourceType: 'delivery',
    customerName: 'כהן דוד',
    address: 'הרצל 12',
    city: 'ראשון לציון',
    phone: '0521234567',
    status: 'planned',
    ...over,
  } as CalendarStop;
}

/**
 * 🔴 כרטיס הנהג נשען על ההקשרים של האפליקציה (משתמש, צ'אט, שאילתות).
 * בלעדיהם הוא זורק והמסך יוצא **לבן לגמרי**, וזה בדיוק המקרה שבו צילום
 * ריק נראה כמו "אין מה לראות" במקום כמו שגיאה. נתפס בצילום הראשון.
 */
const previewQc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={previewQc}>
      <AuthProvider>
        <GlobalChatProvider>{children}</GlobalChatProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function DriverPreview() {
  return (
    // 🔴 **רוחב טלפון אמיתי, כפוי.** Chrome headless לא יורד מתחת ל-500
    // פיקסל, ולכן צילום ב-390 מראה פרוסה של עמוד רחב יותר ונראה כאילו
    // התוכן נחתך. מיכל קבוע הוא הדרך היחידה לראות את מה שהנהג רואה.
    <div dir="rtl" className="min-h-screen bg-slate-50 p-3">
      <div className="mx-auto space-y-5" style={{ width: 384 }}>
        <div className="rounded-xl border bg-white p-3 text-xs">
          <b>לפני הגעה:</b> ארבעה כפתורים, בלי "המשך טיפול". מי שלא הגיע
          ללקוח לא יכול להיות "בוצע חלקית".
        </div>
        <DriverStopCard
          stop={driverStop({})}
          index={1}
          onCoordinate={() => {}}
          onArrive={() => {}}
          onResolve={() => {}}
          resolving={false}
        />
        <div className="rounded-xl border bg-white p-3 text-xs">
          <b>אחרי הגעה:</b> נוסף "המשך טיפול" בענבר, בין התיאום ל"לא בוצע".
        </div>
        <DriverStopCard
          stop={driverStop({ id: 'p2', status: 'in_progress' })}
          index={2}
          onCoordinate={() => {}}
          onArrive={() => {}}
          onResolve={() => {}}
          resolving={false}
        />
      </div>
    </div>
  );
}

function ReasonPreview({ kind }: { kind: 'not_done' | 'follow_up' }) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <NotCompletedReasonDialog
        open
        kind={kind}
        customerName="כהן דוד"
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />
    </div>
  );
}

const view = new URLSearchParams(location.search).get('view');

const VIEWS: Record<string, React.ReactElement> = {
  dup: <DupPreview />,
  'dup-future': <DupPreviewFuture />,
  driver: <DriverPreview />,
  'reason-followup': <ReasonPreview kind="follow_up" />,
  'reason-notdone': <ReasonPreview kind="not_done" />,
};

if (view && VIEWS[view]) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>{VIEWS[view]}</Providers>
    </StrictMode>,
  );
} else
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
