import { useMemo, useState, type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Clock,
  GripVertical,
  Info,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  Square,
  Undo2,
  X,
} from 'lucide-react';

import { CustomerHistoryButton, type HistoryCustomerRef } from '@/components/CustomerHistoryButton';
import { ReturnedNote } from '@/components/ReturnedNote';
import type { ReturnedInfo } from '@/lib/returned-from-route';
import { ZoneFilter } from '@/components/deliveries/ZoneFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import { getDaysColor, getDaysSinceCreated, cn } from '@/lib/utils';
import { NO_ADDRESS_ZONE, ZONES, getZoneById } from '@/types/zone';

/**
 * רשימת הממתינים המשותפת לארבעת סוגי העבודה (משלוחים · שירות · איסופים ·
 * לקוחות חדשים). עד 12/08/2026 כל סוג היה רכיב נפרד: הזמנות ושירות צברו
 * פיצ'רים במשך חודשים, ואיסופים ולקוחות נכתבו מאוחר יותר מאפס ונראו אחרת
 * לגמרי. כאן הכל יושב במקום אחד, וכל סוג רק ממפה את עצמו ל-DispatchItemVM.
 */

// ─── View model ────────────────────────────────────────────
export interface DispatchItemVM {
  /** המזהה שמשמש לבחירה, ל-pending ול-returned. */
  id: string;
  /** מזהה ה-draggable — חייב להישאר זהה למה שה-handlers בדף מצפים לו. */
  dragId: string;
  /** ה-payload של הגרירה, כולל שדה type. */
  dragData: Record<string, unknown>;
  zoneId: string;
  customerName: string;
  customerNumber?: string;
  phone?: string;
  /** שורת הכתובת בתחתית הכרטיס. */
  addressLine?: string;
  /** תאריך הפתיחה — לבאדג' הוותק. */
  created?: string;
  /** כפילות Priority — באדג' ×N. */
  dupCount?: number;
  /** שורות מידע ייחודיות לסוג (ציוד · תקלה · מסמך). */
  meta?: ReactNode;
  /** באדג' צמוד לשם הלקוח. */
  nameBadge?: ReactNode;
  /** באדג'ים בתחתית הכרטיס. */
  footerBadges?: ReactNode;
  /** מחרוזת החיפוש, כבר ב-lowercase. */
  searchText: string;
  /** דיאלוג פרטים שמנוהל בתוך הכרטיס. */
  renderDetail?: (open: boolean, onClose: () => void) => ReactNode;
  /** דיאלוג פרטים שמנוהל בדף (ה-state יושב אצל ההורה). */
  onShowDetails?: () => void;
  /** תווית כפתור הפרטים, ברירת מחדל "פרטים". */
  detailLabel?: string;
  /** היסטוריית הלקוח — כשלא מוגדר הכפתור לא מוצג. */
  history?: HistoryCustomerRef;
}

/** רשומה שכבר טופלה — מוצגת כשהחיפוש לא מחזיר ממתינים. */
export interface HandledMatch {
  id: string;
  customerName: string;
  customerNumber?: string;
  status?: string;
}

// ─── Card ──────────────────────────────────────────────────
interface DispatchCardProps {
  vm: DispatchItemVM;
  accentBorder: string;
  isExcluded?: boolean;
  isSelected?: boolean;
  isPending?: boolean;
  isReturned?: boolean;
  /** מה שהנהג רשם כשסימן "לא בוצע". נוסע עם החיווי, לא במקומו. */
  returnedInfo?: ReturnedInfo;
  onExclude?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
}

