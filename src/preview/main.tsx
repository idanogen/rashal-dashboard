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
import { RailScene } from './RailScene';
import { HeaderScene } from './HeaderScene';
import { HistoryScene } from './HistoryScene';
import { CardScene } from './CardScene';
import { TrafficScene } from './TrafficScene';
import '@/index.css';
import { CustomerCardBody } from '@/components/customer/CustomerCard';
import { LastVisitBadge } from '@/components/customer/LastVisitBadge';
import { localDateStr } from '@/lib/visit-history';
import { mediaBadge, MEDIA_BADGE_CLASS } from '@/lib/media-request-badge';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import { FIXTURE } from '@/preview/customer-fixture';
import { DuplicateScheduleWarningDialog } from '@/components/deliveries/DuplicateScheduleWarningDialog';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { AppInstallBanner, DriverStopCard, LeftoverStopCard } from '@/pages/DriverDashboardPage';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SurveysPage } from '@/pages/SurveysPage';
import { ManagementDashboard } from '@/pages/ManagementDashboard';
import { CraneChecklistDialog } from '@/components/crane/CraneChecklistDialog';
import { SignFlow } from '@/components/forms/SignFlow';
import { getFormByKey } from '@/lib/forms/registry';
import { buildContext, buildInitialValues } from '@/lib/forms/prefill';
import { buildFormHtml, generateFormPdf } from '@/lib/forms/render';
import { CraneTrainingDialog } from '@/components/crane/CraneTrainingDialog';
import { CollectionsPage, CustomerDebtDialog } from '@/pages/CollectionsPage';
import { LoadReportPanel } from '@/components/LoadReportLine';
import { analyzeLoad } from '@/lib/perf';
import { AuthProvider } from '@/lib/auth-context';
import { NewVersionBanner } from '@/components/NewVersionBar';
import { OtherNumberDialog, SaveContactPrompt } from '@/components/wa/OtherNumberDialog';
import { GlobalChatProvider } from '@/context/GlobalChatContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DispatchPage } from '@/pages/DispatchPage';
import { DispatchCard, UnscheduledPanel } from '@/components/dispatch/UnscheduledPanel';
import { Package } from 'lucide-react';
import { TaskDialog } from '@/components/deliveries/TaskDialog';
import { buildServiceCallItems } from '@/components/dispatch/items';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { ServiceCall } from '@/types/service-call';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { WaAutomationsPage } from '@/pages/WaAutomationsPage';
import { CustomerCommentsList } from '@/components/surveys/CustomerCommentsList';
import { SurveyDetailSheet } from '@/components/surveys/SurveyDetailSheet';
import { InboxBoard } from '@/components/wa/InboxBoard';
import { TeamPerformancePage } from '@/pages/TeamPerformancePage';
import { ImageThumb } from '@/components/wa/InboxBoard';
import type { CalendarStop } from '@/types/calendar-stop';
import { WeeklyTargetStrip } from '@/components/management/WeeklyTargetStrip';
import { deliveryTargetStatus as dts } from '@/lib/delivery-target';
import { DispatcherHome } from '@/components/dispatch/DispatcherHome';
import { CustomerPhoneBook } from '@/components/customer/CustomerPhoneBook';
import { EditStopDetailsDialog } from '@/components/deliveries/EditStopDetailsDialog';
import { phoneBookKey } from '@/hooks/useCustomerPhoneBook';
import { TasksPage } from '@/pages/TasksPage';
import { OfficeTaskDialog } from '@/components/tasks/OfficeTaskDialog';
import { OFFICE_TASKS_KEY } from '@/hooks/useOfficeTasks';
import { rowToTask, type OfficeTaskRow } from '@/lib/office-tasks';
import { StaffChatPage } from '@/pages/StaffChatPage';
import { STAFF_MESSAGES_KEY, STAFF_PEOPLE_KEY, STAFF_PREFS_KEY } from '@/hooks/useStaffChat';
import { rowToMessage, type StaffMessageRow } from '@/lib/staff-chat';

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
        <GlobalChatProvider>
          {/* 🔴 מסך הסדרן נשען על `useSearchParams`, ובלי נתב הוא זורק
              והצילום יוצא לבן. */}
          <MemoryRouter initialEntries={[location.search.includes('staff-chat') ? '/chat?to=avi' : '/dispatch?tab=all']}>{children}</MemoryRouter>
        </GlobalChatProvider>
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
        <div className="rounded-xl border bg-white p-3 text-xs">
          <b>קריאת מנוף אחרי הגעה:</b> נוסף כפתור רשימת הבדיקה מעל כפתור
          הסיום, כי הוא נועד להימלא בזמן הבדיקה ולא אחריה.
        </div>
        <DriverStopCard
          stop={driverStop({ id: 'p3', status: 'in_progress', sourceType: 'service', customerName: 'לוי שרה' })}
          index={3}
          onCoordinate={() => {}}
          onArrive={() => {}}
          onResolve={() => {}}
          resolving={false}
          crane={{ serial: 'G175-04821', kind: 'inspection' }}
          onCraneForm={() => {}}
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

/**
 * ⭐ **נתוני הסקרים מוזרקים למטמון השאילתות**, ולכן המסך מרונדר עם תוכן
 * אמיתי בלי מסד ובלי התחברות. 🔴 בלי זה הצילום מראה תמיד את המצב הריק,
 * וזה בדיוק מה שגורם למסור מסך שנראה טוב ריק ושבור מלא.
 */
const svy = (o: Record<string, unknown>) => ({
  id: String(o.id), stopId: null, orderId: null,
  customerName: o.name ?? null, driver: o.driver ?? null, healthFund: o.fund ?? null,
  customerNumber: o.customerNumber ?? null,
  deliveredAt: null, sentAt: '2026-08-20T09:00:00Z', openedAt: null,
  answeredAt: o.at ?? '2026-08-20T10:00:00Z',
  satisfaction: o.sat ?? 5, recommend: o.rec ?? 5, comment: o.comment ?? null,
  status: 'answered',
  // 🔴 `??` היה בולע `phone: null` ומחזיר את ברירת המחדל, ולכן השורה
  // בלי נייד לא נראתה בצילום כלל.
  phoneE164: 'phone' in o ? (o.phone as string | null) : '+972546875850',
  handledAt: o.handledAt ?? null, handledBy: o.handledBy ?? null,
});

const SURVEY_FIXTURE = [
  svy({ id: 1, name: 'רוזנברג אופר', driver: 'דוד', fund: 'כללית', comment: 'התגובה שלכם לפנייה שלי הייתה מהירה ביותר. הטכנאי דוד הודיע שיגיע תוך חצי שעה וכך עשה, אדם מקצועי ואדיב, תודה מקרב לב על עזרתכם.' }),
  svy({ id: 2, name: 'לוי שרה', driver: 'רודי', fund: 'מכבי', comment: 'קיבלנו שירות מצוין' }),
  svy({ id: 3, name: 'כהן משה', driver: 'דוד', fund: 'כללית' }),
  svy({ id: 4, name: 'אברהם רות', driver: 'מוהנד', fund: 'מאוחדת', sat: 4, rec: 4, comment: 'שירות מהיר ויעיל' }),
  svy({ id: 5, name: 'פרץ יוסי', driver: 'רודי', fund: 'לאומית', sat: 2, rec: 2, comment: 'חיכיתי שלושה שבועות ואף אחד לא חזר אליי', at: '2026-08-24T14:00:00Z' }),
  svy({ id: 6, name: 'דוד מרים', driver: 'מוהנד', fund: 'כללית' }),
  /**
   * ⭐ **שלושת מצבי "האם טופל" באותה תמונה** (02/09/2026): פתוח, פתוח
   * בלי נייד תקין, וכזה שכבר סומן. 🔴 בלי השורה בלי הנייד אי אפשר לראות
   * שהתווית "אין נייד" נכנסת ולא מועכת את השם.
   */
  svy({ id: 7, name: 'לויץ מאירה דבורה', driver: 'ישראל', fund: 'מכבי', sat: 1, rec: 1, comment: 'הזמנתי מיטה ועד היום לא קיבלתי תשובה מתי מגיעים', at: '2026-08-26T15:33:00Z', phone: null }),
  svy({ id: 8, name: 'משיח ריטה', driver: 'אבי', fund: 'כללית', sat: 1, rec: 2, comment: 'הטכנאי הגיע באיחור של שעתיים ולא עדכן', at: '2026-08-25T11:46:00Z', handledAt: '2026-09-01T13:05:00Z', handledBy: 'עמי גז' }),
];

previewQc.setQueryData(['surveys', 90], SURVEY_FIXTURE);

/**
 * ⭐ **דשבורד ההנהלה מוזן בנתונים סינתטיים מינימליים.**
 * 🔴 המטרה כאן היא לאמת **מבנה** ולא מספרים: שהחריגים באמת עלו לראש
 * המסך, שיש שישה כרטיסים, ושהכיתובים נכנסים. המספרים האמיתיים נמדדו
 * ישירות מול המסד (57 קריאות חוזרות, 429 מעל שבעה ימים).
 */
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
previewQc.setQueryData(['surveys', 30], SURVEY_FIXTURE);
previewQc.setQueryData(['orders'], []);
previewQc.setQueryData(['pickups'], []);
previewQc.setQueryData(['calendarStops'], []);
previewQc.setQueryData(['deliveryNotes'], []);
previewQc.setQueryData(['consolidatedInvoices'], []);
previewQc.setQueryData(
  ['serviceCalls'],
  [
    { id: 'a', customerName: 'כהן דוד', serviceCallStatus: 'קריאה חדשה', created: ago(20), deviceSerial: 'S1', callType: 'פרונטלית' },
    { id: 'b', customerName: 'כהן דוד', serviceCallStatus: 'קריאה חדשה', created: ago(9), deviceSerial: 'S1', callType: 'פרונטלית' },
    { id: 'c', customerName: 'לוי שרה', serviceCallStatus: 'קריאה חדשה', created: ago(12), deviceSerial: 'S2', callType: 'טלפונית' },
  ],
);

/**
 * ⭐ **גיול חובות מוזן מנתונים אמיתיים שנמדדו**, ולא ממספרים עגולים.
 * מסך כספי שנבדק על 1,000 ו-2,000 נראה מסודר תמיד; רק כללית עם
 * 4,049,321 ו-998 חשבוניות מראה מה קורה לרוחב העמודות באמת.
 * 🔴 והזיכוי השלילי של כללית נשמר, כי מינוס בטבלת כסף הוא בדיוק המקרה
 * שנשבר בשקט. [[negative_zero_reads_as_broken]]
 */
