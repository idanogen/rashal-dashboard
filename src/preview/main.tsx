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
import { LastVisitBadge } from '@/components/customer/LastVisitBadge';
import { localDateStr } from '@/lib/visit-history';
import { mediaBadge, MEDIA_BADGE_CLASS } from '@/lib/media-request-badge';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import { FIXTURE } from '@/preview/customer-fixture';
import { DuplicateScheduleWarningDialog } from '@/components/deliveries/DuplicateScheduleWarningDialog';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { DriverStopCard, LeftoverStopCard } from '@/pages/DriverDashboardPage';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SurveysPage } from '@/pages/SurveysPage';
import { ManagementDashboard } from '@/pages/ManagementDashboard';
import { CraneChecklistDialog } from '@/components/crane/CraneChecklistDialog';
import { CraneTrainingDialog } from '@/components/crane/CraneTrainingDialog';
import { CollectionsPage, CustomerDebtDialog } from '@/pages/CollectionsPage';
import { LoadReportPanel } from '@/components/LoadReportLine';
import { analyzeLoad } from '@/lib/perf';
import { AuthProvider } from '@/lib/auth-context';
import { GlobalChatProvider } from '@/context/GlobalChatContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DispatchPage } from '@/pages/DispatchPage';
import { DispatchCard, UnscheduledPanel } from '@/components/dispatch/UnscheduledPanel';
import { Package } from 'lucide-react';
import { TaskDialog } from '@/components/deliveries/TaskDialog';
import { buildServiceCallItems } from '@/components/dispatch/items';
import { DndContext } from '@dnd-kit/core';
import type { ServiceCall } from '@/types/service-call';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { WaAutomationsPage } from '@/pages/WaAutomationsPage';
import { CustomerCommentsList } from '@/components/surveys/CustomerCommentsList';
import { SurveyDetailSheet } from '@/components/surveys/SurveyDetailSheet';
import { ImageThumb } from '@/components/wa/InboxBoard';
import type { CalendarStop } from '@/types/calendar-stop';
import { WeeklyTargetStrip } from '@/components/management/WeeklyTargetStrip';
import { deliveryTargetStatus as dts } from '@/lib/delivery-target';
import { DispatcherHome } from '@/components/dispatch/DispatcherHome';

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
          <MemoryRouter initialEntries={['/dispatch?tab=all']}>{children}</MemoryRouter>
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
          {buildServiceCallItems(PREVIEW_CALLS, new Map(), undefined, PREVIEW_MEDIA).map((vm) => (
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