function DispatchCard({
  vm,
  accentBorder,
  isExcluded,
  isSelected,
  isPending,
  isReturned,
  returnedInfo,
  onExclude,
  onRestore,
  onToggleSelect,
}: DispatchCardProps) {
  const days = getDaysSinceCreated(vm.created);
  const daysColor = getDaysColor(days);
  const [detailOpen, setDetailOpen] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: vm.dragId,
    data: vm.dragData,
    disabled: isExcluded,
  });

  const hasDetails = Boolean(vm.renderDetail || vm.onShowDetails);

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        // פס צד צבעוני לפי סוג — בטאב "הכל" ארבע הרשימות זו מתחת לזו,
        // ובלי הסימון הזה אי אפשר לדעת על מה מסתכלים.
        'group relative border-s-4',
        accentBorder,
        // אין transition בזמן גרירה — מונע "תקיעה" בין ה-isDragging ל-transform
        !isDragging && 'transition-[opacity,transform,box-shadow] duration-150',
        isExcluded
          ? 'opacity-40 border-dashed cursor-default'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md',
        isReturned &&
          !isExcluded &&
          !isSelected &&
          'ring-2 ring-red-400 bg-red-50/40 dark:bg-red-950/10',
        isSelected && !isExcluded && 'ring-2 ring-primary bg-primary/5',
        isDragging && 'opacity-30 ring-2 ring-primary',
        isPending && !isDragging && 'opacity-25 scale-[0.97] pointer-events-none'
      )}
      onClick={() => {
        if (!isExcluded && !isDragging) onToggleSelect?.(vm.id);
      }}
      {...(isExcluded ? {} : { ...listeners, ...attributes })}
    >
      <CardContent className="p-3">
        {/* Selection indicator */}
        {isSelected && !isExcluded && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Exclude / Restore */}
        {isExcluded ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore?.(vm.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            title="החזר לרשימה"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExclude?.(vm.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title="הסר מהרשימה"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Grip handle */}
        {!isExcluded && (
          <div className="absolute bottom-2 left-2 text-muted-foreground/30">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        )}

        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-semibold', isExcluded && 'line-through')}>
              {vm.customerName}
              {vm.dupCount && vm.dupCount > 1 && (
                <span
                  className="ms-1 inline-flex h-4 items-center rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800"
                  title={`כפילות מ-Priority — ${vm.dupCount} רשומות זהות אוחדו לשורה אחת`}
                >
                  ×{vm.dupCount}
                </span>
              )}
              {vm.nameBadge}
              {isReturned && (
                <span
                  className="ms-1 inline-flex h-4 items-center gap-0.5 rounded bg-red-100 px-1 text-[10px] font-bold text-red-700"
                  title={
                    returnedInfo?.note
                      ? `סומן "לא בוצע" · ${returnedInfo.note}`
                      : "רשומה זו סומנה 'לא בוצע' וחזרה מהקו"
                  }
                >
                  <Undo2 className="h-2.5 w-2.5" />
                  חזר מהקו
                </span>
              )}
            </p>
            {isReturned && <ReturnedNote info={returnedInfo} />}
            {vm.customerNumber && (
              <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                מס' לקוח: {vm.customerNumber}
              </p>
            )}
            {vm.meta}
            {vm.phone && (
              <div className="mt-1 flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a
                  href={`tel:${vm.phone}`}
                  className="text-xs text-muted-foreground hover:text-primary"
                  dir="ltr"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {vm.phone}
                </a>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {days !== null && (
              <Badge variant="outline" className={`text-xs ${daysColor}`}>
                <Clock className="ml-1 h-3 w-3" />
                {days}d
              </Badge>
            )}
            <div className="flex items-center gap-1">
              {hasDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (vm.renderDetail) setDetailOpen(true);
                    else vm.onShowDetails?.();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  title="הפרטים המלאים"
                >
                  <Info className="h-3.5 w-3.5" />
                  {vm.detailLabel ?? 'פרטים'}
                </button>
              )}
              {vm.history && <CustomerHistoryButton customer={vm.history} />}
            </div>
          </div>
        </div>

        {vm.footerBadges && (
          <div className="mb-2 flex flex-wrap items-center gap-1">{vm.footerBadges}</div>
        )}

        {vm.addressLine && (
          <div className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{vm.addressLine}</span>
          </div>
        )}

        {vm.renderDetail?.(detailOpen, () => setDetailOpen(false))}
      </CardContent>
    </Card>
  );
}

// ─── Panel ─────────────────────────────────────────────────
interface UnscheduledPanelProps {
  items: DispatchItemVM[];
  title: string;
  Icon: LucideIcon;
  /** class לפס הצד הצבעוני, למשל border-s-blue-500 */
  accentBorder: string;
  /** שם היחידה ביחיד וברבים, לטקסטים של הבחירה והתזמון */
  noun: { one: string; many: string };
  emptyText: string;
  searchPlaceholder: string;
  /** קידומת מפתחות ה-localStorage של הכיווצים */
  storageKey: string;
  /** ספירה לצ'יפים של האזורים. כשלא מועבר — מחושבת מהפריטים שאחרי החיפוש. */
  countByZone?: Map<string, number>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearSelection?: () => void;
  onBulkSchedule?: () => void;
  pendingScheduleIds?: Set<string>;
  returnedIds?: Set<string>;
  /** ישות ⟵ הסיבה שהנהג רשם. `buildReturnedMap` מייצר את שניהם יחד. */
  returnedInfo?: Map<string, ReturnedInfo>;
  /** רשומות שכבר טופלו — מוצגות כשהחיפוש לא מחזיר ממתינים */
  handled?: HandledMatch[];
  /** תיבת הסבר מעל הפאנל */
  intro?: ReactNode;
  /** כפתורים נוספים בשורת הכלים העליונה */
  toolbarExtra?: ReactNode;
  /**
   * חיפוש ואזורים מבחוץ. כשהם מועברים, הפאנל לא מצייר את תיבת החיפוש ואת
   * סינון האזורים בעצמו — הם יושבים פעם אחת מעל כל הרשימות (DispatchFilterBar),
   * כדי שסינון אחד יחול על כל סוגי המסמכים יחד.
   */
  search?: string;
  selectedZones?: string[];
}

export function UnscheduledPanel({
  items: allItems,
  title,
  Icon,
  accentBorder,
  noun,
  emptyText,
  searchPlaceholder,
  storageKey,
  countByZone,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  pendingScheduleIds,
  returnedIds,
  returnedInfo,
  handled,
  intro,
  toolbarExtra,
  search: searchProp,
  selectedZones: zonesProp,
}: UnscheduledPanelProps) {
  // מי שחזר מהקו יוצא לרצועה אדומה משלו; השאר עובר את מסלול הסינון הרגיל.
  const returnedItems = useMemo(
    () => (returnedIds ? allItems.filter((i) => returnedIds.has(i.id)) : []),
    [allItems, returnedIds]
  );
  const items = useMemo(
    () => (returnedIds ? allItems.filter((i) => !returnedIds.has(i.id)) : allItems),
    [allItems, returnedIds]
  );

  // כשהחיפוש/האזורים מגיעים מבחוץ הם מנצחים, וה-state המקומי לא נצבע כלל.
  const searchControlled = searchProp !== undefined;
  const zonesControlled = zonesProp !== undefined;
  const [localZones, setLocalZones] = useState<string[]>([]);
  const [localSearch, setLocalSearch] = useState('');
  const search = searchProp ?? localSearch;
  const selectedZones = zonesProp ?? localZones;
  const setSearch = setLocalSearch;
  const setSelectedZones = setLocalZones;
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [zoneFilterCollapsed, toggleZoneFilterCollapsed] = usePersistedCollapse(
    `collapse:${storageKey}-zone-filter`
  );
  const [listCollapsed, toggleListCollapsed] = usePersistedCollapse(`collapse:${storageKey}-list`);
  const [returnedCollapsed, toggleReturnedCollapsed] = usePersistedCollapse(
    `collapse:${storageKey}-returned`
  );

  const handleZoneToggle = (zoneId: string) =>
    setSelectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );

  const handleClearAllZones = () => {
    setSelectedZones([]);
    setExcludedIds(new Set());
  };

  const handleExclude = (id: string) => setExcludedIds((prev) => new Set(prev).add(id));

  const handleRestore = (id: string) =>
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const handleToggleZone = (zoneId: string) =>
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });

  // חיפוש חופשי קודם, כדי שספירת האזורים תשקף את מה שבאמת מוצג
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.searchText.includes(q));
  }, [items, search]);

  const zoneCounts = useMemo(() => {
    if (countByZone) return countByZone;
    const m = new Map<string, number>();
    for (const i of searched) m.set(i.zoneId, (m.get(i.zoneId) || 0) + 1);
    return m;
  }, [countByZone, searched]);

  const filteredItems = useMemo(
    () =>
      selectedZones.length > 0
        ? searched.filter((i) => selectedZones.includes(i.zoneId))
        : searched,
    [searched, selectedZones]
  );

  // כשהחיפוש לא מחזיר ממתינים — מציגים את מי שכבר טופל, כדי שלא ייראה כאילו נעלם
  const handledMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || filteredItems.length > 0 || !handled) return [];
    return handled.filter((h) =>
      [h.customerName, h.customerNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [search, filteredItems.length, handled]);

  const activeItems = filteredItems.filter((i) => !excludedIds.has(i.id));
  const excludedCount = filteredItems.length - activeItems.length;

  // קיבוץ לפי אזור, ממוין מצפון לדרום
  const groupedByZone = useMemo(() => {
    const map = new Map<string, DispatchItemVM[]>();
    for (const item of filteredItems) {
      const group = map.get(item.zoneId) || [];
      group.push(item);
      map.set(item.zoneId, group);
    }
    const zoneOrder = ZONES.map((z) => z.id);
    const sorted = new Map<string, DispatchItemVM[]>();
    Array.from(map.entries())
      .sort(([a], [b]) => {
        const idxA = a === 'unassigned' ? Infinity : zoneOrder.indexOf(a);
        const idxB = b === 'unassigned' ? Infinity : zoneOrder.indexOf(b);
        return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
      })
      .forEach(([k, v]) => sorted.set(k, v));
    return sorted;
  }, [filteredItems]);

  const allZonesExpanded = useMemo(() => {
    const ids = Array.from(groupedByZone.keys());
    return ids.length > 0 && ids.every((id) => expandedZones.has(id));
  }, [groupedByZone, expandedZones]);

  const handleToggleAllZones = () =>
    setExpandedZones(allZonesExpanded ? new Set() : new Set(groupedByZone.keys()));

  if (items.length === 0 && returnedItems.length === 0) {
    return (
      <div className="space-y-3">
        {intro}
        <div className="rounded-lg border-2 border-dashed bg-muted/30 p-6 text-center">
          <Icon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyText}</p>
          {/* בלי זה מתג הסינון נעלם יחד עם הרשימה, ואי אפשר לצאת ממצב ריק */}
          {toolbarExtra && <div className="mt-3 flex justify-center">{toolbarExtra}</div>}
        </div>
      </div>
    );
  }

  const renderCard = (vm: DispatchItemVM, opts?: { returned?: boolean }) => (
    <DispatchCard
      key={vm.id}
      vm={vm}
      accentBorder={accentBorder}
      isReturned={opts?.returned}
      returnedInfo={returnedInfo?.get(vm.id)}
      isExcluded={excludedIds.has(vm.id)}
      isSelected={selectedIds.has(vm.id)}
      isPending={pendingScheduleIds?.has(vm.id)}
      onExclude={handleExclude}
      onRestore={handleRestore}
      onToggleSelect={onToggleSelect}
    />
  );

  return (
    <div className="space-y-4">
      {intro}

      {/* חזרו מהקו */}
      {returnedItems.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50/60 p-3 shadow-sm dark:border-red-900 dark:bg-red-950/10">
          <div className={cn('flex items-center gap-2', !returnedCollapsed && 'mb-2')}>
            <Undo2 className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
              חזרו מהקו ({returnedItems.length})
            </h3>
            <span className="text-[11px] text-red-600/70">
              סומנו "לא בוצע" — ממתינות לשיבוץ מחדש
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="ms-auto h-6 w-6 text-red-600"
              onClick={toggleReturnedCollapsed}
            >
              {returnedCollapsed ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!returnedCollapsed && (
            <div className="grid max-h-[240px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {returnedItems.map((vm) => renderCard(vm, { returned: true }))}
            </div>
          )}
        </div>
      )}

      {/* סינון לפי אזור — רק כשהוא לא מנוהל מבחוץ */}
      {!zonesControlled && (
        <ZoneFilter
          selectedZones={selectedZones}
          onZoneToggle={handleZoneToggle}
          onClearAll={handleClearAllZones}
          orderCountByZone={zoneCounts}
          collapsed={zoneFilterCollapsed}
          onToggleCollapse={toggleZoneFilterCollapsed}
        />
      )}

      {/* הפאנל */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="sticky top-[calc(var(--app-header-h,61px)+56px)] z-20 border-b bg-muted/95 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-bold">{title}</h3>
              <Badge variant="secondary">{filteredItems.length}</Badge>
              {/* בלי זה המספר כאן נמוך מזה שעל המתג למעלה, וזה נראה כמו תקלה */}
              {returnedItems.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ועוד {returnedItems.length} חזרו מהקו
                </span>
              )}
              {onSelectAll &&
                activeItems.length > 0 &&
                (() => {
                  const activeIds = activeItems.map((i) => i.id);
                  const allSelected = activeIds.every((id) => selectedIds.has(id));
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectAll(allSelected ? [] : activeIds)}
                      className="h-7 gap-1 text-xs"
                    >
                      {allSelected ? (
                        <>
                          <Square className="h-3 w-3" />
                          בטל סימון
                        </>
                      ) : (
                        <>
                          <CheckSquare className="h-3 w-3" />
                          סמן הכל ({activeItems.length})
                        </>
                      )}
                    </Button>
                  );
                })()}
              {excludedCount > 0 && (
                <>
                  <Badge variant="outline" className="border-destructive/30 text-destructive">
                    {excludedCount} הוסרו
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExcludedIds(new Set())}
                    className="h-7 gap-1 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    אפס בחירה
                  </Button>
                </>
              )}
              {toolbarExtra}
            </div>
            <div className="flex items-center gap-2">
              {!searchControlled && (
                <div className="relative">
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-8 w-[230px] pr-8 text-xs"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute left-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      title="נקה חיפוש"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'all' | 'grouped')}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">תצוגה רגילה</SelectItem>
                  <SelectItem value="grouped">קיבוץ לפי אזור</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleListCollapsed}>
                {listCollapsed ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* התוכן */}
        {listCollapsed ? null : viewMode === 'all' ? (
          filteredItems.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">לא נמצאו רשומות התואמות לחיפוש</p>
              {handledMatches.length > 0 && (
                <div className="mx-auto mt-3 max-w-md rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-right dark:border-blue-900 dark:bg-blue-950/10">
                  <p className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    לקוחות תואמים שכבר טופלו ({handledMatches.length}):
                  </p>
                  <ul className="space-y-1">
                    {handledMatches.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium">
                          {h.customerName}
                          {h.customerNumber ? ` · ${h.customerNumber}` : ''}
                        </span>
                        {h.status && (
                          <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {h.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="grid max-h-[380px] grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredItems.map((vm) => renderCard(vm))}
            </div>
          )
        ) : (
          <div className="max-h-[440px] space-y-2 overflow-y-auto p-4">
            <div className="mb-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAllZones}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {allZonesExpanded ? 'סגור הכל' : 'פתח הכל'}
              </Button>
            </div>
            {Array.from(groupedByZone.entries()).map(([zoneId, zoneItems]) => {
              const zone = getZoneById(zoneId);
              const activeInZone = zoneItems.filter((i) => !excludedIds.has(i.id)).length;
              const isExpanded = expandedZones.has(zoneId);
              return (
                <div key={zoneId} className="overflow-hidden rounded-lg border">
                  <button
                    onClick={() => handleToggleZone(zoneId)}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-3 text-right transition-colors hover:bg-muted/50',
                      isExpanded && 'border-b bg-muted/30'
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronLeft className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    {zone?.color && (
                      <span className={cn('h-3 w-3 flex-shrink-0 rounded-full', zone.color)} />
                    )}
                    <span className="font-semibold">
                      {zone?.name ??
                        (zoneId === NO_ADDRESS_ZONE ? 'חסרה כתובת' : 'ללא אזור')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {activeInZone}/{zoneItems.length}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {zoneItems.map((vm) => renderCard(vm))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* שורת הפעולה — תזמון בלחיצה או בגרירה ליומן */}
        {!listCollapsed && selectedIds.size > 0 && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-primary/5 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>
                <span className="font-bold text-primary">{selectedIds.size}</span>{' '}
                {selectedIds.size === 1 ? `${noun.one} נבחרה` : `${noun.many} נבחרו`}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                · ניתן לתזמן בלחיצה או בגרירה ליומן
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClearSelection} className="text-xs">
                בטל
              </Button>
              {onBulkSchedule && (
                <Button size="sm" onClick={onBulkSchedule} className="gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  תזמן {selectedIds.size} {selectedIds.size === 1 ? noun.one : noun.many}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