const AGING_FIXTURE = [
  { customerNumber: '511941213', customerName: 'כללית הנדסה רפואית בעמ', openCount: 998,
    total: 4049321.76, oldestDays: 207,
    buckets: { b0_30: 1402881, b31_60: 1180012, b61_90: 802331, b91_120: 672312, b120_plus: -8215.24 },
    lastNoteAt: null, nextActionDate: null },
  { customerNumber: '589958495', customerName: 'קופת חולים מאוחדת', openCount: 16,
    total: 1225393.29, oldestDays: 94,
    buckets: { b0_30: 402113, b31_60: 311280, b61_90: 290000, b91_120: 222000.29, b120_plus: 0 },
    lastNoteAt: '2026-08-24T09:00:00Z', nextActionDate: '2026-08-31' },
  { customerNumber: '930103742', customerName: 'משרד הבטחון', openCount: 13,
    total: 390105, oldestDays: 210,
    buckets: { b0_30: 0, b31_60: 84200, b61_90: 121205, b91_120: 120000, b120_plus: 64700 },
    lastNoteAt: '2026-08-20T09:00:00Z', nextActionDate: null },
  { customerNumber: 'בית קסלר', customerName: 'בית קסלר מעון אילן לנכים', openCount: 1,
    total: 108000, oldestDays: 9,
    buckets: { b0_30: 108000, b31_60: 0, b61_90: 0, b91_120: 0, b120_plus: 0 },
    lastNoteAt: null, nextActionDate: null },
];
previewQc.setQueryData(['debt-aging'], AGING_FIXTURE);
// קבלות מהספר הכספי, המספרים האמיתיים מסוף אוגוסט ותחילת ספטמבר 2026.
previewQc.setQueryData(['receipts-by-month'], [
  { month: '2026-09-01', customerNumber: '589904029', customerName: 'קופת חולים לאומית', n: 1, total: 199843 },
  { month: '2026-09-01', customerNumber: '5501318', customerName: 'דדון אבי', n: 1, total: 400 },
  { month: '2026-08-01', customerNumber: '589902279', customerName: 'מכבי שירותי בריאות', n: 2, total: 541835.81 },
  { month: '2026-08-01', customerNumber: '589958495', customerName: 'קופת חולים מאוחדת', n: 1, total: 324491.29 },
  { month: '2026-08-01', customerNumber: '059308247', customerName: 'גונן יעל', n: 1, total: -9000 },
]);
previewQc.setQueryData(['debt-drafts'], [
  { customerNumber: '589902279', customerName: 'מכבי שירותי בריאות', draftCount: 1, total: 197110, oldestDate: '2026-08-30' },
  { customerNumber: '589904029', customerName: 'קופת חולים לאומית', draftCount: 1, total: 142491, oldestDate: '2026-08-31' },
  { customerNumber: '930103742', customerName: 'משרד הבטחון', draftCount: 1, total: 49662, oldestDate: '2026-08-31' },
  { customerNumber: '511941213', customerName: 'כללית הנדסה רפואית בעמ', draftCount: 5, total: 4241, oldestDate: '2026-08-16' },
]);
previewQc.setQueryData(['customer-receipts', '930103742'], [
  { docNo: 'RC2600161', receiptDate: '2026-07-19', totalPrice: 120000, docType: 'T', docDesc: 'קבלות' },
  { docNo: 'RC2600122', receiptDate: '2026-04-02', totalPrice: 84200, docType: 'T', docDesc: 'קבלות' },
]);

// ⭐ החשבוניות של משרד הביטחון, כי זה בדיוק הלקוח שהצלבת הדוח סימנה
// כמסובך: 13 חשבוניות פרוסות על שבעה חודשים.
previewQc.setQueryData(
  ['open-invoices', '930103742'],
  [
    { docNo: 'CI-24118', invoiceDate: '2026-01-29', totalPrice: 64700, status: 'vEDI-SENT', sourceOrder: 'SO2601104', ageDays: 210 },
    { docNo: 'CI-24902', invoiceDate: '2026-04-30', totalPrice: 120000, status: 'סופית', sourceOrder: 'SO2603318', ageDays: 119 },
    { docNo: 'CI-25330', invoiceDate: '2026-05-28', totalPrice: 121205, status: 'vEDI-SENT', sourceOrder: null, ageDays: 91 },
    { docNo: 'CI-26014', invoiceDate: '2026-07-02', totalPrice: 84200, status: 'vEDI-SENT', sourceOrder: 'SO2605521', ageDays: 56 },
  ],
);
previewQc.setQueryData(
  ['collection-notes', '930103742'],
  [
    { id: '1', customerNumber: '930103742', customerName: 'משרד הבטחון', outcome: 'promised',
      note: 'דיברתי עם רויטל מהנהלת חשבונות. אמרה שהחשבונית מינואר עברה לבדיקה אצל הקצין ושהתשלום ייצא בסבב הבא.',
      promisedAmount: null, nextActionDate: '2026-09-10', createdByName: 'רונן', createdAt: '2026-08-20T09:12:00Z' },
    { id: '2', customerNumber: '930103742', customerName: 'משרד הבטחון', outcome: 'no_answer',
      note: 'לא ענו, השארתי הודעה.', promisedAmount: null, nextActionDate: null,
      createdByName: 'רונן', createdAt: '2026-08-12T11:40:00Z' },
  ],
);

/**
 * 🔴 **מצב הכישלון של רשימה אחת, מוזרק ידנית.**
 *
 * בלי משתמש מחובר PostgREST מחזיר מערך ריק ולא שגיאה, ולכן אי אפשר
 * לראות את מצב הכישלון סתם ככה. ואת המצב הזה בדיוק צריך לראות: עד
 * 27/08/2026 הוא צויר כ"אין הזמנות ממתינות לתיאום".
 */
if (new URLSearchParams(location.search).get('view') === 'dispatch-error') {
  // ⭐ מזריק כישלון ל-cache כדי לצלם את מצב "הרשימה לא נטענה" של הפאנל.
  previewQc
    .getQueryCache()
    .build(previewQc, { queryKey: ['orders'] })
    .setState({
      status: 'error',
      fetchStatus: 'idle',
      error: new Error('TypeError: Failed to fetch'),
    });
}

/** חדר הבקרה של האוטומציות: נתוני אמת מהיום שהמנוע עלה לאוויר. */
if (new URLSearchParams(location.search).get('view') === 'wa-automations') {
  previewQc
    .getQueryCache()
    .build(previewQc, { queryKey: ['wa-automation-overview'] })
    .setState({
      status: 'success',
      fetchStatus: 'idle',
      dataUpdatedAt: Date.now(),
      data: {
        surveys: { enabled: true, dry_run: false, sent_today: 13, sent_7d: 65, answered_7d: 27, queue: 4, failed_open: 0, last_run_at: new Date(Date.now() - 9 * 60_000).toISOString() },
        media: { enabled: true, dry_run: false, sent_today: 8, waiting: 8, queue: 0, received_7d: 1, no_response_open: 1, no_phone_open: 0, failed_open: 0, last_run_at: new Date(Date.now() - 4 * 60_000).toISOString() },
        on_way: { enabled: true, dry_run: true, sent_today: 0, sent_7d: 0, skipped_today: 2, last_run_at: new Date(Date.now() - 2 * 60_000).toISOString() },
        reminders: { sent_7d: 0, last_at: '2026-06-15T14:01:00Z' },
        manual: { sent_7d: 7, last_at: new Date(Date.now() - 3 * 3_600_000).toISOString() },
        suppressed: 0,
        delivery_failed_7d: 7,
        generated_at: new Date().toISOString(),
      },
    });
}

/** לקוח שדירג נמוך, בלי מלל ובלי נייד תקין. */
const SURVEY_DETAIL_ROW = svy({
  id: 9, name: 'עדי אהוד', driver: 'ישראל', fund: 'מכבי', sat: 2, rec: 1,
  at: '2026-08-28T09:12:00Z', phone: null, customerNumber: '204455667',
}) as unknown as import('@/lib/surveys').Survey;

/**
 * ⭐ **קפיצה לשיחה מקישור** (`/inbox?phone=…`), עם נתונים מוזרקים.
 * זה בדיוק המסלול שעידן דיווח עליו: הלשונית והחיפוש נכנסו, והשרשור
 * נשאר על "בחר שיחה מהרשימה".
 */
const JUMP_PHONE = '0538323838';
const JUMP_ITEM = {
  id: 'conv-1', phone: JUMP_PHONE, title: 'עדי אהוד', customerNumber: '9011792',
  unidentified: false, preview: 'שלום עדי אהוד, קיבלת לאחרונה שירות מחברת ר.שעל בע"מ. נשמח לשמוע…',
  lastMessageAt: '2026-09-01T15:00:00Z', lastMessageDirection: 'out',
  unansweredSince: null, waitingMinutes: null, read: true, messageCount: 2,
  window: { open: false, expiresAt: null, minutesLeft: 0, reason: 'no_inbound' },
  survey: { score: 2, answeredAt: '2026-08-28T09:12:00Z', comment: null },
} as never;
/**
 * 🔴🔴 **הלשונית "ממתינים" מוזנת בלקוח אחר, וזה לב השחזור.** בייצור
 * הכפתור הצף כבר שאב את הרשימה הזאת לפני שהמסך נפתח, ולכן ברגע הראשון
 * `items` **אינו ריק**, והבחירה האוטומטית של השורה הראשונה רצה ודורסת
 * את הבחירה שהגיעה מהקישור. התוצאה שעידן ראה: שם אחד ברשימה, ושיחה של
 * לקוח אחר לגמרי לצידה.
 */
