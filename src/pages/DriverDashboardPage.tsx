import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useArriveStop } from '@/hooks/useArriveStop';
import { useCurrentProfile } from '@/hooks/useProfile';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CoordinationStatusBadge } from '@/components/whatsapp/CoordinationStatusBadge';
import { ScheduleCoordinationDialog } from '@/components/whatsapp/ScheduleCoordinationDialog';
import { RouteMap } from '@/components/deliveries/RouteMap';
import { buildWazeUrl, buildTelUrl } from '@/lib/navigation';
import { compareStopsByTime } from '@/lib/stop-order';
import {
  MapPin,
  Phone,
  Navigation,
  Check,
  X,
  Clock,
  Truck,
  Package,
  Wrench,
  ClipboardList,
  Undo2,
  UserPlus,
  MessageCircle,
  Loader2,
  CalendarClock,
  ListChecks,
  AlertTriangle,
  Map as MapIcon,
  RotateCcw,
  BookOpenCheck,
  ClipboardCheck,
  Search,

  UserRound,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { buildVisitHistory } from '@/lib/visit-history';
import type { CalendarStop as DbCalendarStop, StopResolutionKind } from '@/types/calendar-stop';
import type { CalendarStop as UiCalendarStop } from '@/types/delivery';
import { OrderChatSheet } from '@/components/OrderChatSheet';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { CraneChecklistDialog } from '@/components/crane/CraneChecklistDialog';
import { CraneTrainingDialog } from '@/components/crane/CraneTrainingDialog';
import { craneInOrder, isCraneModel } from '@/lib/crane-identity';
import { useServiceCalls } from '@/hooks/useServiceCalls';
import { useOrders } from '@/hooks/useOrders';

/** המנוף שבעצירה: המספר הסידורי, ואיזה משני הטפסים הוא מזמין. */
export interface CraneContext {
  serial?: string;
  kind: 'inspection' | 'training';
}
import { DeliveryOutcomeDialog } from '@/components/DeliveryOutcomeDialog';
import { useCommentCounts } from '@/hooks/useTimeline';
import type { ChatSourceKind } from '@/lib/timeline';

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `יום ${dayNames[d.getDay()]}, ${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`;
}

function isResolved(status: DbCalendarStop['status']): boolean {
  return status === 'completed' || status === 'not_completed' || status === 'cancelled';
}

