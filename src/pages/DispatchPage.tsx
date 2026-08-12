import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  dropAnimationDown,
  silentAnnouncements,
  silentScreenReaderInstructions,
} from '@/lib/dnd-animations';
import { useZonedOrders } from '@/hooks/useZonedOrders';
import { useZonedServiceCalls } from '@/hooks/useZonedServiceCalls';
import { usePickups } from '@/hooks/usePickups';
import { useNewCustomers } from '@/hooks/useNewCustomers';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { useGeocodeBackfill } from '@/hooks/useGeocodeBackfill';
import { useScheduleStop } from '@/hooks/useScheduleStop';
import { useDeleteStop } from '@/hooks/useDeleteStop';
import { useResolveStop } from '@/hooks/useResolveStop';
import { useReorderStops } from '@/hooks/useReorderStops';
import { useRescheduleStop, type RescheduleStopRef } from '@/hooks/useRescheduleStop';
import { useMoveStop } from '@/hooks/useMoveStop';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { DeliveryStatusBar } from '@/components/deliveries/DeliveryStatusBar';
import { ServiceCallStatusBar } from '@/components/service-calls/ServiceCallStatusBar';
import { DispatchFilterBar } from '@/components/dispatch/DispatchFilterBar';
import {
  buildCustomerItems,
  buildOrderItems,
  buildPickupItems,
  buildServiceCallItems,
} from '@/components/dispatch/items';
import { UnscheduledOrders } from '@/components/deliveries/UnscheduledOrders';
import { UnscheduledServiceCalls } from '@/components/service-calls/UnscheduledServiceCalls';
import { UnscheduledPickups } from '@/components/pickups/UnscheduledPickups';
import { UnscheduledCustomers } from '@/components/customers/UnscheduledCustomers';
import { PickupDetailDialog } from '@/components/pickups/PickupDetailDialog';
import { DedupToggle } from '@/components/dashboard/DedupToggle';
import { DeliveryCalendar } from '@/components/deliveries/DeliveryCalendar';
import { DriverSelector } from '@/components/deliveries/DriverSelector';
import { DatePickerDialog } from '@/components/deliveries/DatePickerDialog';
import { TaskDialog } from '@/components/deliveries/TaskDialog';
import { DayMapDialog } from '@/components/deliveries/DayMapDialog';
import {
  DuplicateScheduleWarningDialog,
  type DuplicateConflict,
} from '@/components/deliveries/DuplicateScheduleWarningDialog';
import { findActiveDuplicateStops } from '@/lib/calendar-stops';
import { StuckStopsAlert } from '@/components/deliveries/StuckStopsAlert';
import { NotCompletedReasonDialog } from '@/components/NotCompletedReasonDialog';
import { ScheduleCoordinationDialog } from '@/components/whatsapp/ScheduleCoordinationDialog';
import { showScheduleToast } from '@/lib/scheduleToast';
import { buildCalendarDeliveries, toViewStop } from '@/lib/calendar-view';
import { compareStopsByTime } from '@/lib/stop-order';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  Package,
  Wrench,
  Undo2,
  ClipboardList,
  UserPlus,
  ChevronDown,
  ChevronLeft,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import type { Order } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { Pickup } from '@/types/pickup';
import type { NewCustomer } from '@/types/customer';
import { isBareCustomer } from '@/types/customer';
import { ASSIGNEES, type AssigneeName } from '@/types/route';
import type {
  CalendarDelivery,
  CalendarStopSource,
  CalendarStop as CalendarStopView,
} from '@/types/delivery';
import { toast } from 'sonner';

// ─── סוגי פעילות ─────────────────────────────────────────────
type ActivityKind = 'delivery' | 'service' | 'pickup' | 'customer';
type ActivityTab = 'all' | 'deliveries' | 'service' | 'pickups' | 'customers';

const TAB_TO_KIND: Record<ActivityTab, ActivityKind> = {
  // 'all' אינו סוג יחיד. הסוג בפועל נגזר מהרשימה שבה נעשתה הבחירה.
  all: 'delivery',
  deliveries: 'delivery',
  service: 'service',
  pickups: 'pickup',
  customers: 'customer',
};

// פריט גנרי לשיבוץ — כל שלושת הסוגים נושאים את אותם שדות cache.
interface ScheduleItem {
  id: string;
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
}

/** לקוח חדש כפריט שיבוץ. המזהה הוא CUSTNAME, אין לו רשומת ישות משלו. */
function customerToItem(c: NewCustomer): ScheduleItem {
  return {
    id: c.customerNumber,
    customerName: c.customerName,
    address: c.address,
    city: c.city,
    phone: c.phone,
  };
}

interface PendingSchedule {
  kind: ActivityKind;
  items: ScheduleItem[];
  date: string;
}

// dnd-kit: draggable "type" של כל אחת מרשימות הממתינים
const DRAGGABLE_ITEM_TYPES = new Set(['order', 'serviceCall', 'pickup', 'customer']);

// Collision detection מאוחד: כשגוררים פריט ממתין (מכל סוג) — נעדיף את
// היום שהמצביע ממש מעליו; drop מחוץ ליום לא עושה כלום.
// כשגוררים stop קיים (reorder) — closestCenter הרגיל.
const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type as string | undefined;

  if (activeType && DRAGGABLE_ITEM_TYPES.has(activeType)) {
    const pointerHits = pointerWithin(args);
    const pointerDayHits = pointerHits.filter(
      (c) =>
        args.droppableContainers.find((d) => d.id === c.id)?.data.current
          ?.type === 'day'
    );
    if (pointerDayHits.length > 0) return pointerDayHits;

    const rectHits = rectIntersection(args);
    const rectDayHits = rectHits.filter(
      (c) =>
        args.droppableContainers.find((d) => d.id === c.id)?.data.current
          ?.type === 'day'
    );
    if (rectDayHits.length > 0) return rectDayHits;

    // אין hit — drop ייעצר בלי לפתוח דיאלוג נהג
    return [];
  }

  return closestCenter(args);
};

// ─── צ'יפי סינון היומן ───────────────────────────────────────
const CALENDAR_FILTER_KEY = 'rashal:calendarTypeFilter';
const ALL_SOURCE_TYPES: CalendarStopSource[] = ['delivery', 'service', 'pickup', 'task', 'customer'];

const CHIP_META: Record<
  CalendarStopSource,
  { label: string; Icon: typeof Package; on: string; off: string }
> = {
  delivery: {
    label: 'משלוחים',
    Icon: Package,
    on: 'bg-blue-50 text-blue-700 border-blue-200',
    off: 'bg-muted text-muted-foreground/60 border-transparent',
  },
  service: {
    label: 'שירות',
    Icon: Wrench,
    on: 'bg-orange-50 text-orange-700 border-orange-200',
    off: 'bg-muted text-muted-foreground/60 border-transparent',
  },
  pickup: {
    label: 'איסופים',
    Icon: Undo2,
    on: 'bg-teal-50 text-teal-700 border-teal-200',
    off: 'bg-muted text-muted-foreground/60 border-transparent',
  },
  task: {
    label: 'משימות',
    Icon: ClipboardList,
    on: 'bg-amber-50 text-amber-700 border-amber-200',
    off: 'bg-muted text-muted-foreground/60 border-transparent',
  },
  customer: {
    label: 'לקוחות חדשים',
    Icon: UserPlus,
    on: 'bg-violet-50 text-violet-700 border-violet-200',
    off: 'bg-muted text-muted-foreground/60 border-transparent',
  },
};