const DECOY_ITEM = {
  id: 'conv-2', phone: '0543295286', title: 'אל נמר טאליה', customerNumber: '341837938',
  unidentified: false, preview: 'שתחזור מהבית ספר אצלכם',
  lastMessageAt: '2026-09-01T12:00:00Z', lastMessageDirection: 'in',
  unansweredSince: '2026-09-01T12:00:00Z', waitingMinutes: 300, read: false, messageCount: 6,
  window: { open: true, expiresAt: null, minutesLeft: 120, reason: null },
} as never;
previewQc.setQueryData(['wa-inbox', 'waiting', ''], {
  ok: true, tab: 'waiting', counts: { waiting: 14, all: 225 }, matched: 1,
  truncated: false, items: [DECOY_ITEM], phones: [JUMP_PHONE, '0543295286'],
});
previewQc.setQueryData(['wa-thread', '0543295286'], {
  ok: true,
  conversation: {
    id: 'conv-2', phone: '0543295286', phoneE164: '+972543295286', contactName: null,
    customerNumber: '341837938', customerName: 'אל נמר טאליה', messageCount: 6,
    lastMessageAt: '2026-09-01T12:00:00Z', unansweredSince: '2026-09-01T12:00:00Z', waiting: true,
    window: { open: true, expiresAt: null, minutesLeft: 120, reason: null },
  },
  messages: [],
});
// 🔴 **הרשימה מוזנת רק כשלא מבקשים את המצב הקר.** `?view=inbox-jump-cold`
// מדמה את הרגע שבו השיחה כבר נשאבה אבל השורה עדיין לא ברשימה שמוצגת,
// וזה בדיוק המצב שבו המסך אמר "בחר שיחה מהרשימה" ליד לקוח שנבחר.
if (!location.search.includes('inbox-jump-cold')) {
  previewQc.setQueryData(['wa-inbox', 'all', JUMP_PHONE], {
    ok: true, tab: 'all', counts: { waiting: 15, all: 224 }, matched: 1,
    truncated: false, items: [JUMP_ITEM], phones: [JUMP_PHONE],
  });
}
previewQc.setQueryData(['wa-thread', JUMP_PHONE], {
  ok: true,
  conversation: {
    id: 'conv-1', phone: JUMP_PHONE, phoneE164: '+972538323838', contactName: null,
    customerNumber: '9011792', customerName: 'עדי אהוד', messageCount: 2,
    lastMessageAt: '2026-09-01T15:00:00Z', unansweredSince: null, waiting: false,
    window: { open: false, expiresAt: null, minutesLeft: 0, reason: 'no_inbound' },
  },
  // 🔴 13/10/2026: קישור ארוך בלי רווחים חרג מהבועה. נשמר כאן כבדיקה ויזואלית.
  messages: [
    { id: 'm1', direction: 'out', body: 'https://rashal-dashboard.vercel.app/', attachments: [], buttons: [], status: 'read', template_id: null, entity_type: null, entity_key: null, author: 'עמי', sent_at: '2026-09-06T10:00:00Z', kind: 'human' },
    { id: 'm2', direction: 'out', body: 'https://chromewebstore.google.com/detail/jffiepfabfmngfnemgldanbjdnhmapae?hl=iw&utm_source=ext_sidebar', attachments: [], buttons: [], status: 'read', template_id: null, entity_type: null, entity_key: null, author: 'עמי', sent_at: '2026-09-06T10:01:00Z', kind: 'human' },
    { id: 'm3', direction: 'in', body: 'מתאים לי, תודה. הנה הקישור ששלחו לי https://example.com/very/long/path/without/any/spaces/at/all/1234567890', attachments: [], buttons: [], status: null, template_id: null, entity_type: null, entity_key: null, author: null, sent_at: '2026-09-06T10:02:00Z', kind: 'human' },
  ],
});

// ─── דחיפות בתיבה (08/10/2026): `?view=inbox-urgent` ─────────────────────
// המפתח המדויק של השאילתה: לשונית, חיפוש, אנושיות, ומסנן הדחופות.
if (location.search.includes('inbox-urgent')) {
  const URGENT_A = {
    ...(DECOY_ITEM as Record<string, unknown>),
    urgent: { active: true, reasons: ['סומן על ידי אילונה', 'ביקור מחר'], manual: true, markedBy: 'אילונה' },
    urgentMarkedAt: '2026-09-01T11:00:00Z', urgentMarkedBy: 'אילונה',
  } as never;
  const URGENT_B = {
    id: 'conv-3', phone: '0509145601', title: "אבו ג'אנם הודה", customerNumber: '037460839',
    unidentified: false, preview: 'המנוף נפל ולא עובד, דחוף בבקשה',
    lastMessageAt: '2026-09-01T13:30:00Z', lastMessageDirection: 'in',
    unansweredSince: '2026-09-01T13:30:00Z', waitingMinutes: 95, read: false, messageCount: 3,
    window: { open: true, expiresAt: null, minutesLeft: 900, reason: null },
    urgent: { active: true, reasons: ['ממתין מעל שעה', 'כתב "נפל"'], manual: false },
  } as never;
  const PLAIN = {
    id: 'conv-4', phone: '0523248420', title: 'דניאל דולי', customerNumber: '52122900',
    unidentified: false, preview: 'תודה, מחכה לכם',
    lastMessageAt: '2026-09-01T14:40:00Z', lastMessageDirection: 'in',
    unansweredSince: '2026-09-01T14:40:00Z', waitingMinutes: 12, read: false, messageCount: 2,
    window: { open: true, expiresAt: null, minutesLeft: 1400, reason: null },
  } as never;
  previewQc.setQueryData(['wa-inbox', 'waiting', '', 'human', 'all'], {
    ok: true, tab: 'waiting', counts: { waiting: 3, all: 225, urgent: 2 }, matched: 3,
    truncated: false, items: [URGENT_B, URGENT_A, PLAIN], phones: ['0543295286', '0509145601', '0523248420'],
  });
  previewQc.setQueryData(['wa-inbox', 'waiting', '', 'human', 'urgent'], {
    ok: true, tab: 'waiting', counts: { waiting: 3, all: 225, urgent: 2 }, matched: 2,
    truncated: false, items: [URGENT_B, URGENT_A], phones: ['0543295286', '0509145601'],
  });
  previewQc.setQueryData(['wa-thread', '0509145601'], {
    ok: true,
    conversation: {
      id: 'conv-3', phone: '0509145601', phoneE164: '+972509145601', contactName: null,
      customerNumber: '037460839', customerName: "אבו ג'אנם הודה", messageCount: 3,
      lastMessageAt: '2026-09-01T13:30:00Z', unansweredSince: '2026-09-01T13:30:00Z', waiting: true,
      window: { open: true, expiresAt: null, minutesLeft: 900, reason: null },
    },
    messages: [],
  });
}

/**
 * ⭐ **מדדי הצוות, עם המספרים האמיתיים שנמדדו ב-<bdi>02/09/2026</bdi>.**
 * לא נתונים מומצאים: זו בדיוק התשובה של `team_performance(90)` מהייצור,
 * כולל רודי עם 156 פתוחות ואולג עם אפס סגירות, כי אלה המקרים שהמסך
 * נבנה כדי לא לשקר עליהם.
 */
previewQc.setQueryData(['teamPerformance', 90], {
  windowDays: 90, from: '2026-06-04', to: '2026-09-02',
  people: [
    { name: 'דוד חסידים', kind: 'both', stops: 311, arrived: 248, completed: 237, notCompleted: 37, openFromPast: 37, activeDays: 44, closedSameDay: 237 },
    { name: 'אבי', kind: 'technician', stops: 272, arrived: 218, completed: 197, notCompleted: 39, openFromPast: 36, activeDays: 40, closedSameDay: 178 },
    { name: 'רודי', kind: 'driver', stops: 271, arrived: 173, completed: 75, notCompleted: 38, openFromPast: 156, activeDays: 26, closedSameDay: 67 },
    { name: 'ישראל', kind: 'technician', stops: 50, arrived: 36, completed: 33, notCompleted: 3, openFromPast: 14, activeDays: 6, closedSameDay: 33 },
    { name: 'מוהנד', kind: 'driver', stops: 35, arrived: 30, completed: 29, notCompleted: 3, openFromPast: 3, activeDays: 3, closedSameDay: 29 },
    { name: 'אולג', kind: 'technician', stops: 33, arrived: 0, completed: 0, notCompleted: 1, openFromPast: 27, activeDays: 1, closedSameDay: 0 },
    { name: 'מוחמד', kind: 'driver', stops: 7, arrived: 0, completed: 0, notCompleted: 1, openFromPast: 6, activeDays: 1, closedSameDay: 0 },
  ],
  reasons: [
    { reason: 'לא מסווג', n: 86 },
    { reason: 'הלקוח לא היה בבית', n: 15 },
    { reason: 'הלקוח ביטל', n: 11 },
    { reason: 'לא הצלחתי ליצור קשר', n: 8 },
    { reason: 'חוסר במלאי / ציוד', n: 2 },
  ],
  leadTime: { n: 149, median: 2, p90: 15.8, d0_2: 80, d3_7: 45, d8_14: 9, over14: 15, ofCompleted: 571 },
  repeat: { customers: 400, withRepeat: 28, visits: 58, closedWithCustomer: 430 },
  byDow: [
    { dow: 0, stops: 200, completed: 122 }, { dow: 1, stops: 215, completed: 124 },
    { dow: 2, stops: 208, completed: 123 }, { dow: 3, stops: 201, completed: 130 },
    { dow: 4, stops: 156, completed: 72 },
  ],
  totals: { stops: 980, completed: 571, notCompleted: 122, openFromPast: 280, closedSameDay: 544, withArrival: 705 },
});

const view = new URLSearchParams(location.search).get('view');

/** כרטיסי סדרן לצילום: חיווי התמונה המוגדל + כפתור "כרטיס" עם שם ארוך. */
const PREVIEW_CALLS = [
  { id: 'c1', customerName: 'יהודית חיה ברסלר גולדשטיין', customerNumber: '219970647', phone: '050-3304721', address: 'אוהב ישראל 8/5', city: 'ביתר עילית', deviceName: '183WM56', deviceSerial: 'ZRS-066620', created: new Date().toISOString() },
  { id: 'c2', customerName: 'שרה נחמה ברסלר', customerNumber: '225020668', phone: '050-3304721', address: 'אוהב ישראל 8', city: 'ביתר עלית', deviceName: '183WM56', deviceSerial: 'ZRS-066658', created: new Date().toISOString() },
  { id: 'c3', customerName: 'גונן יעל', customerNumber: '059308247', phone: '0536584770', address: 'דובדבן 7/2', city: 'בית שאן', deviceName: 'Q6EDGE HD', deviceSerial: 'JC712826002UK1', created: new Date().toISOString() },
] as unknown as ServiceCall[];