const SOURCE_CONFIG = {
  delivery: { Icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', label: 'משלוח' },
  service:  { Icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50', label: 'שירות' },
  task:     { Icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', label: 'משימה' },
  pickup:   { Icon: Undo2, color: 'text-teal-600', bg: 'bg-teal-50', label: 'איסוף' },
  customer: { Icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-50', label: 'לקוח חדש' },
} as const;

/** Convert a DB CalendarStop to the UI CalendarStop shape the dialog expects. */
function toUiStop(db: DbCalendarStop): UiCalendarStop {
  return {
    stopId: db.id,
    sourceId: db.orderId ?? db.serviceCallId ?? db.id,
    sourceType: db.sourceType,
    status: db.status,
    deliveryDate: db.deliveryDate,
    driver: db.driver,
    customerName: db.customerName,
    address: db.address,
    city: db.city,
    phone: db.phone,
    coordinationStatus: db.coordinationStatus,
    coordinationMethod: db.coordinationMethod,
    coordinatedAt: db.coordinatedAt,
    timeWindowStart: db.timeWindowStart,
    timeWindowEnd: db.timeWindowEnd,
  };
}

export function DriverDashboardPage() {
  const { data: profile } = useCurrentProfile();
  const { data: allStops, isLoading } = useCalendarStops();
  const resolveStop = useResolveStop();
  const arriveStop = useArriveStop();
  const log = useActivityLogger();
  const [coordinationStop, setCoordinationStop] = useState<UiCalendarStop | null>(null);
  const [notCompletedStop, setNotCompletedStop] = useState<DbCalendarStop | null>(null);
  /** העצירה שעליה נפתח צ'קליסט המנוף. */
  const [craneStop, setCraneStop] = useState<DbCalendarStop | null>(null);

  /**
   * ⭐ **איך יודעים שזו קריאה של מנוף.** עידן, 26/08: "אנחנו יודעים איזה
   * מוצר יש אצל הלקוח ואנחנו יודעים מתי זה מנוף." נבדק מול הנתונים,
   * 🔴 **וההכרעה הפוכה ממה שהצעתי תחילה:** שם המכשיר קובע, לא הצלבת
   * המספר הסידורי מול טבלת המנופים. הצלבה נותנת 1,756 קריאות, אבל
   * **מפספסת 93 קריאות מנוף אמיתיות** שהמספר שלהן אינו בטבלה, ומכניסה
   * 4 שאינן מנוף כלל, שהמספר שלהן התנגש במקרה. שם המכשיר נותן 1,845
   * נקיות. הטבלה נשארת להעשרה (אחריות, היסטוריית בדיקות), לא לזיהוי.
   */
  const { data: serviceCalls = [] } = useServiceCalls();
  const craneByCall = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const c of serviceCalls) {
      if (isCraneModel(c.deviceName)) m.set(c.id, c.deviceSerial);
    }
    return m;
  }, [serviceCalls]);

  /**
   * ⭐ **אספקה של מנוף, לעומת ביקור אצל מנוף.** בקריאת שירות המנוף כתוב
   * בשם המכשיר; באספקה הוא אחת משורות ההזמנה, ולכן הזיהוי כאן הוא לפי
   * המק״ט של השורה. 🔴 ולפי המק״ט בלבד: 4,500 שורות ערסל ו-3,000 שורות
   * השתתפות עצמית נושאות את המילה "מנוף" בתיאור, והתאמה על המילה הייתה
   * פותחת טופס הדרכה על אספקת ערסל.
   */
  const { data: orders = [] } = useOrders();
  const craneByOrder = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const o of orders) {
      const line = craneInOrder(o.items);
      if (line) m.set(o.id, line.serial ?? line.part ?? undefined);
    }
    return m;
  }, [orders]);

  /**
   * מה יש בעצירה הזאת, ואיזה טופס היא מזמינה.
   *
   * 🔴 **קריאת שירות קודמת להזמנה.** עצירה שיש לה גם וגם היא ביקור אצל
   * מנוף קיים, ושם הטופס הנכון הוא רשימת הבדיקה. טופס הדרכה שנפתח
   * בביקור תיקון היה מחתים לקוח על הדרכה שלא ניתנה.
   */
  const craneOf = (stop: DbCalendarStop): CraneContext | null => {
    if (stop.serviceCallId && craneByCall.has(stop.serviceCallId)) {
      return { serial: craneByCall.get(stop.serviceCallId), kind: 'inspection' };
    }
    if (stop.orderId && craneByOrder.has(stop.orderId)) {
      return { serial: craneByOrder.get(stop.orderId), kind: 'training' };
    }
    return null;
  };
  const craneCtx = craneStop ? craneOf(craneStop) : null;
  /** איזה כפתור פתח את הפופאפ. קובע את הניסוח ואת מה שנשמר. */
  const [notCompletedKind, setNotCompletedKind] = useState<StopResolutionKind>('not_done');
  const [showMap, setShowMap] = useState(true);
  /**
   * ⭐ הטאבים נשלטים מבחוץ מאז 31/08/2026: העצירות הפתוחות מימים קודמים
   * עברו לטאב משלהן (אצל רודי הצטברו 170 והן קברו את "היום"), והשורה
   * שנשארה בטאב היום צריכה כפתור שקופץ לשם.
   */
  const [tab, setTab] = useState('today');

  /** הקשר אירוע אחיד לעצירה — לדוחות. */
  const stopCtx = (stop: DbCalendarStop) => ({
    entityType: 'calendar_stop' as const,
    entityId: stop.id,
    sourceType: stop.sourceType,
    customerName: stop.customerName,
  });

  // "לא בוצע" ו"המשך טיפול" → פופאפ לרישום סיבה; "סופק" → סימון מיידי.
  //
  // 🔴 **שניהם נסגרים כ-`not_completed` בכוונה**, כי ההתנהגות זהה: העצירה
  // נסגרת והמקור חוזר לרשימת הממתינים. ההבדל הוא ב-`kind`, וזה מה שהמשרד
  // רואה: "לא הגיע" מול "הגיע, וצריך להשלים".
  const handleResolve = (
    stop: DbCalendarStop,
    status: 'completed' | 'not_completed',
    notes?: string,
    kind?: StopResolutionKind,
  ) => {
    if (status === 'not_completed') {
      setNotCompletedStop(stop);
      setNotCompletedKind(kind ?? 'not_done');
    } else {
      log('stop_completed', {
        ...stopCtx(stop),
        ...(notes ? { metadata: { deliveryOutcome: notes } } : {}),
      });
      resolveStop.mutate({ stop, status, notes });
    }
  };

  const handleCoordinate = (stop: DbCalendarStop) => {
    log('coordinate_open', stopCtx(stop));
    setCoordinationStop(toUiStop(stop));
  };

  // נעילת כפתורים רק לכרטיס שנמצא כרגע בעדכון — לא לכל הכרטיסים.
  // react-query חושף את ה-variables של המוטציה הפעילה, כך שנזהה בדיוק מי.
  const isResolvingStop = (id: string) =>
    resolveStop.isPending && resolveStop.variables?.stop.id === id;

  // "הגעה" — מסמן שהנהג בנקודה (status → in_progress) + רישום ללוג.
  // מחזיר את ה-promise כדי שהכרטיס יוכל לאפס את החיווי אם הכתיבה נכשלה.
  const handleArrive = (stop: DbCalendarStop) => {
    log('arrival', stopCtx(stop));
    return arriveStop.mutateAsync(stop.id);
  };

  const today = toLocalDateStr(new Date());
  const tomorrow = toLocalDateStr(new Date(Date.now() + 86_400_000));

  // RLS already filters to this driver's stops only. Group by date.
  const stopsByDate = useMemo(() => {
    const map = new Map<string, DbCalendarStop[]>();
    for (const s of allStops ?? []) {
      if (s.status === 'cancelled') continue;
      const list = map.get(s.deliveryDate) ?? [];
      list.push(s);
      map.set(s.deliveryDate, list);
    }
    // סדר קנוני משותף עם כל המסכים: שעת תיאום ראשי, sequence שובר-שוויון.
    for (const list of map.values()) {
      list.sort(compareStopsByTime);
    }
    return map;
  }, [allStops]);

  // 🔴🔴 **לוח העבודה מסונן לשלו, וההיסטוריה לא.** מ-02/09/2026 ה-RLS
  // מחזיר גם עצירות **סגורות** של עובדים אחרים אצל לקוח שהנהג נוסע אליו,
  // וזו בדיוק המטרה. אבל בלי ההפרדה הזאת עצירה שעמית סגר היום אצל אותו
  // לקוח הייתה נוחתת ב"היום שלי" ונראית כמו עבודה שלו.
  const myStopsByDate = useMemo(() => {
    const mine = profile?.linkedDriver;
    if (!mine) return stopsByDate;
    const map = new Map<string, DbCalendarStop[]>();
    for (const [date, stops] of stopsByDate.entries()) {
      const kept = stops.filter((s) => !s.driver || s.driver === mine);
      if (kept.length) map.set(date, kept);
    }
    return map;
  }, [stopsByDate, profile?.linkedDriver]);

  const todayStops = myStopsByDate.get(today) ?? [];

  // 🔴 עצירות מימים שעברו שנשארו פתוחות. במדידה של 12/08/2026 היו 116 כאלה
  // במערכת, רובן במצב "הגעתי" בלי סגירה. הנהג מעולם לא ראה אותן: המסך שלו
  // מציג רק היום, מחר והשבוע הקרוב, אז מה שנשאר פתוח פשוט נעלם מהעין.
  const leftOpen = useMemo(
    () =>
      (allStops ?? [])
        .filter(
          (s) =>
            s.deliveryDate < today &&
            (s.status === 'planned' || s.status === 'in_progress')
        )
        .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)),
    [allStops, today]
  );
  // הטאב "פתוחות" מציג אותן מקובצות לפי יום, מהטרי לישן.
  const leftOpenByDay = useMemo(() => {
    const map = new Map<string, DbCalendarStop[]>();
    for (const s of leftOpen) {
      const list = map.get(s.deliveryDate) ?? [];
      list.push(s);
      map.set(s.deliveryDate, list);
    }
    return Array.from(map.entries())
      .map(([date, stops]) => ({ date, stops }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [leftOpen]);
  const tomorrowStops = myStopsByDate.get(tomorrow) ?? [];
  const weekStops = useMemo(() => {
    const start = new Date();
    const end = new Date(Date.now() + 7 * 86_400_000);
    const result: { date: string; stops: DbCalendarStop[] }[] = [];
    for (const [date, stops] of myStopsByDate.entries()) {
      const d = new Date(date + 'T00:00:00');
      if (d >= start && d <= end && date !== today && date !== tomorrow) {
        result.push({ date, stops });
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [myStopsByDate, today, tomorrow]);

  // היסטוריה: ברירת המחדל 7 ימים אחורה, אבל חיפוש רץ על **הכל** (בקשת
  // עמי 30/08). ה-RLS כבר תוחם לעצירות של הנהג הזה בלבד, אז "הכל" הוא
  // כל מה שהוא עצמו ביצע, כולל "לא בוצע" עם הסיבה.
  const [historyQuery, setHistoryQuery] = useState('');
  const historyStops = useMemo(
    () =>
      buildVisitHistory(stopsByDate.entries(), {
        mine: profile?.linkedDriver ?? undefined,
        today,
        floorDate: toLocalDateStr(new Date(Date.now() - 7 * 86_400_000)),
        query: historyQuery,
      }),
    [stopsByDate, today, historyQuery, profile?.linkedDriver]
  );

  // 🔴 המונים סופרים אך ורק את העבודה שלו. מ-02/09/2026 תוצאות החיפוש
  // כוללות גם ביקורים של עמיתים אצל אותו לקוח, ובלי הסינון הזה
  // הסטטיסטיקה של הנהג הייתה מתנפחת מעבודה שהוא לא עשה.
  const isMineStop = (s: { driver?: string }) =>
    !profile?.linkedDriver || !s.driver || s.driver === profile.linkedDriver;
  const historyCompleted = historyStops.reduce(
    (sum, d) => sum + d.stops.filter((s) => isMineStop(s) && s.status === 'completed').length,
    0
  );
  const historyNotCompleted = historyStops.reduce(
    (sum, d) => sum + d.stops.filter((s) => isMineStop(s) && s.status === 'not_completed').length,
    0
  );
  const historyTotal = historyStops.reduce((sum, d) => sum + d.stops.filter(isMineStop).length, 0);

  // "בוצעו" = רק עצירות שסופקו בפועל (לא כולל "לא בוצע"/מבוטל).
  // "נותרו" = עצירות שעדיין לפעולה (planned/in_progress); "לא בוצע" אינו נספר באף אחד.
  const todayCompleted = todayStops.filter((s) => s.status === 'completed').length;
  const todayRemaining = todayStops.filter(
    (s) => s.status === 'planned' || s.status === 'in_progress'
  ).length;

  // UI-shaped stops for the map; next unresolved stop for the "navigate" button.
  const todayUiStops = useMemo(() => todayStops.map(toUiStop), [todayStops]);
  const nextStop = todayStops.find((s) => !isResolved(s.status));
  const nextWazeUrl = nextStop
    ? buildWazeUrl({
        address: nextStop.address
          ? `${nextStop.address}${nextStop.city ? `, ${nextStop.city}` : ''}`
          : nextStop.city ?? null,
        coordinates: nextStop.coordinates ?? null,
      })
    : null;

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100">
            <Truck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{dayLabel(today)}</p>
            <h1 className="text-lg font-bold leading-tight">
              שלום {profile?.fullName ?? profile?.username ?? 'נהג'} 👋
            </h1>
          </div>
        </div>
        {profile?.linkedDriver && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
            {profile.linkedDriver}
          </Badge>
        )}
      </div>

      {/* Today's summary */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">המסלול שלך היום</p>
              <p className="text-3xl font-bold">{todayStops.length}</p>
              <p className="text-xs text-muted-foreground">
                {todayStops.length === 0
                  ? 'אין עצירות'
                  : `${todayCompleted} בוצעו · ${todayRemaining} נותרו`}
              </p>
            </div>
            <ListChecks className="h-12 w-12 text-emerald-500/40" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">
            היום
            {todayStops.length > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {todayRemaining}
              </Badge>
            )}
          </TabsTrigger>
          {/* הטריגר נשאר גם כשנסגרה האחרונה בזמן שהטאב פתוח, אחרת המסך מתרוקן. */}
          {(leftOpen.length > 0 || tab === 'open') && (
            <TabsTrigger value="open" className="flex-1">
              פתוחות
              <Badge className="ms-1.5 h-5 bg-amber-500 px-1.5 text-[10px] text-white hover:bg-amber-500">
                {leftOpen.length}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="tomorrow" className="flex-1">
            מחר
            {tomorrowStops.length > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {tomorrowStops.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="week" className="flex-1">
            השבוע
            {weekStops.length > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {weekStops.reduce((sum, d) => sum + d.stops.length, 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            היסטוריה
            {historyTotal > 0 && (
              <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                {historyTotal}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3">
          {/* ⭐ ההתראה נשארת בטאב היום, הרשימה עברה לטאב "פתוחות" (31/08/2026).
              אצל רודי הצטברו 170 עצירות כאלה, והקופסה הישנה קברה את מסלול
              היום מתחתיהן. */}
          {leftOpen.length > 0 && (
            <button
              onClick={() => setTab('open')}
              className="flex w-full items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-start transition-colors hover:bg-amber-100"
            >
              <AlertTriangle className="h-4 w-4 flex-none text-amber-600" />
              <span className="flex-1 text-sm font-bold text-amber-900">
                נשארו לך {leftOpen.length} עצירות פתוחות מימים קודמים
              </span>
              <span className="flex-none rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
                לרשימה
              </span>
            </button>
          )}

          {todayStops.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {nextWazeUrl && (
                  <a
                    href={nextWazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => nextStop && log('navigate', stopCtx(nextStop))}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-blue-700"
                  >
                    <Navigation className="h-4 w-4" />
                    נווט לעצירה הבאה{nextStop ? ` · ${nextStop.customerName}` : ''}
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMap((v) => !v)}
                  className="h-[42px] gap-1.5 text-xs"
                >
                  <MapIcon className="h-4 w-4" />
                  {showMap ? 'הסתר מפה' : 'הצג מפה'}
                </Button>
              </div>
              {showMap && <RouteMap stops={todayUiStops} height="300px" />}
            </div>
          )}
          {todayStops.length === 0 ? (
            <EmptyState message="אין עצירות מתוכננות להיום 🎉" />
          ) : (
            todayStops.map((stop, idx) => (
              <DriverStopCard
                key={stop.id}
                stop={stop}
                index={idx + 1}
                onCoordinate={() => handleCoordinate(stop)}
                onArrive={() => handleArrive(stop)}
                onResolve={(status, notes, kind) => handleResolve(stop, status, notes, kind)}
                crane={craneOf(stop)}
                onCraneForm={() => setCraneStop(stop)}
                resolving={isResolvingStop(stop.id)}
              />
            ))
          )}
        </TabsContent>

        {/* ⭐ העצירות הפתוחות מימים קודמים, מקובצות לפי יום, מהטרי לישן.
            הסגירה כאן מיידית (בוצע / לא בוצע), בלי מסלול "הגעה": אלה
            ביקורים שכבר קרו בשטח ורק הסימון חסר, וכל עוד הוא חסר ההזמנה
            לא רשומה כסופקה במשרד. */}
        <TabsContent value="open" className="space-y-4">
          {leftOpen.length === 0 ? (
            <EmptyState message="אין עצירות פתוחות מימים קודמים 🎉" />
          ) : (
            <>
              <p className="px-1 text-xs text-muted-foreground">
                כל עוד עצירה כאן פתוחה, ההזמנה לא רשומה כסופקה במשרד. סוגרים
                עם "בוצע" או "לא בוצע" לפי מה שקרה בפועל.
              </p>
              {leftOpenByDay.map((day) => (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{dayLabel(day.date)}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {day.stops.length} עצירות
                    </Badge>
                  </div>
                  {day.stops.map((stop) => (
                    <LeftoverStopCard
                      key={stop.id}
                      stop={stop}
                      resolving={isResolvingStop(stop.id)}
                      onResolve={(status) => handleResolve(stop, status)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="tomorrow" className="space-y-3">
          {tomorrowStops.length === 0 ? (
            <EmptyState message="אין עצירות מתוכננות למחר" />
          ) : (
            tomorrowStops.map((stop, idx) => (
              <DriverStopCard
                key={stop.id}
                stop={stop}
                index={idx + 1}
                onCoordinate={() => handleCoordinate(stop)}
                onArrive={() => handleArrive(stop)}
                onResolve={(status, notes, kind) => handleResolve(stop, status, notes, kind)}
                crane={craneOf(stop)}
                onCraneForm={() => setCraneStop(stop)}
                resolving={isResolvingStop(stop.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          {weekStops.length === 0 ? (
            <EmptyState message="אין עצירות נוספות בשבוע הקרוב" />
          ) : (
            weekStops.map((day) => (
              <div key={day.date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{dayLabel(day.date)}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {day.stops.length} עצירות
                  </Badge>
                </div>
                {day.stops.map((stop, idx) => (
                  <DriverStopCard
                    key={stop.id}
                    stop={stop}
                    index={idx + 1}
                    onCoordinate={() => handleCoordinate(stop)}
                    onArrive={() => handleArrive(stop)}
                    onResolve={(status, notes, kind) => handleResolve(stop, status, notes, kind)}
                crane={craneOf(stop)}
                onCraneForm={() => setCraneStop(stop)}
                    resolving={isResolvingStop(stop.id)}
                  />
                ))}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* חיפוש בכל ההיסטוריה של הנהג, לא רק בשבוע המוצג. */}
          <div className="relative">
            <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="חיפוש לקוח, כתובת או סיבה, בכל ההיסטוריה שלך"
              className="ps-9"
            />
          </div>
          {historyQuery.trim() !== '' && historyStops.length > 0 && (
            <p className="px-1 text-[11px] text-muted-foreground">
              מציג התאמות מכל ההיסטוריה שלך, לא רק מהשבוע האחרון
            </p>
          )}
          {historyStops.length === 0 ? (
            <EmptyState
              message={
                historyQuery.trim() !== ''
                  ? `לא נמצאו ביקורים שמתאימים ל"${historyQuery.trim()}"`
                  : 'אין היסטוריה מהשבוע האחרון'
              }
            />
          ) : (
            <>
              {/* סיכום שבועי — סופקו / לא בוצעו */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-emerald-200 bg-emerald-50/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{historyCompleted}</p>
                    <p className="text-[11px] text-muted-foreground">סופקו</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/60">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{historyNotCompleted}</p>
                    <p className="text-[11px] text-muted-foreground">לא בוצעו</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{historyTotal}</p>
                    <p className="text-[11px] text-muted-foreground">סה״כ עצירות</p>
                  </CardContent>
                </Card>
              </div>

              {historyStops.map((day) => (
                <div key={day.date} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{dayLabel(day.date)}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {day.stops.length} עצירות
                    </Badge>
                  </div>
                  {day.stops.map((stop, idx) => (
                    <div key={stop.id}>
                      {/* ⭐ ביקור של עובד אחר אצל לקוח שאני נוסע אליו.
                          בלי השורה הזאת הנהג קורא הערה ומניח שהוא כתב אותה. */}
                      {!isMineStop(stop) && (
                        <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-violet-700">
                          <UserRound className="h-3.5 w-3.5" />
                          ביקור קודם של {stop.driver}
                        </div>
                      )}
                    <DriverStopCard
                      stop={stop}
                      index={idx + 1}
                      onCoordinate={() => handleCoordinate(stop)}
                      onArrive={() => handleArrive(stop)}
                      onResolve={(status, notes, kind) => handleResolve(stop, status, notes, kind)}
                crane={craneOf(stop)}
                onCraneForm={() => setCraneStop(stop)}
                      resolving={isResolvingStop(stop.id)}
                    />
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      <ScheduleCoordinationDialog
        stop={coordinationStop}
        open={!!coordinationStop}
        onOpenChange={(open) => {
          if (!open) setCoordinationStop(null);
        }}
      />

      <CraneChecklistDialog
        open={!!craneStop && craneCtx?.kind === 'inspection'}
        onOpenChange={(o) => {
          if (!o) setCraneStop(null);
        }}
        craneSerial={craneCtx?.serial}
        customerName={craneStop?.customerName}
        stopId={craneStop?.id}
        serviceCallId={craneStop?.serviceCallId}
        technicianName={craneStop?.driver}
        onSaved={() =>
          log('crane_checklist_submitted', {
            entityType: 'calendar_stop',
            entityId: craneStop?.id ?? '',
            sourceType: craneStop?.sourceType,
            customerName: craneStop?.customerName,
          })
        }
      />

      {/* ⭐ טופס ההדרכה נפתח באספקה בלבד, ומי שחותם עליו הוא הלקוח. */}
      <CraneTrainingDialog
        open={!!craneStop && craneCtx?.kind === 'training'}
        onOpenChange={(o) => {
          if (!o) setCraneStop(null);
        }}
        craneSerial={craneCtx?.serial}
        customerName={craneStop?.customerName}
        stopId={craneStop?.id}
        orderId={craneStop?.orderId}
        technicianName={craneStop?.driver}
        onSaved={() =>
          log('crane_training_submitted', {
            entityType: 'calendar_stop',
            entityId: craneStop?.id ?? '',
            sourceType: craneStop?.sourceType,
            customerName: craneStop?.customerName,
          })
        }
      />

      <NotCompletedReasonDialog
        open={!!notCompletedStop}
        customerName={notCompletedStop?.customerName}
        kind={notCompletedKind}
        submitting={resolveStop.isPending}
        onOpenChange={(open) => {
          if (!open) setNotCompletedStop(null);
        }}
        onConfirm={(reason) => {
          if (!notCompletedStop) return;
          log('stop_not_completed', {
            ...stopCtx(notCompletedStop),
            metadata: { reason },
          });
          resolveStop.mutate(
            { stop: notCompletedStop, status: 'not_completed', notes: reason, kind: notCompletedKind },
            { onSuccess: () => setNotCompletedStop(null) }
          );
        }}
      />
    </div>
  );
}

/**
 * כרטיס עצירה פתוחה מיום קודם — טאב "פתוחות". קומפקטי בכוונה: הביקור
 * כנראה כבר קרה, ומה שחסר הוא הסימון. טלפון וכתובת נשארים למקרה שבאמת
 * צריך לחזור ללקוח. מיוצא לתצוגה מקדימה, כמו DriverStopCard.
 */
export function LeftoverStopCard({
  stop,
  resolving,
  onResolve,
}: {
  stop: DbCalendarStop;
  resolving: boolean;
  onResolve: (status: 'completed' | 'not_completed') => void;
}) {
  const src = SOURCE_CONFIG[stop.sourceType] ?? SOURCE_CONFIG.delivery;
  const SrcIcon = src.Icon;
  const telUrl = buildTelUrl(stop.phone);
  return (
    <Card className="border-amber-200">
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`flex h-5 w-5 items-center justify-center rounded ${src.bg} ${src.color}`}>
            <SrcIcon className="h-3 w-3" />
          </span>
          <span className="font-semibold">{stop.customerName}</span>
          {stop.city && (
            <span className="text-xs text-muted-foreground">{stop.city}</span>
          )}
          {stop.phone && (
            <a
              href={telUrl ?? '#'}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700"
              dir="ltr"
            >
              <Phone className="h-3 w-3" />
              {stop.phone}
            </a>
          )}
        </div>
        {stop.notes && (
          <p className="rounded bg-muted/40 p-1.5 text-xs italic text-muted-foreground">
            📝 {stop.notes}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => onResolve('completed')}
            disabled={resolving}
            className="h-11 gap-1 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Check className="h-4 w-4" />
            בוצע
          </Button>
          <Button
            variant="outline"
            onClick={() => onResolve('not_completed')}
            disabled={resolving}
            className="h-11 gap-1 border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
            לא בוצע
          </Button>
          <StopChatButton stop={stop} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

/** Per-stop chat trigger, styled to match the mobile action row. Opens the
 *  internal per-record chat sheet (order or service call) with a comment-count badge. */
function StopChatButton({ stop, className = '' }: { stop: DbCalendarStop; className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: commentCounts = {} } = useCommentCounts();
  // עוגן הצ'אט לפי סוג העצירה. משלוח/שירות → הישות (order/service_call).
  // משימה/איסוף → אין ישות, אז עוגנים ל-calendar_stop (kind='stop'), אחרת
  // ה-insert נכשל על FK ל-orders והנהג מקבל "שגיאה בשליחת ההודעה".
  let kind: ChatSourceKind;
  let chatId: string;
  if (stop.sourceType === 'service' && stop.serviceCallId) {
    kind = 'service';
    chatId = stop.serviceCallId;
  } else if (stop.sourceType === 'delivery' && stop.orderId) {
    kind = 'order';
    chatId = stop.orderId;
  } else {
    kind = 'stop';
    chatId = stop.id;
  }
  const count = commentCounts[chatId] || 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`relative h-11 gap-1 text-xs ${className}`}
      >
        <MessageCircle className="h-4 w-4 text-primary" />
        צ'אט
        {count > 0 && (
          <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
            {count}
          </span>
        )}
      </Button>
      <OrderChatSheet
        order={{ id: chatId, customerName: stop.customerName, city: stop.city, kind }}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

interface DriverStopCardProps {
  stop: DbCalendarStop;
  index: number;
  onCoordinate: () => void;
  onArrive: () => Promise<unknown> | void;
  onResolve: (status: 'completed' | 'not_completed', notes?: string, kind?: StopResolutionKind) => void;
  /**
   * המנוף שבעצירה, אם יש, ואיזה טופס הוא מזמין.
   * ⭐ `inspection` = ביקור טכנאי אצל מנוף קיים · `training` = אספקת מנוף
   * חדש, ואז מי שחותם הוא הלקוח ולא הטכנאי.
   */
  crane?: CraneContext | null;
  onCraneForm?: () => void;
  resolving: boolean;
}

/** משך חלון ה"חשיבה" בין הגעה לסופק (מונע לחיצות רצופות). */
const ARRIVAL_THINK_MS = 10_000;

/**
 * ⭐ **מיוצא לצורך תצוגה מקדימה בלבד.** מסך הנהג יושב מאחורי התחברות
 * ומאחורי תפקיד, ולכן אי אפשר לצלם אותו אוטומטית. בלי הייצוא הזה שינוי
 * בכפתורים של מי שעובד בשטח נמסר בלי שראו אותו בעיניים.
 * [[screenshot_behind_a_login]]
 */
export function DriverStopCard({ stop, index, onCoordinate, onArrive, onResolve, resolving, crane, onCraneForm }: DriverStopCardProps) {
  const log = useActivityLogger();
  const logStop = (action: string) =>
    log(action, {
      entityType: 'calendar_stop',
      entityId: stop.id,
      sourceType: stop.sourceType,
      customerName: stop.customerName,
    });
  const resolved = isResolved(stop.status);

  // חלון חשיבה של 10ש' אחרי לחיצה על "הגעה" — נועל את כל הכפתורים.
  const [thinking, setThinking] = useState(false);
  const [arrivedLocal, setArrivedLocal] = useState(false);
  // משלוח בלבד: בחירת תוצאת אספקה לפני סימון "סופק".
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const isDelivery = stop.sourceType === 'delivery';
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // הנהג סימן הגעה → ה-stop ב-in_progress (נשמר ב-DB ושורד רענון);
  // arrivedLocal מגבה את התצוגה אם ה-refetch מתעכב.
  const hasArrived = stop.status === 'in_progress' || arrivedLocal;

  const handleArriveClick = () => {
    if (thinking) return;
    setThinking(true);
    setArrivedLocal(true);
    // אם הכתיבה נכשלה — מבטלים את החיווי המקומי כדי שהכרטיס לא יתקדם
    // ל"סופק" על סמך הגעה שלא נשמרה ב-DB.
    Promise.resolve(onArrive()).catch(() => {
      setArrivedLocal(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      setThinking(false);
    });
    timerRef.current = setTimeout(() => setThinking(false), ARRIVAL_THINK_MS);
  };
  const isCustomerConfirmed = stop.coordinationStatus === 'customer_confirmed';
  const isCustomerRejected = stop.coordinationStatus === 'customer_rejected';
  const src = SOURCE_CONFIG[stop.sourceType] ?? SOURCE_CONFIG.delivery;
  const SrcIcon = src.Icon;

  const wazeUrl = buildWazeUrl({
    address: stop.address ? `${stop.address}${stop.city ? `, ${stop.city}` : ''}` : null,
    coordinates: stop.coordinates ?? null,
  });
  const telUrl = buildTelUrl(stop.phone);

  const bgClass = stop.status === 'completed'
    ? 'bg-emerald-50/70 border-emerald-200'
    : stop.status === 'not_completed'
      ? 'bg-red-50/60 border-red-200 opacity-75'
      // עצירה פתוחה שהנהג כבר הגיע אליה: מסגרת כחולה בולטת, כדי שלא תיבלע
      // בין השאר ותישאר פתוחה בסוף היום.
      : hasArrived
        ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-300/70'
        : isCustomerConfirmed
          ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300/60'
          : isCustomerRejected
            ? 'bg-red-50/40 border-red-200'
            : 'bg-card';

  return (
    <>
    <Card className={`${bgClass} transition-all`}>
      <CardContent className="p-4 space-y-3">
        {/* Top row: stop number + source + name */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-base flex-shrink-0">
            {index}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`flex h-5 w-5 items-center justify-center rounded ${src.bg} ${src.color}`}>
                <SrcIcon className="h-3 w-3" />
              </span>
              <h2 className={`text-base font-bold leading-tight ${stop.status === 'not_completed' ? 'text-muted-foreground' : ''}`}>
                {stop.customerName}
              </h2>
              {stop.status === 'completed' && (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                  ✓ בוצע
                </Badge>
              )}
              {stop.status === 'not_completed' && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px]">
                  ✗ לא בוצע
                </Badge>
              )}
            </div>
            {stop.coordinationStatus && (
              <div className="mt-1.5">
                <CoordinationStatusBadge status={stop.coordinationStatus} showLabel className="text-[11px]" />
              </div>
            )}
          </div>
        </div>

        {/* Address & time window */}
        {(stop.address || stop.city) && (
          <a
            href={wazeUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logStop('navigate')}
            className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
          >
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate">
              {stop.address}
              {stop.city ? `, ${stop.city}` : ''}
            </span>
            <Navigation className="h-4 w-4 flex-shrink-0 text-blue-600" />
          </a>
        )}

        {stop.timeWindowStart && stop.timeWindowEnd && (
          <div className={`flex items-center gap-2 text-sm ${isCustomerConfirmed ? 'text-emerald-700 font-bold' : 'text-muted-foreground'}`}>
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span dir="ltr">
              {stop.timeWindowStart}–{stop.timeWindowEnd}
            </span>
          </div>
        )}

        {/* Phone */}
        {stop.phone && (
          <a
            href={telUrl ?? '#'}
            onClick={() => logStop('call')}
            className="flex items-center gap-2 text-sm text-emerald-700 hover:underline font-medium"
            dir="ltr"
          >
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>{stop.phone}</span>
          </a>
        )}

        {/* תיאור המשימה, כפי שנרשם בהקמה */}
        {stop.notes && (
          <div className="text-xs text-muted-foreground italic bg-muted/40 rounded p-2">
            📝 {stop.notes}
          </div>
        )}

        {/* מה שנרשם בסימון. שורה נפרדת, כי היא כבר לא דורסת את התיאור. */}
        {stop.resolutionNote && (
          <div className="rounded bg-amber-50 p-2 text-xs text-amber-800">
            ✍️ {stop.resolutionNote}
          </div>
        )}

        {/* Action buttons */}
        {thinking ? (
          /* חלון חשיבה — 10 שניות, הכל נעול */
          <div className="pt-1">
            <div className="flex h-11 items-center justify-center gap-2 rounded-md bg-blue-50 text-sm font-medium text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              רושם הגעה…
            </div>
          </div>
        ) : !resolved ? (
          /* 🔴 אחרי "הגעה" הכפתור לסגירה מקבל שורה שלמה. מדידה ב-12/08/2026
             מצאה 116 עצירות עבר שנפתחו ולא נסגרו, 101 מהן של נהג אחד. כשכל
             ארבעת הכפתורים באותו גודל, "סופק" נבלע ביניהם על מסך טלפון. */
          hasArrived ? (
            <div className="space-y-2 pt-1">
              {/* ⭐ **הצ'קליסט מעל כפתור הסיום, ובכוונה.** הוא נועד להימלא
                  בזמן הבדיקה ולא אחריה, ומי שכבר לחץ "סיימתי" כבר עזב.
                  🔴 ואינו חוסם את הסיום: טכנאי שהמנוף אצלו תקוע או
                  שהלקוח לא בבית חייב עדיין להיות מסוגל לסגור את העצירה. */}
              {crane && onCraneForm && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCraneForm}
                  disabled={resolving}
                  className="h-12 w-full gap-2 border-blue-300 bg-blue-50 text-sm font-bold text-blue-800 hover:bg-blue-100"
                >
                  {crane.kind === 'training' ? (
                    <BookOpenCheck className="h-5 w-5" />
                  ) : (
                    <ClipboardCheck className="h-5 w-5" />
                  )}
                  {crane.kind === 'training' ? 'אישור קבלת הדרכה' : 'רשימת בדיקה למנוף'}{' '}
                  {crane.serial && <bdi className="font-mono text-xs">{crane.serial}</bdi>}
                </Button>
              )}
              <Button
                onClick={() => {
                  // משלוח → חובה לבחור תוצאת אספקה; אחרת סימון מיידי.
                  if (isDelivery) setOutcomeOpen(true);
                  else onResolve('completed');
                }}
                disabled={resolving}
                className="h-14 w-full gap-2 bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
              >
                <Check className="h-5 w-5" />
                סיימתי כאן, סמן כסופק
              </Button>
              {/* ⭐ **"המשך טיפול" מופיע רק אחרי הגעה, וזו הנקודה.**
                  מי שלא הגיע ללקוח לא יכול להיות "בוצע חלקית"; אצלו זה
                  פשוט "לא בוצע". הצגת הכפתור לפני ההגעה הייתה מזמינה
                  סימון שגוי ומטשטשת בדיוק את ההבחנה שהוא נועד לייצר. */}
              {/* ⭐ ארבעה כפתורים, ואומת בצילום ברוחב טלפון אמיתי (384
                  פיקסל) שכולם נכנסים וקריאים. 🔴 והאימות הזה לא היה טריוויאלי:
                  Chrome headless לא יורד מתחת ל-500 פיקסל, ולכן צילום שמבקש
                  390 מחזיר **פרוסה** של עמוד רחב יותר ונראה בדיוק כמו תוכן
                  שנחתך. הדרך היחידה לראות את מה שהנהג רואה היא מיכל ברוחב
                  קבוע, וזה מה שיושב ב-`preview.html?view=driver`. */}
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCoordinate}
                  disabled={resolving}
                  className="h-11 gap-1 text-xs"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  תיאום
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResolve('not_completed', undefined, 'follow_up')}
                  disabled={resolving}
                  className="h-11 gap-1 text-xs bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  המשך טיפול
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResolve('not_completed', undefined, 'not_done')}
                  disabled={resolving}
                  className="h-11 gap-1 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                  לא בוצע
                </Button>
                <StopChatButton stop={stop} />
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-4 gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onCoordinate}
              disabled={resolving}
              className="h-11 gap-1 text-xs"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              תיאום
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleArriveClick}
              disabled={resolving}
              className="h-11 gap-1 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <MapPin className="h-4 w-4" />
              הגעה
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResolve('not_completed')}
              disabled={resolving}
              className="h-11 gap-1 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
              לא בוצע
            </Button>
            <StopChatButton stop={stop} />
          </div>
          )
        ) : (
          <div className="pt-1">
            <StopChatButton stop={stop} className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>

    {/* משלוח בלבד — בחירת תוצאת אספקה לפני "סופק" */}
    <DeliveryOutcomeDialog
      open={outcomeOpen}
      customerName={stop.customerName}
      submitting={resolving}
      onOpenChange={setOutcomeOpen}
      onSelect={(outcome) => {
        setOutcomeOpen(false);
        onResolve('completed', outcome);
      }}
    />
    </>
  );
}