function loadCalendarFilter(): Set<CalendarStopSource> {
  try {
    const raw = localStorage.getItem(CALENDAR_FILTER_KEY);
    if (!raw) return new Set(ALL_SOURCE_TYPES);
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((t): t is CalendarStopSource =>
      (ALL_SOURCE_TYPES as string[]).includes(t)
    );
    return valid.length > 0 ? new Set(valid) : new Set(ALL_SOURCE_TYPES);
  } catch {
    return new Set(ALL_SOURCE_TYPES);
  }
}

const KIND_LABELS: Record<ActivityKind, { many: string; toastKind: 'delivery' | 'service'; pickerTitle?: string }> = {
  delivery: { many: 'הזמנות', toastKind: 'delivery' },
  service: { many: 'קריאות שירות', toastKind: 'service', pickerTitle: 'בחר עובד' },
  pickup: { many: 'איסופים', toastKind: 'delivery', pickerTitle: 'בחר עובד לאיסוף' },
  customer: { many: 'אספקות', toastKind: 'delivery', pickerTitle: 'בחר נהג לאספקה' },
};

export function DispatchPage() {
  // ─── טאב פעיל (נשמר ב-URL כדי שהפניות מהראוטים הישנים יעבדו) ───
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ActivityTab =
    tabParam === 'service' ||
    tabParam === 'pickups' ||
    tabParam === 'customers' ||
    tabParam === 'all'
      ? tabParam
      : 'deliveries';
  const setTab = (next: string) => {
    setSearchParams({ tab: next }, { replace: true });
  };

  // ─── נתוני מקור: שלושת הסוגים נטענים יחד (מעבר טאב מיידי) ───
  const {
    unscheduledOrders,
    scheduledOrders,
    deliveredOrders,
    orderCountByZone,
    orderZoneMap,
    groupSize: ordersGroupSize,
    hiddenCount: ordersHiddenCount,
    isLoading: ordersLoading,
    error: ordersError,
  } = useZonedOrders();

  const {
    pendingCalls,
    scheduledCalls,
    completedCalls,
    callCountByZone,
    callZoneMap,
    groupSize: callsGroupSize,
    hiddenCount: callsHiddenCount,
    isLoading: callsLoading,
    error: callsError,
  } = useZonedServiceCalls();

  const { data: pickups = [], isLoading: pickupsLoading, error: pickupsError } = usePickups();

  const {
    data: newCustomers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useNewCustomers();

  const { data: calendarStops = [] } = useCalendarStops();
  // Backfill geocoding מדויק לעצירות פעילות (רץ ברקע, מווסת-קצב).
  useGeocodeBackfill();

  const scheduleStop = useScheduleStop();
  const deleteStop = useDeleteStop();
  const resolveStop = useResolveStop();
  const reorderStops = useReorderStops();
  const rescheduleStopMut = useRescheduleStop();
  const moveStop = useMoveStop();
  const log = useActivityLogger();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 6px — איזון בין רספונסיביות לבין לחיצה רגילה (toggle select)
      activationConstraint: { distance: 6 },
    })
  );

  // ─── איסופים: נגזרות (כמו ב-PickupsPage) ───
  const pendingPickups = useMemo(
    () =>
      pickups.filter(
        (p) =>
          !p.duplicateOf &&
          (p.pickupStatus ?? 'ממתין לתאום') === 'ממתין לתאום' &&
          // רשת ביטחון: איסוף שכבר נאסף/בוטל בפריוריטי לא מופיע בממתינים
          p.priorityStatus !== 'סופית' &&
          p.priorityStatus !== 'מבוטלת'
      ),
    [pickups]
  );
  const scheduledPickupsCount = useMemo(
    () =>
      calendarStops.filter(
        (s) =>
          s.sourceType === 'pickup' &&
          (s.status === 'planned' || s.status === 'in_progress')
      ).length,
    [calendarStops]
  );
  const collectedPickupsCount = useMemo(
    () => pickups.filter((p) => p.pickupStatus === 'נאסף').length,
    [pickups]
  );

  // ─── לקוחות חדשים: מי שעדיין לא שובץ כעצירת לקוח ───
  const pendingCustomers = useMemo(
    () => newCustomers.filter((c) => !c.isScheduled),
    [newCustomers]
  );
  const bareCustomersCount = useMemo(
    () => pendingCustomers.filter(isBareCustomer).length,
    [pendingCustomers]
  );
  const scheduledCustomersCount = useMemo(
    () =>
      calendarStops.filter(
        (s) =>
          s.sourceType === 'customer' &&
          (s.status === 'planned' || s.status === 'in_progress')
      ).length,
    [calendarStops]
  );

  // ─── State משותף ───
  const [draggedItem, setDraggedItem] = useState<
    | { kind: 'delivery'; order: Order }
    | { kind: 'service'; call: ServiceCall }
    | { kind: 'pickup'; pickup: Pickup }
    | { kind: 'customer'; customer: NewCustomer }
    | null
  >(null);
  const [draggedStop, setDraggedStop] = useState<{
    customerName: string;
    city?: string;
    sourceType: string;
  } | null>(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [selectedPickupIds, setSelectedPickupIds] = useState<Set<string>>(new Set());
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<PendingSchedule | null>(null);

  const [pendingReschedule, setPendingReschedule] = useState<{
    stop: RescheduleStopRef;
    newDate: string;
  } | null>(null);

  const [notCompletedStop, setNotCompletedStop] = useState<
    (typeof calendarStops)[number] | null
  >(null);
  // "העבר ליום אחר" — עצירה שלא בוצעה: בורר תאריך → בורר עובד → useMoveStop
  const [movingStop, setMovingStop] = useState<
    (typeof calendarStops)[number] | null
  >(null);
  const [pendingMove, setPendingMove] = useState<{
    stop: (typeof calendarStops)[number];
    newDate: string;
  } | null>(null);

  const [taskDialogDate, setTaskDialogDate] = useState<string | null>(null);
  const [mapDialogDate, setMapDialogDate] = useState<string | null>(null);
  const [detailPickup, setDetailPickup] = useState<Pickup | null>(null);

  // ─── חיפוש וסינון אזור: אחד לכל סוגי המסמכים ───
  // עד 12/08/2026 לכל רשימה היו חיפוש וסינון אזור משלה, ובטאב "הכל" זה
  // אמר להקליד את אותו שם ארבע פעמים. החיפוש רץ על כל השדות של הרשומה.
  const [filterSearch, setFilterSearch] = useState('');
  const [filterZones, setFilterZones] = useState<string[]>([]);
  const [customersOnlyBare, setCustomersOnlyBare] = useState(true);

  const toggleFilterZone = useCallback((zoneId: string) => {
    setFilterZones((prev) =>
      prev.includes(zoneId) ? prev.filter((z) => z !== zoneId) : [...prev, zoneId]
    );
  }, []);

  // ה-VMs נבנים כאן רק כדי לספור: כמה תואמים, וכמה בכל אזור. הרשימות
  // עצמן בונות אותם שוב מאותם בנאים, וה-useMemo שומר שזה יקרה רק על שינוי נתונים.
  const scopedCustomers = useMemo(
    () => (customersOnlyBare ? pendingCustomers.filter(isBareCustomer) : pendingCustomers),
    [pendingCustomers, customersOnlyBare]
  );
  const itemsByTab = useMemo(
    () => ({
      deliveries: buildOrderItems(unscheduledOrders, orderZoneMap, ordersGroupSize),
      service: buildServiceCallItems(pendingCalls, callZoneMap, callsGroupSize),
      pickups: buildPickupItems(pendingPickups, setDetailPickup),
      customers: buildCustomerItems(scopedCustomers),
    }),
    [
      unscheduledOrders,
      orderZoneMap,
      ordersGroupSize,
      pendingCalls,
      callZoneMap,
      callsGroupSize,
      pendingPickups,
      scopedCustomers,
    ]
  );

  /** הפריטים של הטאב הנוכחי, או של כל הסוגים בטאב "הכל". */
  const visibleItems = useMemo(() => {
    if (tab === 'all') return Object.values(itemsByTab).flat();
    return itemsByTab[tab] ?? [];
  }, [itemsByTab, tab]);

  const searchedItems = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return visibleItems;
    return visibleItems.filter((i) => i.searchText.includes(q));
  }, [visibleItems, filterSearch]);

  /** ספירת האזורים על מה שעבר את החיפוש, כדי שהצ'יפים לא ישקרו. */
  const filterZoneCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of searchedItems) m.set(i.zoneId, (m.get(i.zoneId) || 0) + 1);
    return m;
  }, [searchedItems]);

  const filterMatchCount = useMemo(
    () =>
      filterZones.length === 0
        ? searchedItems.length
        : searchedItems.filter((i) => filterZones.includes(i.zoneId)).length,
    [searchedItems, filterZones]
  );

  const [duplicateState, setDuplicateState] = useState<{
    conflicts: DuplicateConflict[];
    nonConflicting: ScheduleItem[];
    kind: ActivityKind;
    driver: AssigneeName;
    date: string;
  } | null>(null);

  // שורת הסטטיסטיקה מתכווצת (משותפת לשלושת הטאבים, נשמרת)
  const [statsCollapsed, toggleStatsCollapsed] = usePersistedCollapse(
    'collapse:dispatch-stats'
  );

  // ─── סינון היומן לפי סוג פעילות (נשמר ב-localStorage) ───
  const [visibleTypes, setVisibleTypes] = useState<Set<CalendarStopSource>>(loadCalendarFilter);
  useEffect(() => {
    localStorage.setItem(CALENDAR_FILTER_KEY, JSON.stringify([...visibleTypes]));
  }, [visibleTypes]);
  const toggleType = (t: CalendarStopSource) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      // לא מאפשרים להסתיר את הכל — תמיד נשאר לפחות סוג אחד
      return next.size === 0 ? new Set(ALL_SOURCE_TYPES) : next;
    });
  };

  // ספירת עצירות פעילות פר סוג (לצ'יפים)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of calendarStops) {
      if (s.status === 'cancelled') continue;
      counts[s.sourceType] = (counts[s.sourceType] ?? 0) + 1;
    }
    return counts;
  }, [calendarStops]);

  // ─── נגזרות יומן ───
  const calendarDeliveries: CalendarDelivery[] = useMemo(
    () => buildCalendarDeliveries(calendarStops, (s) => visibleTypes.has(s.sourceType)),
    [calendarStops, visibleTypes]
  );

  // כמה עצירות הסינון מסתיר בכל יום — כדי שהיומן יוכל לומר את זה במקום "אין עצירות".
  const hiddenByFilter = useMemo(() => {
    const map: Record<string, number> = {};
    if (visibleTypes.size === ALL_SOURCE_TYPES.length) return map;
    for (const s of calendarStops) {
      if (s.status === 'cancelled') continue;
      if (visibleTypes.has(s.sourceType)) continue;
      map[s.deliveryDate] = (map[s.deliveryDate] ?? 0) + 1;
    }
    return map;
  }, [calendarStops, visibleTypes]
  );

  const pendingScheduleIds = useMemo(
    () => new Set<string>(pendingSchedule?.items.map((i) => i.id) ?? []),
    [pendingSchedule]
  );

  // "חזרו מהקו" — קיים stop בסטטוס "לא בוצע" עבור המקור
  const returnedOrderIds = useMemo(
    () =>
      new Set<string>(
        calendarStops
          .filter((s) => s.status === 'not_completed' && s.sourceType === 'delivery' && s.orderId)
          .map((s) => s.orderId as string)
      ),
    [calendarStops]
  );
  const returnedCallIds = useMemo(
    () =>
      new Set<string>(
        calendarStops
          .filter((s) => s.status === 'not_completed' && s.sourceType === 'service' && s.serviceCallId)
          .map((s) => s.serviceCallId as string)
      ),
    [calendarStops]
  );
  const returnedPickupIds = useMemo(
    () =>
      new Set<string>(
        calendarStops
          .filter((s) => s.status === 'not_completed' && s.sourceType === 'pickup' && s.pickupId)
          .map((s) => s.pickupId as string)
      ),
    [calendarStops]
  );

  // ─── Selection (פר סוג) ───
  const toggleId = (prev: Set<string>, id: string) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const handleToggleOrder = useCallback(
    (id: string) => setSelectedOrderIds((prev) => toggleId(prev, id)),
    []
  );
  const handleToggleCall = useCallback(
    (id: string) => setSelectedCallIds((prev) => toggleId(prev, id)),
    []
  );
  const handleTogglePickup = useCallback(
    (id: string) => setSelectedPickupIds((prev) => toggleId(prev, id)),
    []
  );
  const handleToggleCustomer = useCallback(
    (id: string) => setSelectedCustomerIds((prev) => toggleId(prev, id)),
    []
  );

  // בטאב "הכל" מוצגות ארבע הרשימות יחד, ולכן הסוג לתזמון נגזר מהרשימה
  // שבה בפועל נבחרו פריטים, ולא מהטאב.
  const selectionKind: ActivityKind | null = selectedOrderIds.size
    ? 'delivery'
    : selectedCallIds.size
      ? 'service'
      : selectedPickupIds.size
        ? 'pickup'
        : selectedCustomerIds.size
          ? 'customer'
          : null;

  const activeSelection =
    selectionKind === 'delivery'
      ? selectedOrderIds
      : selectionKind === 'service'
        ? selectedCallIds
        : selectionKind === 'pickup'
          ? selectedPickupIds
          : selectionKind === 'customer'
            ? selectedCustomerIds
            : new Set<string>();

  const handleBulkSchedule = useCallback(() => {
    if (activeSelection.size === 0) return;
    setDatePickerOpen(true);
  }, [activeSelection]);

  // ─── שיבוץ מחדש (גרירת stop קיים ליום אחר) ───
  const buildRescheduleRef = (stopId: string): RescheduleStopRef | null => {
    const s = calendarStops.find((cs) => cs.id === stopId);
    if (!s) return null;
    return {
      stopId: s.id,
      sourceId: s.orderId ?? s.serviceCallId ?? s.pickupId ?? s.id,
      sourceType: s.sourceType,
      deliveryDate: s.deliveryDate,
      driver: s.driver as AssigneeName,
      coordinationStatus: s.coordinationStatus,
      timeWindowStart: s.timeWindowStart,
      timeWindowEnd: s.timeWindowEnd,
    };
  };

  const startReschedule = (stopId: string, newDate: string) => {
    const targetDay = new Date(newDate + 'T00:00:00').getDay();
    if (targetDay === 5 || targetDay === 6) {
      toast.error('לא ניתן לתזמן ליום שישי או שבת');
      return;
    }
    const ref = buildRescheduleRef(stopId);
    if (!ref || ref.deliveryDate === newDate) return; // אותו יום → לא שיבוץ מחדש
    setPendingReschedule({ stop: ref, newDate });
  };

  const handleRescheduleDriverSelected = (newDriver: AssigneeName) => {
    if (!pendingReschedule) return;
    rescheduleStopMut.mutate({
      stop: pendingReschedule.stop,
      newDate: pendingReschedule.newDate,
      newDriver,
    });
    setPendingReschedule(null);
  };

  // ─── "העבר ליום אחר" ───
  const handleMoveDateSelected = (date: string) => {
    if (!movingStop) return;
    setPendingMove({ stop: movingStop, newDate: date });
    setMovingStop(null);
  };
  const handleMoveDriverSelected = (driver: AssigneeName) => {
    if (!pendingMove) return;
    moveStop.mutate({
      stop: pendingMove.stop,
      newDate: pendingMove.newDate,
      newDriver: driver,
    });
    setPendingMove(null);
  };

  // ─── Drag handlers ───
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const t = active.data.current?.type;
    if (t === 'order') {
      setDraggedItem({ kind: 'delivery', order: active.data.current?.order as Order });
    } else if (t === 'serviceCall') {
      setDraggedItem({ kind: 'service', call: active.data.current?.call as ServiceCall });
    } else if (t === 'pickup') {
      setDraggedItem({ kind: 'pickup', pickup: active.data.current?.pickup as Pickup });
    } else if (t === 'customer') {
      setDraggedItem({ kind: 'customer', customer: active.data.current?.customer as NewCustomer });
    } else if (t === 'stop') {
      const s = calendarStops.find((cs) => cs.id === active.id);
      if (s) setDraggedStop({ customerName: s.customerName, city: s.city, sourceType: s.sourceType });
    }
  };

  const handleDragCancel = () => {
    setDraggedItem(null);
    setDraggedStop(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    setDraggedStop(null);

    if (!over) return;

    // ─── Reorder: stop → stop (באותו יום × עובד) ───
    if (
      active.data.current?.type === 'stop' &&
      over.data.current?.type === 'stop' &&
      active.id !== over.id
    ) {
      const srcDate = active.data.current.deliveryDate as string;
      const srcDriver = active.data.current.driver as AssigneeName;
      const overDate = over.data.current.deliveryDate as string;
      const overDriver = over.data.current.driver as AssigneeName;
      // נפל על יום אחר → שיבוץ מחדש (בורר עובד), לא reorder.
      if (srcDate !== overDate) {
        startReschedule(active.id as string, overDate);
        return;
      }
      if (srcDriver !== overDriver) return;

      const groupObjs = calendarStops.filter(
        (s) =>
          s.deliveryDate === srcDate &&
          s.driver === srcDriver &&
          s.status !== 'cancelled'
      );
      const groupStops = [...groupObjs]
        .sort((a, b) => a.sequence - b.sequence)
        .map((s) => s.id);
      const oldIndex = groupStops.indexOf(active.id as string);
      const newIndex = groupStops.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;

      const next = [...groupStops];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);

      // 🔴 שעת התיאום מנצחת את הסדר הידני (ראה lib/stop-order.ts). לכן גרירה
      // של עצירה עם שעה קבועה לא תזיז אותה על המסך. משתמש שאל בדיוק את זה
      // בלוח ההערות ב-09/06 ולא קיבל תשובה. עכשיו המערכת אומרת את זה בעצמה.
      const seqAfter = new Map(next.map((id, i) => [id, i]));
      const displayBefore = [...groupObjs].sort(compareStopsByTime).map((s) => s.id);
      const displayAfter = [...groupObjs]
        .map((s) => ({ ...s, sequence: seqAfter.get(s.id) ?? s.sequence }))
        .sort(compareStopsByTime)
        .map((s) => s.id);

      if (displayBefore.join('|') === displayAfter.join('|')) {
        toast('הסדר ביומן לא השתנה', {
          description:
            'סדר העצירות נקבע לפי שעת התיאום שנקבעה עם הלקוח. כדי להקדים לקוח, שנו את שעת התיאום שלו.',
          duration: 6000,
        });
      }

      reorderStops.mutate({
        deliveryDate: srcDate,
        driver: srcDriver,
        orderedIds: next,
      });
      return;
    }

    // ─── Reschedule: stop קיים → רקע של יום אחר ───
    if (active.data.current?.type === 'stop' && over.data.current?.type === 'day') {
      const newDate = over.data.current?.date as string;
      if (newDate) startReschedule(active.id as string, newDate);
      return;
    }

    // ─── Schedule: פריט ממתין (מכל סוג) → יום ───
    const activeType = active.data.current?.type as string | undefined;
    if (activeType && DRAGGABLE_ITEM_TYPES.has(activeType)) {
      const over_t = over.data.current?.type;
      let date: string | undefined;
      if (over_t === 'day') date = over.data.current?.date as string;
      else if (over_t === 'stop') date = over.data.current?.deliveryDate as string;
      if (!date) return;

      const targetDay = new Date(date + 'T00:00:00').getDay();
      if (targetDay === 5 || targetDay === 6) {
        toast.error('לא ניתן לתזמן ליום שישי או שבת');
        return;
      }

      if (activeType === 'order') {
        const order = active.data.current?.order as Order;
        const items =
          selectedOrderIds.has(order.id) && selectedOrderIds.size > 1
            ? unscheduledOrders.filter((o) => selectedOrderIds.has(o.id))
            : [order];
        setPendingSchedule({ kind: 'delivery', items, date });
      } else if (activeType === 'serviceCall') {
        const call = active.data.current?.call as ServiceCall;
        const items =
          selectedCallIds.has(call.id) && selectedCallIds.size > 1
            ? pendingCalls.filter((c) => selectedCallIds.has(c.id))
            : [call];
        setPendingSchedule({ kind: 'service', items, date });
      } else if (activeType === 'pickup') {
        const pickup = active.data.current?.pickup as Pickup;
        const items =
          selectedPickupIds.has(pickup.id) && selectedPickupIds.size > 1
            ? pendingPickups.filter((p) => selectedPickupIds.has(p.id))
            : [pickup];
        setPendingSchedule({ kind: 'pickup', items, date });
      } else {
        const customer = active.data.current?.customer as NewCustomer;
        const picked =
          selectedCustomerIds.has(customer.customerNumber) && selectedCustomerIds.size > 1
            ? pendingCustomers.filter((c) => selectedCustomerIds.has(c.customerNumber))
            : [customer];
        setPendingSchedule({ kind: 'customer', items: picked.map(customerToItem), date });
      }
      setDriverPickerOpen(true);
    }
  };

  // ─── תזמון bulk בלחיצה (מהרשימה של הטאב הפעיל) ───
  const handleDateSelected = useCallback(
    (date: string) => {
      const kind = selectionKind ?? TAB_TO_KIND[tab];
      let items: ScheduleItem[] = [];
      if (kind === 'delivery') {
        items = unscheduledOrders.filter((o) => selectedOrderIds.has(o.id));
      } else if (kind === 'service') {
        items = pendingCalls.filter((c) => selectedCallIds.has(c.id));
      } else if (kind === 'pickup') {
        items = pendingPickups.filter((p) => selectedPickupIds.has(p.id));
      } else {
        items = pendingCustomers
          .filter((c) => selectedCustomerIds.has(c.customerNumber))
          .map(customerToItem);
      }
      setDatePickerOpen(false);
      if (items.length === 0) return;
      setPendingSchedule({ kind, items, date });
      setDriverPickerOpen(true);
    },
    [tab, selectionKind, unscheduledOrders, pendingCalls, pendingPickups, pendingCustomers, selectedOrderIds, selectedCallIds, selectedPickupIds, selectedCustomerIds]
  );

  // ─── ביצוע השיבוץ בפועל (אחרי בדיקת כפילויות) ───
  // ─── תיאום מיד אחרי שיבוץ ───
  // תור של עצירות שנוצרו זה עתה וממתינות לתיאום, אחת אחרי השנייה.
  const [coordQueue, setCoordQueue] = useState<CalendarStopView[]>([]);
  const [coordIndex, setCoordIndex] = useState(0);

  const startCoordinationQueue = useCallback((stops: CalendarStopView[]) => {
    if (stops.length === 0) return;
    setCoordQueue(stops);
    setCoordIndex(0);
  }, []);

  const closeCoordinationQueue = useCallback(() => {
    setCoordQueue([]);
    setCoordIndex(0);
  }, []);

  /** סגירת הדיאלוג מקדמת לעצירה הבאה בתור, ובסוף סוגרת. */
  const advanceCoordinationQueue = useCallback(() => {
    setCoordIndex((prev) => {
      if (prev + 1 >= coordQueue.length) {
        setCoordQueue([]);
        return 0;
      }
      return prev + 1;
    });
  }, [coordQueue.length]);

  const runSchedule = useCallback(
    async (kind: ActivityKind, items: ScheduleItem[], driver: AssigneeName, date: string) => {
      // 🔴 המדידה הראתה שעמי מתאם טלפונית תוך 3.7 דקות בחציון מרגע השיבוץ,
      // ואף פעם לא לפניו. בעיניו זו פעולה אחת, ולכן אנחנו פותחים את התיאום
      // מיד ולא מכריחים אותו לחפש ביומן כרטיס שהמערכת בדיוק יצרה.
      const created: ReturnType<typeof toViewStop>[] = [];
      try {
        for (const item of items) {
          const stop = await scheduleStop.mutateAsync({
            deliveryDate: date,
            driver,
            sourceType: kind,
            ...(kind === 'delivery'
              ? { orderId: item.id }
              : kind === 'service'
                ? { serviceCallId: item.id }
                : kind === 'pickup'
                  ? { pickupId: item.id }
                  : { customerNumber: item.id }),
            customerName: item.customerName,
            address: item.address,
            city: item.city,
            phone: item.phone,
          });
          created.push(toViewStop(stop));
        }
        showScheduleToast({
          count: items.length,
          assignee: driver,
          date,
          kind: KIND_LABELS[kind].toastKind,
          // עצירה בודדת נפתחת לתיאום מיד. שיבוץ קבוצתי לא נפתח בכוח,
          // כי ייתכן שהוא משבץ קבוצה ומתקשר אחר כך.
          ...(created.length > 1
            ? {
                action: {
                  label: `תאם את ${created.length} העצירות`,
                  onClick: () => startCoordinationQueue(created),
                },
              }
            : {}),
        });
        if (created.length === 1) startCoordinationQueue(created);
      } catch (err) {
        console.error('schedule failed:', err);
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('calendar_stops_no_active_dup') || msg.includes('duplicate key')) {
          toast.error('השיבוץ נחסם: לקוח זה כבר משובץ פעיל ביומן');
        }
      } finally {
        setPendingSchedule(null);
        if (kind === 'delivery') setSelectedOrderIds(new Set());
        else if (kind === 'service') setSelectedCallIds(new Set());
        else if (kind === 'pickup') setSelectedPickupIds(new Set());
        else setSelectedCustomerIds(new Set());
      }
    },
    [scheduleStop, startCoordinationQueue]
  );

  // עובד נבחר → בדיקת כפילויות מוקדמת (לכל הסוגים, כולל איסופים) → שיבוץ/אזהרה
  const handleDriverSelected = useCallback(
    async (driver: AssigneeName) => {
      if (!pendingSchedule) return;
      const { kind, items, date } = pendingSchedule;
      setDriverPickerOpen(false);

      const conflicts: DuplicateConflict[] = [];
      const nonConflicting: ScheduleItem[] = [];
      for (const item of items) {
        try {
          const dupes = await findActiveDuplicateStops({
            customerName: item.customerName,
            phone: item.phone,
            address: item.address,
            city: item.city,
          });
          if (dupes.length > 0) {
            conflicts.push({
              customerName: item.customerName,
              city: item.city,
              phone: item.phone,
              existing: dupes,
            });
          } else {
            nonConflicting.push(item);
          }
        } catch (err) {
          console.error('pre-check failed for item', item.id, err);
          // כשל בבדיקה → ה-constraint ב-DB יתפוס את זה
          nonConflicting.push(item);
        }
      }

      if (conflicts.length > 0) {
        setDuplicateState({ conflicts, nonConflicting, kind, driver, date });
        return;
      }

      await runSchedule(kind, items, driver, date);
    },
    [pendingSchedule, runSchedule]
  );

  // ─── פעולות על עצירות ביומן ───
  const handleRemoveFromCalendar = async (stopId: string) => {
    const stop = calendarStops.find((s) => s.id === stopId);
    if (!stop) return;
    try {
      await deleteStop.mutateAsync(stop);
    } catch (err) {
      console.error('Failed to remove stop:', err);
    }
  };

  const handleResolveStop = async (
    stopId: string,
    status: 'completed' | 'not_completed'
  ) => {
    const stop = calendarStops.find((s) => s.id === stopId);
    if (!stop) return;
    // "לא בוצע" → פופאפ לרישום סיבה לפני הסימון
    if (status === 'not_completed') {
      setNotCompletedStop(stop);
      return;
    }
    log('stop_completed', {
      entityType: 'calendar_stop',
      entityId: stop.id,
      sourceType: stop.sourceType,
      customerName: stop.customerName,
    });
    try {
      await resolveStop.mutateAsync({ stop, status });
    } catch (err) {
      console.error('Failed to resolve stop:', err);
    }
  };

  const handleCreateTask = useCallback(
    async (data: {
      driver: AssigneeName;
      customerName: string;
      address?: string;
      city?: string;
      phone?: string;
      notes?: string;
    }) => {
      if (!taskDialogDate) return;
      try {
        await scheduleStop.mutateAsync({
          deliveryDate: taskDialogDate,
          driver: data.driver,
          sourceType: 'task',
          customerName: data.customerName,
          address: data.address,
          city: data.city,
          phone: data.phone,
          notes: data.notes,
        });
        toast.success(`המשימה נוספה ליומן (${data.driver})`);
      } catch (err) {
        console.error('Failed to create task:', err);
      } finally {
        setTaskDialogDate(null);
      }
    },
    [taskDialogDate, scheduleStop]
  );

  // ─── מצב טעינה/שגיאה של הטאב הפעיל בלבד (היומן לא מחכה לאף אחד) ───
  const tabLoading =
    tab === 'deliveries'
      ? ordersLoading
      : tab === 'service'
        ? callsLoading
        : tab === 'pickups'
          ? pickupsLoading
          : customersLoading;
  const tabError =
    tab === 'deliveries'
      ? ordersError
      : tab === 'service'
        ? callsError
        : tab === 'pickups'
          ? pickupsError
          : customersError;

  const renderTabState = () => {
    if (tabLoading) {
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">טוען...</p>
        </div>
      );
    }
    if (tabError) {
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">שגיאה בטעינת הנתונים</p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            {tabError.message}
          </p>
        </div>
      );
    }
    return null;
  };

  const tabState = renderTabState();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: silentAnnouncements,
        screenReaderInstructions: silentScreenReaderInstructions,
      }}
    >
      <div className="space-y-6">
        {/* ─── מתגי סוג פעילות ───
            דביקים מתחת לכותרת האתר, לפי הגובה שהיא מודדת. בין המתגים לרשימה יושבים
            שלושה אזורים מתקפלים, ובלי הדביקות הסדרן גולל ומאבד את הידיעה על
            איזה סוג פעילות הוא עומד. */}
        <div className="sticky top-[var(--app-header-h,61px)] z-30 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <TabsList className="h-11">
            <TabsTrigger value="all" className="gap-1.5 px-4">
              <ListChecks className="h-4 w-4" />
              הכל
              <Badge variant="secondary" className="me-1 h-5 px-1.5 text-xs">
                {unscheduledOrders.length +
                  pendingCalls.length +
                  pendingPickups.length +
                  bareCustomersCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-1.5 px-4">
              <Package className="h-4 w-4" />
              משלוחים
              <Badge variant="secondary" className="me-1 h-5 px-1.5 text-xs">
                {unscheduledOrders.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="service" className="gap-1.5 px-4">
              <Wrench className="h-4 w-4" />
              קריאות שירות
              <Badge variant="secondary" className="me-1 h-5 px-1.5 text-xs">
                {pendingCalls.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pickups" className="gap-1.5 px-4">
              <Undo2 className="h-4 w-4" />
              איסופים
              <Badge variant="secondary" className="me-1 h-5 px-1.5 text-xs">
                {pendingPickups.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1.5 px-4">
              <UserPlus className="h-4 w-4" />
              לקוחות חדשים
              <Badge
                className="me-1 h-5 bg-violet-600 px-1.5 text-xs hover:bg-violet-600"
              >
                {bareCustomersCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        </div>

        {/* עצירות עבר שנשארו פתוחות — משותף לכל הטאבים */}
        <StuckStopsAlert stops={calendarStops} onResolve={handleResolveStop} />

        {/* חיפוש וסינון אזור אחד, חל על כל סוגי המסמכים שמוצגים */}
        <DispatchFilterBar
          search={filterSearch}
          onSearchChange={setFilterSearch}
          selectedZones={filterZones}
          onZoneToggle={toggleFilterZone}
          onClearZones={() => setFilterZones([])}
          countByZone={filterZoneCounts}
          matchCount={filterMatchCount}
          totalCount={visibleItems.length}
        />

        {/* ─── אזור מתחלף: הממתינים של הסוג הנבחר ─── */}
        {(tab === 'deliveries' || tab === 'all') && (
          (tab === 'all' ? null : tabState) ?? (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={toggleStatsCollapsed}
                >
                  {statsCollapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  סטטוס
                </Button>
                <DedupToggle hiddenCount={ordersHiddenCount} />
              </div>
              {!statsCollapsed && (
                <DeliveryStatusBar
                  waitingCount={unscheduledOrders.length}
                  scheduledCount={scheduledOrders.length}
                  deliveredThisWeek={deliveredOrders.length}
                />
              )}
              <UnscheduledOrders
                orders={unscheduledOrders}
                orderCountByZone={orderCountByZone}
                orderZoneMap={orderZoneMap}
                selectedOrderIds={selectedOrderIds}
                onToggleSelect={handleToggleOrder}
                onSelectAll={(ids) => setSelectedOrderIds(new Set(ids))}
                onClearSelection={() => setSelectedOrderIds(new Set())}
                onBulkSchedule={handleBulkSchedule}
                isDragging={draggedItem?.kind === 'delivery'}
                pendingScheduleIds={pendingScheduleIds}
                groupSize={ordersGroupSize}
                returnedIds={returnedOrderIds}
                handledOrders={[...scheduledOrders, ...deliveredOrders]}
                search={filterSearch}
                selectedZones={filterZones}
              />
            </>
          )
        )}

        {(tab === 'service' || tab === 'all') && (
          (tab === 'all' ? null : tabState) ?? (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={toggleStatsCollapsed}
                >
                  {statsCollapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  סטטוס
                </Button>
                <DedupToggle hiddenCount={callsHiddenCount} />
              </div>
              {!statsCollapsed && (
                <ServiceCallStatusBar
                  pendingCount={pendingCalls.length}
                  scheduledCount={scheduledCalls.length}
                  completedCount={completedCalls.length}
                />
              )}
              <UnscheduledServiceCalls
                calls={pendingCalls}
                callCountByZone={callCountByZone}
                callZoneMap={callZoneMap}
                groupSize={callsGroupSize}
                selectedCallIds={selectedCallIds}
                onToggleSelect={handleToggleCall}
                onSelectAll={(ids) => setSelectedCallIds(new Set(ids))}
                onClearSelection={() => setSelectedCallIds(new Set())}
                onBulkSchedule={handleBulkSchedule}
                pendingScheduleIds={pendingScheduleIds}
                returnedIds={returnedCallIds}
                handledCalls={[...scheduledCalls, ...completedCalls]}
                search={filterSearch}
                selectedZones={filterZones}
              />
            </>
          )
        )}

        {(tab === 'pickups' || tab === 'all') && (
          (tab === 'all' ? null : tabState) ?? (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={toggleStatsCollapsed}
                >
                  {statsCollapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  סטטוס
                </Button>
              </div>
              {!statsCollapsed && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">ממתינים לתיאום</p>
                    <p className="mt-1 text-2xl font-bold text-teal-600">{pendingPickups.length}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">משובצים ביומן</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600">{scheduledPickupsCount}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">נאספו</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{collectedPickupsCount}</p>
                  </Card>
                </div>
              )}
              <UnscheduledPickups
                pickups={pendingPickups}
                selectedIds={selectedPickupIds}
                onToggleSelect={handleTogglePickup}
                onSelectAll={(ids) => setSelectedPickupIds(new Set(ids))}
                onClearSelection={() => setSelectedPickupIds(new Set())}
                onBulkSchedule={handleBulkSchedule}
                pendingScheduleIds={pendingScheduleIds}
                returnedIds={returnedPickupIds}
                onShowDetails={setDetailPickup}
                search={filterSearch}
                selectedZones={filterZones}
              />
            </>
          )
        )}

        {(tab === 'customers' || tab === 'all') && (
          (tab === 'all' ? null : tabState) ?? (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={toggleStatsCollapsed}
                >
                  {statsCollapsed ? (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  סטטוס
                </Button>
              </div>
              {!statsCollapsed && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">ללא הזמנה</p>
                    <p className="mt-1 text-2xl font-bold text-violet-600">{bareCustomersCount}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">נפתחו בסך הכל</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600">{pendingCustomers.length}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">משובצים ביומן</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">
                      {scheduledCustomersCount}
                    </p>
                  </Card>
                </div>
              )}
              <UnscheduledCustomers
                customers={pendingCustomers}
                selectedIds={selectedCustomerIds}
                onToggleSelect={handleToggleCustomer}
                onSelectAll={(ids) => setSelectedCustomerIds(new Set(ids))}
                onClearSelection={() => setSelectedCustomerIds(new Set())}
                onBulkSchedule={handleBulkSchedule}
                pendingScheduleIds={pendingScheduleIds}
                onlyBare={customersOnlyBare}
                onOnlyBareChange={setCustomersOnlyBare}
                search={filterSearch}
                selectedZones={filterZones}
              />
            </>
          )
        )}

        {/* ─── יומן קבוע: נשאר mounted בכל החלפת טאב ─── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              מציג ביומן
              {visibleTypes.size < ALL_SOURCE_TYPES.length && (
                <span className="text-amber-700">
                  {' '}
                  ({visibleTypes.size} מתוך {ALL_SOURCE_TYPES.length} סוגים)
                </span>
              )}
              :
            </span>
            {ALL_SOURCE_TYPES.map((t) => {
              const meta = CHIP_META[t];
              const on = visibleTypes.has(t);
              const count = typeCounts[t] ?? 0;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    on ? meta.on : meta.off
                  )}
                  title={on ? `הסתר ${meta.label} מהיומן` : `הצג ${meta.label} ביומן`}
                >
                  <meta.Icon className="h-3.5 w-3.5" />
                  {meta.label}
                  {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
            {visibleTypes.size < ALL_SOURCE_TYPES.length && (
              <button
                type="button"
                onClick={() => setVisibleTypes(new Set(ALL_SOURCE_TYPES))}
                className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                title="החזר את היומן להצגת כל הסוגים"
              >
                הצג הכל
              </button>
            )}
          </div>

          <DeliveryCalendar
            deliveries={calendarDeliveries}
            hiddenByFilter={hiddenByFilter}
            onShowAllTypes={() => setVisibleTypes(new Set(ALL_SOURCE_TYPES))}
            onRemoveOrder={handleRemoveFromCalendar}
            onAddTask={(date) => setTaskDialogDate(date)}
            onResolveStop={handleResolveStop}
            onViewDayMap={(date) => setMapDialogDate(date)}
            onMoveStop={(stopId) => {
              const s = calendarStops.find((cs) => cs.id === stopId);
              if (s) setMovingStop(s);
            }}
          />
        </div>
      </div>

      {/* תיאום מיד אחרי שיבוץ, בלי לחפש את הכרטיס ביומן */}
      <ScheduleCoordinationDialog
        stop={coordQueue[coordIndex] ?? null}
        open={coordQueue.length > 0}
        onOpenChange={(isOpen) => {
          if (!isOpen) advanceCoordinationQueue();
        }}
        queue={
          coordQueue.length > 1
            ? {
                index: coordIndex,
                total: coordQueue.length,
                onFinishAll: closeCoordinationQueue,
              }
            : undefined
        }
      />

      {/* ─── Drag Overlay ─── */}
      <DragOverlay dropAnimation={dropAnimationDown}>
        {draggedStop && (
          <div className="w-56 rounded-xl border-2 border-primary bg-card p-3 shadow-2xl rotate-2 cursor-grabbing ring-4 ring-primary/20">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <span>
                {draggedStop.sourceType === 'service'
                  ? '🔧'
                  : draggedStop.sourceType === 'task'
                    ? '📋'
                    : draggedStop.sourceType === 'pickup'
                      ? '↩️'
                      : '📦'}
              </span>
              <span className="truncate">{draggedStop.customerName}</span>
            </div>
            {draggedStop.city && (
              <div className="mt-1 truncate text-xs text-muted-foreground">{draggedStop.city}</div>
            )}
          </div>
        )}
        {draggedItem && (() => {
          const item =
            draggedItem.kind === 'delivery'
              ? draggedItem.order
              : draggedItem.kind === 'service'
                ? draggedItem.call
                : draggedItem.kind === 'pickup'
                  ? draggedItem.pickup
                  : { ...draggedItem.customer, id: draggedItem.customer.customerNumber };
          const selection =
            draggedItem.kind === 'delivery'
              ? selectedOrderIds
              : draggedItem.kind === 'service'
                ? selectedCallIds
                : draggedItem.kind === 'pickup'
                  ? selectedPickupIds
                  : selectedCustomerIds;
          const isMulti = selection.has(item.id) && selection.size > 1;
          const style =
            draggedItem.kind === 'delivery'
              ? { border: 'border-primary ring-primary/20', icon: '📦', iconColor: 'text-primary', badge: 'bg-primary text-primary-foreground' }
              : draggedItem.kind === 'service'
                ? { border: 'border-orange-400 ring-orange-400/20', icon: '🔧', iconColor: 'text-orange-600', badge: 'bg-orange-500 text-white' }
                : draggedItem.kind === 'pickup'
                  ? { border: 'border-teal-400 ring-teal-400/20', icon: '↩️', iconColor: 'text-teal-600', badge: 'bg-teal-500 text-white' }
                  : { border: 'border-violet-400 ring-violet-400/20', icon: '🧑\u200d🦽', iconColor: 'text-violet-600', badge: 'bg-violet-500 text-white' };
          return (
            <div className="relative">
              {/* Stack visualization — 2 כרטיסים מאחור כשבחירה מרובה */}
              {isMulti && (
                <>
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-60 -rotate-3 translate-y-2 translate-x-2" />
                  <div className="absolute inset-0 w-56 rounded-xl border bg-card shadow-md opacity-80 -rotate-1 translate-y-1 translate-x-1" />
                </>
              )}
              <div className={cn('relative w-56 rounded-xl border-2 bg-card p-3 shadow-2xl rotate-2 cursor-grabbing ring-4', style.border)}>
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <span className={style.iconColor}>{style.icon}</span>
                  <span className="truncate">{item.customerName}</span>
                </div>
                {(item.city || ('address' in item && item.address)) && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {draggedItem.kind === 'delivery'
                      ? `${draggedItem.order.address ?? ''}${draggedItem.order.city ? `, ${draggedItem.order.city}` : ''}`
                      : item.city}
                  </div>
                )}
                {isMulti && (
                  <div className={cn('absolute -top-2.5 -start-2.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-lg ring-2 ring-background', style.badge)}>
                    {selection.size}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </DragOverlay>

      {/* ─── דיאלוגים ─── */}

      {/* אזהרת כפילויות — לכל הסוגים */}
      <DuplicateScheduleWarningDialog
        open={duplicateState !== null}
        onOpenChange={(o) => {
          if (!o) setDuplicateState(null);
        }}
        conflicts={duplicateState?.conflicts ?? []}
        nonConflictingCount={duplicateState?.nonConflicting.length ?? 0}
        onCancel={() => {
          setDuplicateState(null);
          setPendingSchedule(null);
        }}
        onScheduleOthers={() => {
          if (!duplicateState) return;
          const { nonConflicting, kind, driver, date } = duplicateState;
          setDuplicateState(null);
          if (nonConflicting.length > 0) {
            void runSchedule(kind, nonConflicting, driver, date);
          }
        }}
      />

      {/* "לא בוצע" — רישום סיבה */}
      <NotCompletedReasonDialog
        open={!!notCompletedStop}
        customerName={notCompletedStop?.customerName}
        submitting={resolveStop.isPending}
        onOpenChange={(o) => {
          if (!o) setNotCompletedStop(null);
        }}
        onConfirm={(reason) => {
          if (!notCompletedStop) return;
          log('stop_not_completed', {
            entityType: 'calendar_stop',
            entityId: notCompletedStop.id,
            sourceType: notCompletedStop.sourceType,
            customerName: notCompletedStop.customerName,
            metadata: { reason },
          });
          resolveStop.mutate(
            { stop: notCompletedStop, status: 'not_completed', notes: reason },
            { onSuccess: () => setNotCompletedStop(null) }
          );
        }}
      />

      {/* בורר עובד — שיבוץ (גרירה / תזמון bulk) */}
      <DriverSelector
        assignees={ASSIGNEES}
        title={pendingSchedule ? KIND_LABELS[pendingSchedule.kind].pickerTitle : undefined}
        open={driverPickerOpen}
        onClose={() => {
          setDriverPickerOpen(false);
          setPendingSchedule(null);
        }}
        onSelectDriver={handleDriverSelected}
        orderInfo={
          pendingSchedule
            ? pendingSchedule.items.length > 1
              ? `${pendingSchedule.items.length} ${KIND_LABELS[pendingSchedule.kind].many}`
              : pendingSchedule.items[0].customerName
            : undefined
        }
        customerName={
          pendingSchedule && pendingSchedule.items.length === 1
            ? (pendingSchedule.kind === 'delivery'
                ? pendingSchedule.items[0].address
                : pendingSchedule.items[0].city) ?? undefined
            : undefined
        }
      />

      {/* בורר עובד — שיבוץ מחדש (גרירת stop קיים ליום אחר) */}
      <DriverSelector
        assignees={ASSIGNEES}
        title="בחר עובד"
        open={!!pendingReschedule}
        onClose={() => setPendingReschedule(null)}
        onSelectDriver={handleRescheduleDriverSelected}
        orderInfo={
          pendingReschedule
            ? `שיבוץ מחדש ל-${new Date(pendingReschedule.newDate + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`
            : undefined
        }
      />

      {/* בורר תאריך — תזמון bulk בלחיצה */}
      <DatePickerDialog
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onDateSelected={handleDateSelected}
        orderCount={activeSelection.size}
      />

      {/* "העבר ליום אחר" — בורר תאריך */}
      <DatePickerDialog
        open={!!movingStop}
        onClose={() => setMovingStop(null)}
        onDateSelected={handleMoveDateSelected}
        orderCount={1}
      />

      {/* "העבר ליום אחר" — בורר עובד */}
      <DriverSelector
        assignees={ASSIGNEES}
        title="העבר ליום אחר — בחר עובד"
        open={!!pendingMove}
        onClose={() => setPendingMove(null)}
        onSelectDriver={handleMoveDriverSelected}
        orderInfo={
          pendingMove
            ? `העברה ל-${new Date(pendingMove.newDate + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`
            : undefined
        }
        customerName={pendingMove?.stop.customerName}
      />

      {/* משימה חופשית לעובד */}
      <TaskDialog
        open={taskDialogDate !== null}
        onClose={() => setTaskDialogDate(null)}
        date={taskDialogDate}
        assignees={ASSIGNEES}
        onSubmit={handleCreateTask}
      />

      {/* פרטי איסוף */}
      <PickupDetailDialog
        pickup={detailPickup}
        open={!!detailPickup}
        onOpenChange={(o) => !o && setDetailPickup(null)}
      />

      {/* מפת יום מלאה */}
      <DayMapDialog
        open={mapDialogDate !== null}
        onClose={() => setMapDialogDate(null)}
        date={mapDialogDate}
        stops={
          mapDialogDate
            ? calendarDeliveries
                .filter((d) => d.date === mapDialogDate)
                .flatMap((d) => d.stops)
            : []
        }
        onOptimize={(driver, orderedIds) => {
          if (!mapDialogDate) return;
          reorderStops.mutate({
            deliveryDate: mapDialogDate,
            driver,
            orderedIds,
          });
        }}
      />
    </DndContext>
  );
}