const PREVIEW_MEDIA = new Map([
  ['c1', { serviceCallId: 'c1', state: 'first_sent', mediaReceivedAt: null }],
  ['c2', { serviceCallId: 'c2', state: 'reminder_sent', mediaReceivedAt: null }],
  ['c3', { serviceCallId: 'c3', state: 'media_received', mediaReceivedAt: new Date().toISOString() }],
]);

/** תמונה בשיחת הוואטסאפ עם כפתור "שמור למחשב" (31/08). */
if (new URLSearchParams(location.search).get('view') === 'wa-image') {
  const png =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="%23334155"/><rect x="90" y="40" width="140" height="120" rx="10" fill="%230f172a"/><ellipse cx="160" cy="120" rx="46" ry="30" fill="none" stroke="%2334d399" stroke-width="7"/></svg>',
    );
  previewQc
    .getQueryCache()
    .build(previewQc, { queryKey: ['wa-media', 'pm1', 0] })
    .setState({ status: 'success', fetchStatus: 'idle', dataUpdatedAt: Date.now(), data: png });
}

/** רשימת "מה הלקוחות כתבו": שם + מספר לקוח + כפתור וואטסאפ (31/08). */
const PREVIEW_COMMENTS = [
  { id: 's1', customerName: 'טביב צפורה', customerNumber: '311122233', phoneE164: '+972546875850', satisfaction: 5, answeredAt: new Date().toISOString(), comment: 'הגיע נציג מטעם החברה בשם דוד, שירות מעל המצופה, גילה רגישות וסבלנות למצב בבית של ההורים שלי. מעריכים מאוד' },
  { id: 's2', customerName: 'משיח ריטה', customerNumber: '204455667', phoneE164: '+972523115539', satisfaction: 1, answeredAt: '2026-08-27T11:46:00Z', comment: 'תודה על השירות המהיר.' },
  { id: 's3', customerName: 'לויץ מאירה דבורה', customerNumber: null, phoneE164: null, satisfaction: 4, answeredAt: '2026-08-26T15:33:00Z', comment: 'השליח ממש נחמד איש עדין קבלני והסביר הכל בנחת' },
] as unknown as import('@/lib/surveys').Survey[];

/**
 * ⭐ המבוי הסתום של עמי (31/08): חיפוש שמוצא רק "לקוחות שכבר טופלו".
 * שני מצבים: יש התאמות (כפתור "שבץ ביקור" על כל שורה + שורת "משובץ
 * ביומן"), ואין שום התאמה (כפתור שיבוץ עם השם שהוקלד).
 */
const DEAD_END_ITEM = {
  id: 'd1',
  dragId: 'order-d1',
  dragData: { type: 'order' },
  zoneId: 'unassigned',
  customerName: 'לקוח אחר לגמרי',
  searchText: 'לקוח אחר לגמרי',
};

function DeadEndPreview({ withMatches }: { withMatches: boolean }) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <DndContext>
        <div className="mx-auto max-w-3xl">
          <UnscheduledPanel
            items={[DEAD_END_ITEM]}
            title="הזמנות ממתינות לתיאום"
            Icon={Package}
            accentBorder="border-s-blue-500"
            noun={{ one: 'הזמנה', many: 'הזמנות' }}
            emptyText="אין הזמנות ממתינות לתיאום"
            searchPlaceholder="חיפוש"
            storageKey="preview-deadend"
            search={withMatches ? 'פאוסטונוביץ' : 'לקוח שאין לו שום רשומה'}
            handled={
              withMatches
                ? [
                    { id: 'h1', customerName: 'פאוסטונוביץ לודמילה', customerNumber: '306958653', status: 'תואמה אספקה', phone: '0501234567', city: 'חיפה', scheduledLine: 'משובץ ביומן ל-31.8 · רודי' },
                    { id: 'h2', customerName: 'פאוסטונוביץ לודמילה', customerNumber: '306958653', status: 'סופק' },
                  ]
                : []
            }
            onScheduleVisit={() => {}}
          />
        </div>
      </DndContext>
    </div>
  );
}

const VIEWS: Record<string, React.ReactElement> = {
  /** באנר "עברנו לאפליקציה" בראש עמוד הנהג בווב (20/10/2026). */
  'driver-banner': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-3">
      <div className="mx-auto space-y-4" style={{ width: 384 }}>
        <AppInstallBanner />
        <DriverStopCard
          stop={driverStop({})}
          index={1}
          onCoordinate={() => {}}
          onArrive={() => {}}
          onResolve={() => {}}
          resolving={false}
        />
      </div>
    </div>
  ),
  /** מסילת הניווט של מסך הסדרן (06/09/2026). */
  rail: <RailScene />,
  header: <HeaderScene />,
  history: <HistoryScene />,
  card: <CardScene />,
  /** רמזור קריאות השירות (15/09/2026). */
  lights: <TrafficScene />,
  /** מסך פתיחה לסדרן (עידן, 02/09/2026). כל המספרים אמיתיים, נמדדו במסד. */
  'dispatcher-home': (
    <div className="min-h-screen bg-slate-50 py-4">
      <DispatcherHome
        d={{
          cancelledButScheduled: 7,
          uncoordinatedToday: 9,
          needsCancel: 4,
          staleStops: 335,
          noAddress: 277,
          over30: 676,
          over90: 152,
          pendingTotal: 1189,
          arrivedThisWeek: 117,
          scheduledToday: 44,
          scheduledTomorrow: 0,
          returnedFromRoute: 49,
          topCities: [
            { city: 'ירושלים', n: 101 },
            { city: 'תל אביב', n: 41 },
            { city: 'חיפה', n: 29 },
            { city: 'באר שבע', n: 26 },
            { city: 'בני ברק', n: 25 },
          ],
        }}
      />
    </div>
  ),

  /** רצועת היעד השבועי בכרטיס האספקות (שלומי, 02/09/2026), בארבעה מצבים. */
  'weekly-target': (() => {
    const HIST = [113, 89, 108, 115, 78, 77, 88, 127].map((count, i) => ({
      weekStart: `שבוע ${i + 1}`, count,
    }));
    const card = (title: string, s: import('@/lib/delivery-target').TargetStatus) => (
      <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
        <div className="mb-3 text-[13px] font-bold text-slate-500">{title}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-2xl font-bold text-[#2b6cb0]">11</div><div className="text-[11px] text-slate-500">מתוכננות היום</div></div>
          <div><div className="text-2xl font-bold text-[#16a34a]">1</div><div className="text-[11px] text-slate-500">בוצעו היום</div></div>
          <div><div className="text-2xl font-bold text-[#dc2626]">170</div><div className="text-[11px] text-slate-500">באיחור</div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-center" style={{ borderColor: '#f0f3f8' }}>
          <div><div className="text-2xl font-bold text-[#16a34a]">81%</div><div className="text-[11px] text-slate-500">עמידה ב-SLA (7 ימים)</div></div>
          <div><div className="text-2xl font-bold text-slate-800">8</div><div className="text-[11px] text-slate-500">זמן אספקה ממוצע (ימים)</div></div>
          <WeeklyTargetStrip s={s} history={HIST} />
        </div>
      </div>
    );
    const D = (m: number, d: number, h: number) => new Date(2026, m - 1, d, h);
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto grid max-w-3xl gap-4">
          {card('רביעי בבוקר, המצב האמיתי של השבוע', dts(85, D(9, 2, 8)))}
          {card('ראשון בבוקר, מוקדם מכדי לחזות', dts(4, D(8, 30, 9)))}
          {card('חמישי בערב, פיגור אמיתי', dts(85, D(9, 3, 18)))}
          {card('שבוע שסגר את היעד', dts(151, D(9, 3, 18)))}
        </div>
      </div>
    );
  })(),

  /** טאב "פתוחות" של הנהג (31/08): שורת הקפיצה מטאב היום + הכרטיסים. */
  'driver-open': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-3">
      <div className="mx-auto space-y-4" style={{ width: 384 }}>
        <div className="rounded-xl border bg-white p-3 text-xs">
          <b>מה שנשאר בטאב "היום":</b> שורת התראה שקופצת לטאב הפתוחות.
        </div>
        <button className="flex w-full items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-start">
          <AlertTriangle className="h-4 w-4 flex-none text-amber-600" />
          <span className="flex-1 text-sm font-bold text-amber-900">
            נשארו לך 170 עצירות פתוחות מימים קודמים
          </span>
          <span className="flex-none rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
            לרשימה
          </span>
        </button>
        <div className="rounded-xl border bg-white p-3 text-xs">
          <b>הטאב החדש "פתוחות":</b> קיבוץ לפי יום, סגירה מיידית.
        </div>
        <div className="flex items-center gap-2 px-1">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">יום ראשון, 17.8</h3>
          <Badge variant="outline" className="text-[10px]">2 עצירות</Badge>
        </div>
        <LeftoverStopCard
          stop={driverStop({ id: 'lo1', deliveryDate: '2026-08-17', customerName: 'לופשיץ מנוחה אבי', city: 'ראשל"צ', phone: '0501112233' })}
          resolving={false}
          onResolve={() => {}}
        />
        <LeftoverStopCard
          stop={driverStop({ id: 'lo2', deliveryDate: '2026-08-17', customerName: 'מרקו עדנה', city: 'ראשל"צ', notes: 'מנוף חשמלי, קומה 3', sourceType: 'service' })}
          resolving={false}
          onResolve={() => {}}
        />
      </div>
    </div>
  ),
  /** המבוי הסתום עם התאמות "כבר טופלו" — הכפתור החדש על כל שורה. */
  'dead-end': <DeadEndPreview withMatches />,
  /** חיפוש בלי שום התאמה — כפתור שיבוץ יזום עם השם שהוקלד. */
  'dead-end-empty': <DeadEndPreview withMatches={false} />,
  /** דיאלוג השיבוץ היזום: תאריך נערך + פרטי הלקוח ממולאים. */
  'visit-dialog': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <TaskDialog
        open
        onClose={() => {}}
        date={null}
        dateEditable
        title="שיבוץ ביקור ללקוח"
        initial={{ customerName: 'פאוסטונוביץ לודמילה', customerNumber: '306958653', phone: '0501234567', city: 'חיפה' }}
        onSubmit={() => {}}
      />
    </div>
  ),
  /**
   * ⭐ **מגירת חוות הדעת, על המקרה הקשה:** לקוח שדירג בלי לכתוב מילה
   * ובלי נייד תקין. זה בדיוק המצב שבו מגירה מתוכננת רע נראית ריקה.
   */
  'survey-detail': (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      <SurveyDetailSheet survey={SURVEY_DETAIL_ROW} open onOpenChange={() => {}} />
    </div>
  ),
  performance: <TeamPerformancePage />,
  'inbox-jump': <InboxBoard initialPhone={JUMP_PHONE} />,
  'inbox-jump-cold': <InboxBoard initialPhone={JUMP_PHONE} />,
  /** ⭐ בקרה חיובית: בלי קישור, השורה הראשונה עדיין נבחרת לבד. */
  'inbox-plain': <InboxBoard />,
  'inbox-urgent': <InboxBoard />,
  /** תמונה בבועת שיחה עם כפתור השמירה הצף. */
  'wa-image': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm rounded-2xl border bg-white p-4" style={{ borderColor: '#eef1f6' }}>
        <ImageThumb
          messageId="pm1"
          att={{ index: 0, name: 'תמונת-תקלה.jpg', kind: 'image', ready: true, sizeBytes: 120000 } as never}
        />
      </div>
    </div>
  ),
  /** רשימת ההערות מהסקרים: שם, מספר לקוח בפריוריטי, וכפתור וואטסאפ. */
  'survey-comments': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-5" style={{ borderColor: '#eef1f6' }}>
        <CustomerCommentsList rows={PREVIEW_COMMENTS} />
      </div>
    </div>
  ),
  /** כרטיס קריאה במסך הסדרן: חיווי תמונה מוגדל, וכפתור "כרטיס" ששרד שם ארוך. */
  'dispatch-card': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <DndContext>
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-4">
          {buildServiceCallItems(PREVIEW_CALLS, new Map(), undefined, PREVIEW_MEDIA, undefined, undefined, undefined, new Set([PREVIEW_CALLS[0]?.id ?? ''])).map((vm) => (
            <DispatchCard key={vm.id} vm={vm} accentBorder="border-s-orange-500" />
          ))}
        </div>
      </DndContext>
    </div>
  ),
  /** חדר הבקרה של אוטומציות הוואטסאפ, עם נתוני היום האמיתיים. */
  'wa-automations': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <WaAutomationsPage />
      </div>
    </div>
  ),
  /** כרטיס יומן במצב "לא בוצע": האיקס עם הסיבה צמודה אליו (30/08). */
  'calendar-x': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <DeliveryCalendar
          deliveries={[
            {
              id: 'g1',
              date: localDateStr(new Date()),
              driver: 'מוהנד',
              stops: [
                {
                  stopId: 'x1',
                  sourceId: 'o1',
                  sourceType: 'delivery',
                  status: 'not_completed',
                  deliveryDate: localDateStr(new Date()),
                  driver: 'מוהנד',
                  customerName: 'חיל סעידה מזל',
                  address: 'שער אפרים',
                  city: 'שער אפרים',
                  phone: '0544362341',
                  resolutionNote: 'הלקוח לא היה בבית',
                  resolutionKind: 'not_done',
                },
                {
                  stopId: 'x2',
                  sourceId: 'o2',
                  sourceType: 'delivery',
                  status: 'not_completed',
                  deliveryDate: localDateStr(new Date()),
                  driver: 'מוהנד',
                  customerName: 'עצירה ישנה בלי סיבה',
                  city: 'טייבה',
                },
              ],
            },
          ]}
          onMoveStop={() => {}}
        />
      </div>
    </div>
  ),
  /** חיווי "תמונה לפני טכנאי": כל המצבים שמוצגים על כרטיס קריאה. */
  'media-badge': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-md space-y-2 rounded-2xl border bg-white p-5">
        {(['media_received', 'pending', 'first_sent', 'reminder_sent', 'replied_no_media', 'no_response', 'failed', 'no_phone'] as const).map((s) => {
          const b = mediaBadge(s);
          return b ? (
            <p key={s}>
              <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${MEDIA_BADGE_CLASS[b.tone]}`}>
                {b.label}
              </span>
            </p>
          ) : null;
        })}
      </div>
    </div>
  ),
  /** "ביקור אחרון" (בקשת עמי 30/08): שלושת המצבים של התג. */
  'visit-badge': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-white p-5">
        <div className="text-xs font-bold text-slate-500">טרי ובוצע, גלולה ירוקה:</div>
        <LastVisitBadge
          date={localDateStr(new Date(Date.now() - 5 * 86_400_000))}
          driver="דוד"
          outcome="completed"
        />
        <div className="text-xs font-bold text-slate-500">טרי ולא בוצע, גלולה ענברית:</div>
        <LastVisitBadge
          date={localDateStr(new Date(Date.now() - 2 * 86_400_000))}
          driver="רודי"
          outcome="not_completed"
        />
        <div className="text-xs font-bold text-slate-500">ישן, שורה שקטה עם תאריך:</div>
        <LastVisitBadge date="2026-05-28" driver="דוד" outcome="completed" />
      </div>
    </div>
  ),
  dup: <DupPreview />,
  'dup-future': <DupPreviewFuture />,
  driver: <DriverPreview />,
  'reason-followup': <ReasonPreview kind="follow_up" />,
  'reason-notdone': <ReasonPreview kind="not_done" />,
  surveys: <SurveysPage />,
  overview: <ManagementDashboard />,
  // 🔴 המסך פותח `-mx-4 sm:-mx-6` כדי להיצמד לדפנות של `AppShell`. בלי
  // ריפוד מקביל כאן הוא גולש מהחלון, ובעברית זה נראה בדיוק כמו תוכן
  // חתוך. [[rtl_overflow_scroll_shift]]
  /**
   * ⭐ **מסך הסדרן בטאב "הכל" בלי שום נתונים מוזנים.** ארבע השאילתות
   * ייכשלו (אין הרשאה בתצוגה המקדימה), וזה בדיוק המצב שצריך לראות:
   * "הרשימה לא נטענה" ולא "אין הזמנות ממתינות לתיאום".
   */
  dispatch: <DispatchPage />,
  /**
   * ⭐ **דוח הטעינה עם שליפה שנכשלה, מוזרק.** זה המצב שאי אפשר לייצר
   * לפי דרישה בדפדפן, והוא בדיוק המצב שהכלי נבנה בשבילו.
   * המספרים מהמדידה האמיתית של המסך.
   */
  'load-report': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-5">
        <LoadReportPanel
          open
          onToggle={() => {}}
          report={analyzeLoad([
            { name: 'orders', startedAt: 40, endedAt: 380, rows: 0, pages: 1, failed: 'TypeError: Failed to fetch' },
            { name: 'customers', startedAt: 55, endedAt: 6100, rows: 245, pages: 5 },
            { name: 'pickups', startedAt: 45, endedAt: 2900, rows: 5642, pages: 6 },
            { name: 'service_calls', startedAt: 42, endedAt: 1800, rows: 6215, pages: 7 },
            { name: 'calendar_stops', startedAt: 44, endedAt: 700, rows: 892, pages: 1 },
          ])}
        />
      </div>
    </div>
  ),
  'dispatch-error': <DispatchPage />,
  training: (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4">
      <CraneTrainingDialog
        open
        onOpenChange={() => {}}
        craneSerial="17517098728"
        customerName="כהן דוד"
        technicianName="אבי"
      />
    </div>
  ),
  'collections-dialog': (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4">
      <CustomerDebtDialog
        row={AGING_FIXTURE[2]}
        userName="רונן"
        onClose={() => {}}
        onSaved={() => {}}
      />
    </div>
  ),
  collections: (
    <div className="px-4 py-6 sm:px-6">
      <CollectionsPage />
    </div>
  ),
  crane: (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4">
      <CraneChecklistDialog
        open
        onOpenChange={() => {}}
        craneSerial="G175-04821"
        customerName="כהן דוד"
        technicianName="אבי"
      />
    </div>
  ),
};

/**
 * דוח הבוקר עם "המשך טיפול" כמונה נפרד (עידן, 15/09/2026). הנתונים הם
 * התשובה האמיתית של `morning_report('2026-09-14')` אחרי השינוי: 19 סופקו,
 * 1 המשך טיפול (אולג), 7 לא סופקו, 1 פתוחה.
 */
import { MorningReportPage } from '@/pages/MorningReportPage';
import type { MorningReport } from '@/lib/morning-report';
if (view === 'morning') {
  const nd = (id: string, customer: string, city: string, driver: string, source: string, note: string, kind = 'not_done') =>
    ({ id, customer, city, driver, source, kind, reason: note, note });
  const report: MorningReport = {
    date: '2026-09-14',
    dow: 1,
    totals: { planned: 28, delivered: 19, not_delivered: 7, follow_up: 1, open: 1, drivers: 5 },
    byDriver: [
      { name: 'דוד חסידים', kind: 'both', planned: 7, delivered: 7, not_delivered: 0, follow_up: 0, open: 0 },
      { name: 'רודי', kind: 'driver', planned: 7, delivered: 4, not_delivered: 3, follow_up: 0, open: 0 },
      { name: 'אבי', kind: 'technician', planned: 5, delivered: 3, not_delivered: 2, follow_up: 0, open: 0 },
      { name: 'אולג', kind: 'technician', planned: 5, delivered: 3, not_delivered: 1, follow_up: 1, open: 0 },
      { name: 'ישראל', kind: 'technician', planned: 4, delivered: 2, not_delivered: 1, follow_up: 0, open: 1 },
    ],
    followUp: [nd('f1', 'כהן יונתן יוסף', 'רמלה', 'אולג', 'service', 'חסר חלק, צריך להזמין', 'follow_up')],
    notDelivered: [
      nd('n1', 'בטאש מעיין', 'רעננה', 'אבי', 'service', 'ייתאמו למעבדה'),
      nd('n2', 'דיין אורטל', 'נתניה', 'אבי', 'service', 'תתאם מחדש לא בבית'),
      nd('n3', 'בורשטיין אביטל', 'מודיעין עילית', 'אולג', 'service', 'הלקוח לא היה בבית'),
      nd('n4', 'מרים טקלה', 'נתניה', 'ישראל', 'service', 'אין אף אחד'),
      nd('n5', 'פודכלבניק טובה', 'כפר סבא', 'רודי', 'task', 'הלקוח לא היה בבית'),
      nd('n6', 'איזדי אריאלה', 'אור יהודה', 'רודי', 'pickup', 'הלקוח לא היה בבית'),
      nd('n7', 'געסיס חסנה', 'לוד', 'רודי', 'delivery', 'הלקוח לא היה בבית'),
    ],
    open: [{ id: 'o1', customer: 'גולדמן אברהם', city: 'תל אביב', driver: 'ישראל', source: 'service', status: 'planned', arrived: false }],
    trend: [
      { date: '2026-08-30', planned: 43, delivered: 33, not_delivered: 5, follow_up: 1, open: 4 },
      { date: '2026-08-31', planned: 46, delivered: 25, not_delivered: 2, follow_up: 0, open: 19 },
      { date: '2026-09-01', planned: 36, delivered: 27, not_delivered: 2, follow_up: 1, open: 6 },
      { date: '2026-09-02', planned: 38, delivered: 29, not_delivered: 2, follow_up: 0, open: 7 },
      { date: '2026-09-03', planned: 52, delivered: 35, not_delivered: 1, follow_up: 1, open: 15 },
      { date: '2026-09-06', planned: 41, delivered: 30, not_delivered: 3, follow_up: 0, open: 8 },
      { date: '2026-09-07', planned: 53, delivered: 43, not_delivered: 2, follow_up: 0, open: 8 },
      { date: '2026-09-08', planned: 34, delivered: 27, not_delivered: 2, follow_up: 0, open: 5 },
      { date: '2026-09-09', planned: 44, delivered: 33, not_delivered: 6, follow_up: 0, open: 5 },
      { date: '2026-09-10', planned: 35, delivered: 20, not_delivered: 8, follow_up: 1, open: 6 },
      { date: '2026-09-14', planned: 28, delivered: 19, not_delivered: 7, follow_up: 1, open: 1 },
    ],
    months: [
      { month: '2026-09-01', workdays: 9, planned: 361, delivered: 263, not_delivered: 33, follow_up: 4, open: 61 },
      { month: '2026-08-01', workdays: 22, planned: 439, delivered: 321, not_delivered: 51, follow_up: 1, open: 66 },
      { month: '2026-07-01', workdays: 22, planned: 376, delivered: 214, not_delivered: 55, follow_up: 0, open: 107 },
    ],
  };
  previewQc.setQueryData(['morningReport', 'default'], report);
  VIEWS.morning = <MorningReportPage />;
}

/**
 * ⭐ כרטיס הקריאה לנהג (15/09/2026). הנתונים הם מה שהחזירה `stop_call_info`
 * על SC2603230 בהרשאות של הנהג אבי; התמונה היא העותק הציבורי שכבר בצ'אט
 * הקריאה, כי הדלי הפרטי דורש התחברות.
 * `?view=callinfo` · `?view=callinfo-empty`
 */
import { StopCallInfoSheet } from '@/components/driver/StopCallInfoSheet';
import type { SignedCallInfo } from '@/hooks/useStopCallInfo';
if (view === 'callinfo' || view === 'callinfo-empty') {
  const empty = view === 'callinfo-empty';
  const IMG = 'https://kukstfxtznymfkirdmty.supabase.co/storage/v1/object/public/timeline-files/wa-media/c70aaf46-6a43-4d15-a769-4c40ed1f81a3/1789371235879-0.jpeg';
  const stop = driverStop({
    id: 'ci1', sourceType: 'service', serviceCallId: 'sc1',
    customerName: empty ? 'גולדמן אברהם' : "קוסקס הוברט ז'וזף יוסף",
    address: 'מכנס גד 31/15', city: 'נתניה', phone: '054-5498033',
    timeWindowStart: '15:00', timeWindowEnd: '17:00', coordinationStatus: 'customer_confirmed',
  });
  const img = (n: number, at: string) => ({ messageId: `m${n}`, index: 0, at, type: 'image' as const, path: `p${n}` });
  const info: SignedCallInfo = empty
    ? {
        stopId: 'ci1', kind: 'service', order: null, pickup: null, call: { id: 'sc1', docno: 'SC2603301' }, media: [], texts: [], officeNote: null,
        mediaRequest: { state: 'sent', sentAt: '2026-09-15T06:12:00Z' }, doc: null, urls: {},
      }
    : {
        stopId: 'ci1', kind: 'service', order: null, pickup: null,
        call: {
          id: 'sc1', docno: 'SC2603230', faultText: 'ברקס בגב הכסא לא נועל',
          deviceDesc: 'גב הטייה 40 ר.פ.מ.גרדיאן תוצרת SUNRISE MEDICAL', deviceSerial: 'A180606718',
        },
        media: [
          img(1, '2026-09-14T07:33:49Z'), img(2, '2026-09-14T07:33:49Z'), img(3, '2026-09-14T07:33:49Z'),
          img(4, '2026-09-14T07:33:50Z'), img(5, '2026-09-14T07:46:08Z'),
          { messageId: 'v1', index: 0, at: '2026-09-14T07:47:00Z', type: 'video', path: 'v1' },
        ],
        texts: [
          { messageId: 't1', at: '2026-09-14T07:39:09Z', body: 'הנה הכיסא' },
          { messageId: 't2', at: '2026-09-14T07:39:16Z', body: 'הפרקסים לא עובדים' },
          { messageId: 't3', at: '2026-09-14T07:39:24Z', body: 'נראה לי צד שמאל' },
        ],
        officeNote: { userName: 'עמי גז', content: 'ברקס בגב הכסא לא נועל', at: '2026-09-14T14:41:33Z' },
        mediaRequest: { state: 'media_received', sentAt: '2026-09-14T07:30:13Z', receivedAt: '2026-09-14T07:33:55Z' },
        // טופס הקריאה מפריוריטי (19/10/2026): עמוד אחד, נפתח למסך מלא.
        doc: {
          docno: 'SC2603758', status: 'לביצוע', docDate: '2026-10-19',
          receivedAt: '2026-10-19T04:55:29Z', pdfPath: 'SC2603758/x.pdf', pagePaths: ['dp1'],
        },
        urls: { p1: IMG, p2: IMG, p3: IMG, p4: IMG, p5: IMG, v1: IMG, dp1: IMG },
      };
  previewQc.setQueryData(['stopCallInfo', 'ci1'], info);
  VIEWS[view] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-3">
      <div className="mx-auto" style={{ width: 384 }}>
        <DriverStopCard
          stop={stop}
          index={6}
          onCoordinate={() => {}}
          onArrive={() => {}}
          onResolve={() => {}}
          resolving={false}
          infoCounts={empty ? null : { stopId: 'ci1', hasFault: true, images: 5, videos: 1, texts: 3 }}
        />
      </div>
      <StopCallInfoSheet stop={stop} open onOpenChange={() => {}} onOpenChat={() => {}} />
    </div>
  );
}

/**
 * כרטיס שירות ביומן של המשרד נפתח לכרטיס הקריאה (עידן, 15/09/2026: "גם במסך של כולם").
 * `?view=calendar-callinfo` — לוחצים על הכרטיס או על "פרטי הקריאה".
 */
/** אותה סף גרירה כמו במסכים האמיתיים (6 פיקסלים), כדי שלחיצה על הכרטיס תיבדק כמו שהיא. */
function RealDnd({ children }: { children: React.ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  return <DndContext sensors={sensors}>{children}</DndContext>;
}
if (view === 'calendar-callinfo') {
  const IMG = 'https://kukstfxtznymfkirdmty.supabase.co/storage/v1/object/public/timeline-files/wa-media/c70aaf46-6a43-4d15-a769-4c40ed1f81a3/1789371235879-0.jpeg';
  const today = localDateStr(new Date());
  previewQc.setQueryData(['stopCallInfo', 'cal1'], {
    stopId: 'cal1', kind: 'service', order: null, pickup: null,
    call: {
      id: 'sc1', docno: 'SC2603230', faultText: 'ברקס בגב הכסא לא נועל',
      deviceDesc: 'גב הטייה 40 ר.פ.מ.גרדיאן תוצרת SUNRISE MEDICAL', deviceSerial: 'A180606718',
    },
    media: [
      { messageId: 'm1', index: 0, at: '2026-09-14T07:33:49Z', type: 'image', path: 'p1' },
      { messageId: 'm2', index: 0, at: '2026-09-14T07:33:50Z', type: 'image', path: 'p2' },
      { messageId: 'v1', index: 0, at: '2026-09-14T07:47:00Z', type: 'video', path: 'v1' },
    ],
    texts: [{ messageId: 't1', at: '2026-09-14T07:39:16Z', body: 'הפרקסים לא עובדים' }],
    officeNote: { userName: 'עמי גז', content: 'ברקס בגב הכסא לא נועל', at: '2026-09-14T14:41:33Z' },
    mediaRequest: { state: 'media_received', sentAt: '2026-09-14T07:30:13Z', receivedAt: '2026-09-14T07:33:55Z' },
    doc: null,
    urls: { p1: IMG, p2: IMG, v1: IMG },
  } satisfies SignedCallInfo);
  VIEWS[view] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <RealDnd>
          <DeliveryCalendar
            deliveries={[
              {
                id: 'g1', date: today, driver: 'אבי',
                stops: [
                  {
                    stopId: 'cal1', sourceId: 'sc1', sourceType: 'service', status: 'planned',
                    deliveryDate: today, driver: 'אבי', customerName: "קוסקס הוברט ז'וזף יוסף",
                    address: 'מכנס גד 31/15', city: 'נתניה', phone: '0545498033',
                    timeWindowStart: '15:00', timeWindowEnd: '17:00', scheduledBy: 'עמי גז',
                  },
                  {
                    stopId: 'cal2', sourceId: 'o1', sourceType: 'delivery', status: 'planned',
                    deliveryDate: today, driver: 'אבי', customerName: 'בתיה שפירו',
                    address: 'אלתרמן 8', city: 'רחובות', phone: '0523248420',
                  },
                ],
              },
            ]}
            onResolveStop={() => {}}
          />
        </RealDnd>
      </div>
    </div>
  );
}


/**
 * חיווי מסמכים מצורפים ביומן (עידן, 21/10/2026): `?view=calendar-docs`.
 * תעודה שמחכה · תעודה שנחתמה · טופס קריאה + תיקון חתום · החזרה חתומה · בלי מסמך.
 */
if (view === 'calendar-docs') {
  const today = localDateStr(new Date());
  const base = { status: 'planned' as const, deliveryDate: today, driver: 'רודי' as const, scheduledBy: 'עמי גז', city: 'נתניה', phone: '0524613444' };
  const stops = [
    { ...base, stopId: 'k1', sourceId: 'o1', sourceType: 'delivery' as const, customerName: 'אוגוסט נ לוזון', address: 'סמילנסקי 21', timeWindowStart: '09:00', timeWindowEnd: '11:00' },
    { ...base, stopId: 'k2', sourceId: 'o2', sourceType: 'delivery' as const, customerName: 'גרינפסט רייצל', address: 'הרצל 4', timeWindowStart: '10:00', timeWindowEnd: '12:00', status: 'completed' as const },
    { ...base, stopId: 'k3', sourceId: 'sc1', sourceType: 'service' as const, customerName: 'מרים טקלה', address: 'ויצמן 9', timeWindowStart: '12:00', timeWindowEnd: '14:00' },
    { ...base, stopId: 'k4', sourceId: 'pk1', sourceType: 'pickup' as const, customerName: 'אפל רחל', address: 'החבצלת 8', timeWindowStart: '13:00', timeWindowEnd: '15:00' },
    { ...base, stopId: 'k5', sourceId: 'o3', sourceType: 'delivery' as const, customerName: 'רבינוביץ רות', address: 'השומרון 61', timeWindowStart: '15:00', timeWindowEnd: '17:00' },
  ];
  const sig = (formKey: string) => ({ pdfPath: 'x.pdf', formKey, signedAt: '2026-10-21T08:00:00Z' });
  previewQc.setQueryData(['stopDocs', ['k1', 'k2', 'k3', 'k4', 'k5'].join(',')], {
    k1: { noteDocno: 'SH2604201', signed: [] },
    k2: { noteDocno: 'SH2604188', signed: [sig('delivery_note'), sig('delivery_note')] },
    k3: { signed: [sig('moh-repair')] },
    k4: { signed: [sig('moh-return')] },
  });
  previewQc.setQueryData(['callsWithDoc', 'sc1'], { sc1: { docno: 'SC2603301' } });
  VIEWS[view] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <RealDnd>
          <DeliveryCalendar deliveries={[{ id: 'g1', date: today, driver: 'רודי', stops }]} onResolveStop={() => {}} />
        </RealDnd>
      </div>
    </div>
  );
}

/**
 * ספר הטלפונים עם דלת ידנית (עמי, 06-07/10/2026) ועריכת פרטי עצירה.
 * `?view=phonebook` : הרכיב לבד + בתוך כרטיס הקריאה ביומן.
 * `?view=stop-edit` : דיאלוג העריכה פתוח על עצירת שירות.
 */
/**
 * כרטיס העצירה לאספקה ולאיסוף (עמי, 06/10/2026): `?view=delivery-info` · `?view=pickup-info`.
 * המטען הוא מה ש-stop_call_info החזירה בפועל ב-08/10 (SO2602255, RT2601900) בהרשאות נהג.
 */
if (view === 'delivery-info' || view === 'pickup-info') {
  const today = localDateStr(new Date());
  const base = { call: null, media: [], texts: [], mediaRequest: null, doc: null, urls: {}, pickup: null, order: null };
  previewQc.setQueryData(['stopCallInfo', 'd1'], {
    ...base, stopId: 'd1', kind: 'delivery',
    order: {
      id: 'o1', docno: 'SO2602255', orderType: 'משרד הבריאות', healthFund: 'כללית הנדסה', priorityStatus: 'שולמה', agent: 'משרד',
      items: [
        { part: '218RAFPS', desc: 'גרדיאן שלמות רוחב מושב 45 תוצרת SUNRISE MEDICAL', qty: 1 },
        { part: 'CLRSHLEC2271', desc: 'חגורת אגן לייצוב', qty: 1 },
        { part: 'G175', desc: 'מנוף חשמלי SUNRISE MEDICAL למשקל עד 175 ק"ג', qty: 1, serial: 'A180606718' },
      ],
    },
    officeNote: { userName: 'עמי גז', content: 'להרכיב את החגורה אצל הלקוח ולהראות לבת איך סוגרים', at: '2026-10-08T06:41:33Z' },
  } satisfies SignedCallInfo);
  previewQc.setQueryData(['stopCallInfo', 'p1'], {
    ...base, stopId: 'p1', kind: 'pickup',
    pickup: {
      id: 'pk1', docno: 'RT2601900', pickupStatus: 'ממתין לתאום', toWarehouse: 'משרד הבריאות', totalQty: 2, sourceOrder: 'SO2601553',
      lines: [
        { part: 'G175', desc: 'מנוף חשמלי SUNRISE MEDICAL למשקל עד 175 ק"ג', qty: 1, unit: "יח'", sourceOrder: 'SO2601553' },
        { part: 'CHG1', desc: 'מטען למנוף', qty: 1, returnReason: 'תקול' },
      ],
    },
    officeNote: null,
  } satisfies SignedCallInfo);
  previewQc.setQueryData(phoneBookKey('52122900'), []);
  const dStop = {
    stopId: 'd1', sourceId: 'o1', sourceType: 'delivery' as const, status: 'planned' as const,
    deliveryDate: today, driver: 'רודי' as const, customerName: 'דניאל דולי', customerNumber: '52122900',
    address: 'אלתרמן 8', city: 'רחובות', phone: '0523248420', timeWindowStart: '09:00', timeWindowEnd: '11:00', scheduledBy: 'עמי גז',
  };
  const pStop = { ...dStop, stopId: 'p1', sourceId: 'pk1', sourceType: 'pickup' as const, driver: 'דוד חסידים' as const, customerName: 'וולנרמן עדי' };
  VIEWS['delivery-info'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <RealDnd><DeliveryCalendar deliveries={[{ id: 'g1', date: today, driver: 'רודי', stops: [dStop, pStop] }]} /></RealDnd>
        <StopCallInfoSheet calendarStop={dStop} open onOpenChange={() => undefined} />
      </div>
    </div>
  );
  VIEWS['pickup-info'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <StopCallInfoSheet calendarStop={pStop} open onOpenChange={() => undefined} />
      </div>
    </div>
  );
}

/**
 * משימות למשרד (08/10/2026): `?view=tasks` (הרשימה, "שלי" = המשתמש הריק של התצוגה) · `?view=tasks-new` (הדיאלוג).
 */
if (view === 'tasks' || view === 'tasks-new') {
  const today = localDateStr(new Date());
  const d = (days: number) => { const x = new Date(); x.setDate(x.getDate() + days); return localDateStr(x); };
  const row = (o: Record<string, unknown>) => ({
    details: null, customer_number: null, customer_name: null, created_by: 'm1', created_by_name: 'עמי גז',
    due_date: null, priority: 'normal', status: 'open', done_at: null, done_by: null, done_note: null,
    created_at: '2026-10-06T07:12:00Z', updated_at: '2026-10-06T07:12:00Z', assignee_id: '', assignee_name: 'אילונה', ...o,
  });
  previewQc.setQueryData(OFFICE_TASKS_KEY, [
    row({ id: 't1', title: 'להתקשר לאבו ג\'אנם ולתאם החלפת מצבר למנוף', customer_number: '037460839', customer_name: "אבו ג'אנם הודה", due_date: d(-1), priority: 'high', details: 'הבת ביקשה אחרי 14:00. המצבר במלאי לפי עמי.' }),
    row({ id: 't2', title: 'לשלוח לקופה אישור אספקה SO2602255', customer_number: '52122900', customer_name: 'דניאל דולי', due_date: today }),
    row({ id: 't3', title: 'לבדוק מול כללית הנדסה למה ההזמנה של וולנרמן תקועה', due_date: d(2), created_by: 's1', created_by_name: 'שלומי קורן' }),
    row({ id: 't4', title: 'לעדכן את שורה על הנוהל החדש לבקשת תמונות', assignee_id: 'u2', assignee_name: 'שורה', due_date: d(5) }),
    row({ id: 't5', title: 'להזכיר לרונן לחתום על הזמנת הרכש', status: 'done', done_at: '2026-10-07T13:40:00Z', done_by: 'אילונה', done_note: 'חתם, נשלח לספק', updated_at: '2026-10-07T13:40:00Z' }),
  ].map((r) => rowToTask(r as OfficeTaskRow)));
  previewQc.setQueryData(['profiles'], [
    { id: 'u1', email: 'ilona@rashal.internal', username: 'אילונה', fullName: 'אילונה', role: 'viewer', disabled: false, createdAt: '2026-08-01T00:00:00Z' },
    { id: 'u2', email: 'shura@rashal.internal', username: 'שורה', fullName: 'שורה', role: 'viewer', disabled: false, createdAt: '2026-08-01T00:00:00Z' },
    { id: 'm1', email: 'ami@rashal.internal', username: 'עמי', fullName: 'עמי גז', role: 'team_manager', disabled: false, createdAt: '2026-08-01T00:00:00Z' },
    { id: 'd1', email: 'avi@rashal.internal', username: 'אבי', fullName: 'אבי', role: 'driver', disabled: false, createdAt: '2026-08-01T00:00:00Z' },
  ]);
  VIEWS['tasks'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl"><TasksPage initialTab="all" /></div>
    </div>
  );
  VIEWS['tasks-new'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <OfficeTaskDialog open onOpenChange={() => undefined} onSubmit={() => undefined} defaultAssigneeId="u1" />
    </div>
  );
}

/** צ'אט צוות (09/10/2026): `?view=staff-chat&to=avi`. "אני" = המשתמש הריק של התצוגה. */
if (view === 'staff-chat') {
  const m = (o: Record<string, unknown>) => rowToMessage({ id: String(o.id), sender_id: String(o.from), sender_name: String(o.fromName ?? o.from), recipient_id: String(o.to), recipient_name: String(o.toName ?? o.to), body: String(o.body), created_at: String(o.at), read_at: (o.read as string) ?? null } as StaffMessageRow);
  previewQc.setQueryData(STAFF_PEOPLE_KEY, [
    { id: 'ami', name: 'עמי גז', role: 'team_manager' },
    { id: 'avi', name: 'אבי', role: 'driver', linkedDriver: 'אבי' },
    { id: 'oleg', name: 'אולג בולשטיין', role: 'driver', linkedDriver: 'אולג' },
    { id: 'shura', name: 'שורה', role: 'viewer' },
    { id: 'shlomi', name: 'שלומי קורן', role: 'management' },
  ]);
  previewQc.setQueryData(STAFF_MESSAGES_KEY, [
    m({ id: '1', from: 'avi', fromName: 'אבי', to: '', toName: 'אילונה', body: 'הגעתי לדניאל דולי, אין מענה בדלת ובטלפון. ממשיך הלאה?', at: '2026-10-09T07:41:00Z' }),
    m({ id: '2', from: '', fromName: 'אילונה', to: 'avi', toName: 'אבי', body: 'רגע, אני מתקשרת לבת', at: '2026-10-09T07:42:00Z', read: '2026-10-09T07:42:30Z' }),
    m({ id: '3', from: 'avi', fromName: 'אבי', to: '', toName: 'אילונה', body: 'אוקיי מחכה ברכב', at: '2026-10-09T07:43:00Z' }),
    m({ id: '4', from: 'ami', fromName: 'עמי גז', to: '', toName: 'אילונה', body: 'תזכרי להוציא היום את האישורים לקופה', at: '2026-10-09T06:10:00Z', read: '2026-10-09T06:12:00Z' }),
    m({ id: '5', from: '', fromName: 'אילונה', to: 'shura', toName: 'שורה', body: 'שלחתי לך את הנוהל במייל', at: '2026-10-08T12:00:00Z' }),
  ]);
  // נעוצים וסדר ידני (09/10/2026): שלומי נעוץ, ואחרי הנעוצים שורה לפני עמי.
  previewQc.setQueryData([...STAFF_PREFS_KEY, ''], { pinned: ['shlomi'], sortOrder: ['shura', 'ami'] });
  VIEWS['staff-chat'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl"><StaffChatPage /></div>
    </div>
  );
}

if (view === 'phonebook' || view === 'stop-edit' || view === 'stop-card' || view === 'other-number' || view === 'save-contact') {
  const today = localDateStr(new Date());
  // ⭐ המתג מוצג רק למשרד (`useIsOfficeEditor`). בלי התחברות, `user` ריק.
  previewQc.setQueryData(['profile', undefined], { id: 'p', role: 'dispatcher', disabled: false });
  previewQc.setQueryData(phoneBookKey('037460839'), [
    { kind: 'muted', phone_local: '0523694547', label: null, created_by: 'עמי גז', created_at: '2026-10-13T08:00:00Z', priority_pushed_at: null },
    { kind: 'linked', phone_local: '0587777777', label: 'הבת, מיכל', created_by: 'עמי גז', created_at: '2026-10-02T10:00:00Z', priority_pushed_at: '2026-10-02T10:15:00Z' },
    { kind: 'linked', phone_local: '0501234567', label: null, created_by: 'אולג', created_at: '2026-10-08T07:00:00Z', priority_pushed_at: null },
    { kind: 'priority', phone_local: '0541111111', label: 'דנה · פיזיותרפיסטית', created_by: null, created_at: '2026-09-01T00:00:00Z', priority_pushed_at: null },
  ]);
  previewQc.setQueryData(['stopCallInfo', 'cal1'], {
    stopId: 'cal1', kind: 'service', order: null, pickup: null,
    call: { id: 'sc1', docno: 'SC2602269', faultText: 'בדיקת כ"ג: תיקון וחיזוק ברקסים', deviceDesc: 'RUBIX43*43.5S' },
    media: [], texts: [], officeNote: null,
    mediaRequest: { state: 'waiting', sentAt: '2026-10-08T07:30:13Z' },
    doc: null,
    urls: {},
  } satisfies SignedCallInfo);
  const stop = {
    stopId: 'cal1', sourceId: 'sc1', sourceType: 'service' as const, status: 'planned' as const,
    deliveryDate: today, driver: 'אולג' as const, customerName: "אבו ג'אנם הודה", customerNumber: '037460839',
    address: 'הרצל 5', city: 'חדרה', phone: '0523694547', timeWindowStart: '10:00', timeWindowEnd: '12:00', scheduledBy: 'עמי גז',
  };
  VIEWS['phonebook'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-xl border bg-white p-3">
          <div className="mb-1 text-[12.5px] font-bold text-slate-800">טלפונים (כרטיס הלקוח)</div>
          <CustomerPhoneBook customerNumber="037460839" mainPhone="0523694547" />
        </div>
        <div className="rounded-xl border bg-white p-3">
          <div className="mb-1 text-[12.5px] font-bold text-slate-800">בלי מספר לקוח</div>
          <CustomerPhoneBook customerNumber={null} mainPhone="0523694547" />
        </div>
        <StopCallInfoSheet calendarStop={stop} open onOpenChange={() => undefined} />
      </div>
    </div>
  );
  // "שלח למספר אחר" מהתיבה (13/10/2026): בחירת מספר, ואחרי השליחה שאלת השמירה.
  const otherCustomer = { number: '037460839', name: "אבו ג'אנם הודה", mainPhone: '0523694547' };
  VIEWS['other-number'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <OtherNumberDialog open onOpenChange={() => undefined} customer={otherCustomer} onContinue={() => undefined} />
    </div>
  );
  VIEWS['save-contact'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <SaveContactPrompt open onOpenChange={() => undefined} customer={otherCustomer} phone="0529876543" />
    </div>
  );
  VIEWS['stop-card'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <RealDnd>
          <DeliveryCalendar deliveries={[{ id: 'g1', date: today, driver: 'אולג', stops: [stop] }]} />
        </RealDnd>
      </div>
    </div>
  );
  VIEWS['stop-edit'] = (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-sm">
        <RealDnd>
          <DeliveryCalendar deliveries={[{ id: 'g1', date: today, driver: 'אולג', stops: [stop] }]} />
        </RealDnd>
        <EditStopDetailsDialog stop={{ ...stop, address: 'בית ספר חצב' }} open onOpenChange={() => undefined} />
      </div>
    </div>
  );
}

// הפס "יש גרסה חדשה" (13/10/2026) מעל כותרת אמיתית.
VIEWS['new-version'] = (
  <div dir="rtl" className="min-h-screen bg-slate-50">
    <NewVersionBanner />
    <div className="p-6 pt-24 text-sm text-slate-600">תוכן המסך מתחת לפס</div>
  </div>
);

// טפסי הקופות (16/10/2026): `?view=form&form=<key>` לטופס במסך הטלפון,
// `?view=form-pdf&form=<key>` לדף כפי שייכנס ל-PDF (ממולא בנתוני דמה).
if (view === 'form' || view === 'form-pdf') {
  const def = getFormByKey(new URLSearchParams(location.search).get('form') ?? 'moh-repair')!;
  const lines = [{ name: 'כסא ממונע Q400 M תוצרת SUNRISE MEDICAL', serial: '230243950522921', catalog: 'SRQ400M' }];
  const ctx = buildContext({
    customerName: 'כהן משה', phone: '050-1234567', address: 'הרצל 12', city: 'רחובות', customerNumber: '8449321',
    healthFund: def.fundLabel, docNumber: 'SC2603627', deviceName: 'SRQ400M',
    deviceDesc: 'כסא ממונע Q400 M', deviceSerial: '230243950522921', installDate: '2024-05-02', faultDesc: 'הכסא לא נוסע אחורה', lines,
  }, 'דוד גוזלן', new Date(2026, 9, 16));
  if (view === 'form') {
    VIEWS.form = (
      <div dir="rtl" className="min-h-screen bg-slate-50">
        <SignFlow definition={def} context={ctx} lines={lines} driverName="דוד גוזלן" onCancel={() => undefined}
          initialStep={(new URLSearchParams(location.search).get('step') ?? undefined) as 'fill' | 'sign' | 'photos' | 'review' | undefined}
          // ⭐ בתצוגה המקדימה: ה-PDF האמיתי נוצר ונפתח בלשונית, בלי לשמור כלום.
          onSubmit={async (p) => {
            const blob = await generateFormPdf(def, p.values, p.signatures, p.signerNames,
              { customerName: ctx.customerName, orderNumber: 'SC2603627', driverName: 'דוד גוזלן', signedAt: new Date() }, p.photos);
            location.href = URL.createObjectURL(blob);
          }} />
      </div>
    );
  } else {
    const values = buildInitialValues(def, ctx, lines);
    for (const sec of def.sections) for (const f of sec.fields) {
      if (f.type === 'radio' && f.required && f.options) values[f.key] = f.options[0].value;
      if (f.type === 'id') values[f.key] = '000000018';
      if (f.key === 'returnReason') values[f.key] = 'החלפת מכשיר';
      if (f.key === 'returnReasonDetail') values[f.key] = 'הוחלף לכסא ממונע';
      if (f.key === 'dev1Detail') values[f.key] = 'משענת יד שרוטה';
    }
    const sig = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><path d="M10 60 C 60 10, 90 70, 140 30 S 220 60, 290 20" stroke="#1e3a8a" stroke-width="3" fill="none"/></svg>');
    const html = buildFormHtml(def, values, { customer: sig, driver: sig, guarantor: sig },
      { customer: 'כהן משה', driver: 'דוד גוזלן', guarantor: 'כהן רחל' },
      { customerName: 'כהן משה', orderNumber: 'SC2603627', driverName: 'דוד גוזלן', signedAt: new Date(2026, 9, 16, 11, 20), location: { lat: 31.89, lng: 34.81 } });
    // ⭐ `&compare=1`: הסריקה המקורית של עמי לצד ההעתק שלנו. הסריקות לא בריפו
    // (טפסים של הקופות); מקומית הן ב-`node_modules/.cache/scans/<key>.png`.
    const compare = new URLSearchParams(location.search).get('compare');
    VIEWS['form-pdf'] = compare ? (
      <div dir="rtl" style={{ background: '#e6e9ee', padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div><div style={{ fontWeight: 700, marginBottom: 6 }}>ההעתק שלנו</div><div dangerouslySetInnerHTML={{ __html: html }} /></div>
        <div><div style={{ fontWeight: 700, marginBottom: 6 }}>הטופס המקורי של עמי</div>
          {(def.key === 'meuhedet-delivery' ? [1, 2, 3].map((n) => `${def.key}-p${n}`) : [def.key]).map((f) => (
            <img key={f} src={`/node_modules/.cache/scans/${f}.png`} style={{ width: 794, background: '#fff', display: 'block', marginBottom: 0 }} />
          ))}</div>
      </div>
    ) : <div style={{ background: '#e6e9ee', padding: 20 }} dangerouslySetInnerHTML={{ __html: html }} />;
  }
}

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
