import { CustomerHistoryButton } from '@/components/CustomerHistoryButton';
import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import { useState, useMemo } from 'react';
import type { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Phone,
  MapPin,
  Clock,
  X,
  Undo2,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  CheckCircle2,
  GripVertical,
  CalendarDays,
  CheckSquare,
  Square,
  Search,
  Info,
} from 'lucide-react';
import { useCallback } from 'react';
import { ZoneFilter } from './ZoneFilter';
import { getZoneById, ZONES } from '@/types/zone';
import { getDaysSinceCreated, getDaysColor, cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';

// ─── Draggable Order Card ──────────────────────────────────
interface OrderCardProps {
  order: Order;
  isExcluded?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  /** הזמנה ששוחררה ומחכה לבחירת נהג — opacity מופחת. */
  isPending?: boolean;
  /** הזמנה שחזרה מהקו (סומנה "לא בוצע") — הבלטה אדומה. */
  isReturned?: boolean;
  dupCount?: number;
  onExclude?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
}

function DraggableOrderCard({
  order,
  isExcluded,
  isSelected,
  isDragging: isAnyDragging,
  isPending,
  isReturned,
  dupCount,
  onExclude,
  onRestore,
  onToggleSelect,
}: OrderCardProps) {
  const days = getDaysSinceCreated(order.created);
  const daysColor = getDaysColor(days);
  const [detailOpen, setDetailOpen] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: {
      type: 'order',
      order,
    },
    disabled: isExcluded,
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'relative',
        // אין transition בזמן גרירה — מונע "תקיעה" בין ה-isDragging ל-transform
        !isDragging && 'transition-[opacity,transform,box-shadow] duration-150',
        isExcluded
          ? 'opacity-40 border-dashed cursor-default'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md',
        isReturned && !isExcluded && !isSelected && 'ring-2 ring-red-400 bg-red-50/40 dark:bg-red-950/10',
        isSelected && !isExcluded && 'ring-2 ring-primary bg-primary/5',
        isDragging && 'opacity-30 ring-2 ring-primary',
        isPending && !isDragging && 'opacity-25 scale-[0.97] pointer-events-none'
      )}
      onClick={() => {
        if (!isExcluded && !isDragging) onToggleSelect?.(order.id);
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

        {/* Exclude / Restore button */}
        {isExcluded ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore?.(order.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="החזר למסלול"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExclude?.(order.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            title="הסר מהמסלול"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Grip handle */}
        {!isExcluded && (
          <div className="absolute left-2 bottom-2 text-muted-foreground/30">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        )}

        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                isExcluded && 'line-through'
              )}
            >
              {order.customerName}
              {dupCount && dupCount > 1 && (
                <span
                  className="ms-1 inline-flex h-4 items-center rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800"
                  title={`כפילות מ-Priority — ${dupCount} רשומות זהות אוחדו לשורה אחת`}
                >
                  ×{dupCount}
                </span>
              )}
              {isReturned && (
                <span
                  className="ms-1 inline-flex h-4 items-center gap-0.5 rounded bg-red-100 px-1 text-[10px] font-bold text-red-700"
                  title="הזמנה זו סומנה 'לא בוצע' וחזרה מהקו"
                >
                  <Undo2 className="h-2.5 w-2.5" />
                  חזר מהקו
                </span>
              )}
            </p>
            {order.customerNumber && (
              <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                מס' לקוח: {order.customerNumber}
              </p>
            )}
            {order.items && order.items.length > 0 && (
              <p
                className="mt-0.5 text-[11px] text-muted-foreground"
                title={order.items
                  .map((it) => `${it.desc ?? it.part ?? ''}${it.qty && it.qty !== 1 ? ` ×${it.qty}` : ''}`)
                  .join('\n')}
              >
                ציוד: <bdi>{order.items[0].desc ?? order.items[0].part}</bdi>
                {order.items[0].qty && order.items[0].qty !== 1 ? ` ×${order.items[0].qty}` : ''}
                {order.items.length > 1 && (
                  <span className="font-medium"> (+{order.items.length - 1} פריטים)</span>
                )}
              </p>
            )}
            {order.phone && (
              <div className="mt-1 flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a
                  href={`tel:${order.phone}`}
                  className="text-xs text-muted-foreground hover:text-primary"
                  dir="ltr"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {order.phone}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDetailOpen(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                title="פרטי ההזמנה המלאים"
              >
                <Info className="h-3.5 w-3.5" />
                פרטים
              </button>
              <CustomerHistoryButton
                customer={{
                  currentId: order.id,
                  customerNumber: order.customerNumber,
                  customerName: order.customerName,
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {order.address}
            {order.city ? `, ${order.city}` : ''}
          </span>
        </div>

        <OrderDetailDialog
          order={order}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────
interface UnscheduledOrdersProps {
  orders: Order[];
  orderCountByZone: Map<string, number>;
  orderZoneMap: Map<string, string>;
  // Selection props
  selectedOrderIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
  /** Replace the whole selection with these IDs (or empty = clear). */
  onSelectAll?: (orderIds: string[]) => void;
  onBulkSchedule?: () => void;
  onClearSelection?: () => void;
  isDragging?: boolean;
  /** הזמנות שמחכות לבחירת נהג — opacity מופחת על הכרטיס */
  pendingScheduleIds?: Set<string>;
  // Route building → calendar
  onBuildRoute?: (orders: Order[]) => void;
  /** orderId → group size for "x2" badge on duplicate groups */
  groupSize?: Map<string, number>;
  /** orderIds that came back from the route (a not_completed stop exists). */
  returnedIds?: Set<string>;
  /** הזמנות שכבר טופלו (תואמה אספקה / סופק) — לחיווי "כבר משובץ" כשחיפוש ריק בממתינים. */
  handledOrders?: Order[];
}

export function UnscheduledOrders({
  orders: allOrders,
  orderCountByZone,
  orderZoneMap,
  selectedOrderIds = new Set(),
  onToggleSelect,
  onSelectAll,
  onBulkSchedule,
  onClearSelection,
  isDragging,
  pendingScheduleIds,
  onBuildRoute,
  groupSize,
  returnedIds,
  handledOrders,
}: UnscheduledOrdersProps) {
  // Split off "returned from route" items into their own highlighted section;
  // the rest flow through the normal zone/group/select machinery unchanged.
  const returnedOrders = useMemo(
    () => (returnedIds ? allOrders.filter((o) => returnedIds.has(o.id)) : []),
    [allOrders, returnedIds]
  );
  const orders = useMemo(
    () => (returnedIds ? allOrders.filter((o) => !returnedIds.has(o.id)) : allOrders),
    [allOrders, returnedIds]
  );
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [excludedOrderIds, setExcludedOrderIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [zoneFilterCollapsed, setZoneFilterCollapsed] = useState(false);
  const [ordersCollapsed, setOrdersCollapsed] = useState(false);

  const handleZoneToggle = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId)
        ? prev.filter((id) => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleClearAllZones = () => {
    setSelectedZones([]);
    setExcludedOrderIds(new Set());
  };

  const handleExcludeOrder = (orderId: string) => {
    setExcludedOrderIds((prev) => new Set(prev).add(orderId));
  };

  const handleRestoreOrder = (orderId: string) => {
    setExcludedOrderIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  const handleResetExcluded = () => {
    setExcludedOrderIds(new Set());
  };

  const handleToggleZone = (zoneId: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      next.has(zoneId) ? next.delete(zoneId) : next.add(zoneId);
      return next;
    });
  };

  // סינון לפי אזורים נבחרים + חיפוש חופשי (שם לקוח / מספר לקוח / טלפון)
  const filteredOrders = useMemo(() => {
    let list =
      selectedZones.length > 0
        ? orders.filter((o) => {
            const zone = orderZoneMap.get(o.id);
            return zone && selectedZones.includes(zone);
          })
        : orders;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        [o.customerName, o.customerNumber, o.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, orderZoneMap, selectedZones, search]);

  // כשהחיפוש לא מחזיר ממתינים — נחפש בהזמנות שכבר טופלו, להציג "כבר משובץ/סופק".
  const handledMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || filteredOrders.length > 0 || !handledOrders) return [];
    return handledOrders.filter((o) =>
      [o.customerName, o.customerNumber, o.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [search, filteredOrders.length, handledOrders]);

  // הזמנות פעילות (אחרי הסרת excluded)
  const activeOrders = filteredOrders.filter(
    (o) => !excludedOrderIds.has(o.id)
  );

  const excludedCount = filteredOrders.length - activeOrders.length;

  // קיבוץ לפי אזור (לתצוגה מקובצת) — ממוין מצפון לדרום
  const groupedByZone = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of filteredOrders) {
      const zoneId = orderZoneMap.get(order.id) || 'unassigned';
      const group = map.get(zoneId) || [];
      group.push(order);
      map.set(zoneId, group);
    }
    const sorted = new Map<string, Order[]>();
    const zoneOrder = ZONES.map((z) => z.id);
    Array.from(map.entries())
      .sort(([a], [b]) => {
        const idxA = a === 'unassigned' ? Infinity : zoneOrder.indexOf(a);
        const idxB = b === 'unassigned' ? Infinity : zoneOrder.indexOf(b);
        return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
      })
      .forEach(([k, v]) => sorted.set(k, v));
    return sorted;
  }, [filteredOrders, orderZoneMap]);

  const handleToggleAllZones = () => {
    const allZoneIds = Array.from(groupedByZone.keys());
    const allExpanded = allZoneIds.every((id) => expandedZones.has(id));
    if (allExpanded) {
      setExpandedZones(new Set());
    } else {
      setExpandedZones(new Set(allZoneIds));
    }
  };

  const allZonesExpanded = useMemo(() => {
    const allZoneIds = Array.from(groupedByZone.keys());
    return (
      allZoneIds.length > 0 &&
      allZoneIds.every((id) => expandedZones.has(id))
    );
  }, [groupedByZone, expandedZones]);

  if (orders.length === 0 && returnedOrders.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-muted/30 p-6 text-center">
        <Package className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          אין הזמנות ממתינות לתיאום
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Returned from route — highlighted section */}
      {returnedOrders.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50/60 p-3 shadow-sm dark:border-red-900 dark:bg-red-950/10">
          <div className="mb-2 flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
              חזרו מהקו ({returnedOrders.length})
            </h3>
            <span className="text-[11px] text-red-600/70">סומנו "לא בוצע" — ממתינות לשיבוץ מחדש</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {returnedOrders.map((order) => (
              <DraggableOrderCard
                key={order.id}
                order={order}
                isReturned
                isSelected={selectedOrderIds.has(order.id)}
                isPending={pendingScheduleIds?.has(order.id)}
                dupCount={groupSize?.get(order.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zone Filter */}
      <ZoneFilter
        selectedZones={selectedZones}
        onZoneToggle={handleZoneToggle}
        onClearAll={handleClearAllZones}
        orderCountByZone={orderCountByZone}
        collapsed={zoneFilterCollapsed}
        onToggleCollapse={() => setZoneFilterCollapsed((p) => !p)}
      />

      {/* Main Panel */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-bold">הזמנות ממתינות לתיאום</h3>
              <Badge variant="secondary">{filteredOrders.length}</Badge>
              {/* Select-all / clear-selection toggle */}
              {onSelectAll && activeOrders.length > 0 && (() => {
                const activeIds = activeOrders.map((o) => o.id);
                const allSelected =
                  activeIds.length > 0 &&
                  activeIds.every((id) => selectedOrderIds.has(id));
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
                        סמן את כל ההזמנות ({activeOrders.length})
                      </>
                    )}
                  </Button>
                );
              })()}
              {excludedCount > 0 && (
                <>
                  <Badge
                    variant="outline"
                    className="text-destructive border-destructive/30"
                  >
                    {excludedCount} הוסרו
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetExcluded}
                    className="h-7 gap-1 text-xs"
                  >
                    <RotateCcw className="h-3 w-3" />
                    אפס בחירה
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש: שם / מספר לקוח / טלפון"
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
              <Select
                value={viewMode}
                onValueChange={(v) => setViewMode(v as 'all' | 'grouped')}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">תצוגה רגילה</SelectItem>
                  <SelectItem value="grouped">קיבוץ לפי אזור</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOrdersCollapsed((p) => !p)}
              >
                {ordersCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {ordersCollapsed ? null : viewMode === 'all' ? (
          filteredOrders.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                לא נמצאו הזמנות ממתינות התואמות לחיפוש
              </p>
              {handledMatches.length > 0 && (
                <div className="mx-auto mt-3 max-w-md rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-right dark:border-blue-900 dark:bg-blue-950/10">
                  <p className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    לקוחות תואמים שכבר טופלו ({handledMatches.length}):
                  </p>
                  <ul className="space-y-1">
                    {handledMatches.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium">
                          {o.customerName}
                          {o.customerNumber ? ` · ${o.customerNumber}` : ''}
                        </span>
                        <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {o.orderStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
          <div className="grid max-h-[500px] grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredOrders.map((order) => (
              <div key={order.id} className="group">
                <DraggableOrderCard
                  order={order}
                  isExcluded={excludedOrderIds.has(order.id)}
                  isSelected={selectedOrderIds.has(order.id)}
                  isDragging={isDragging}
                  isPending={pendingScheduleIds?.has(order.id)}
                  dupCount={groupSize?.get(order.id)}
                  onExclude={handleExcludeOrder}
                  onRestore={handleRestoreOrder}
                  onToggleSelect={onToggleSelect}
                />
              </div>
            ))}
          </div>
          )
        ) : (
          <div className="max-h-[600px] space-y-2 overflow-y-auto p-4">
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
            {Array.from(groupedByZone.entries()).map(
              ([zoneId, zoneOrders]) => {
                const zone = getZoneById(zoneId);
                const activeInZone = zoneOrders.filter(
                  (o) => !excludedOrderIds.has(o.id)
                ).length;
                const isExpanded = expandedZones.has(zoneId);
                return (
                  <div
                    key={zoneId}
                    className="overflow-hidden rounded-lg border"
                  >
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
                        <span
                          className={cn(
                            'h-3 w-3 flex-shrink-0 rounded-full',
                            zone.color
                          )}
                        />
                      )}
                      <span className="font-semibold">
                        {zone?.name || 'ללא אזור'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {activeInZone}/{zoneOrders.length}
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {zoneOrders.map((order) => (
                          <div key={order.id} className="group">
                            <DraggableOrderCard
                              order={order}
                              isExcluded={excludedOrderIds.has(order.id)}
                              isSelected={selectedOrderIds.has(order.id)}
                              isDragging={isDragging}
                              dupCount={groupSize?.get(order.id)}
                              onExclude={handleExcludeOrder}
                              onRestore={handleRestoreOrder}
                              onToggleSelect={onToggleSelect}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* Floating action bar — מציע גם לחיצה (לפתיחת DatePicker) וגם גרירה */}
        {!ordersCollapsed && selectedOrderIds.size > 0 && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-primary/5 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>
                <span className="font-bold text-primary">
                  {selectedOrderIds.size}
                </span>{' '}
                {selectedOrderIds.size === 1 ? 'הזמנה נבחרה' : 'הזמנות נבחרו'}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                · ניתן לתזמן בלחיצה או בגרירה ליומן
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="text-xs"
              >
                בטל
              </Button>
              {onBulkSchedule && (
                <Button
                  size="sm"
                  onClick={onBulkSchedule}
                  className="gap-1.5"
                >
                  <CalendarDays className="h-4 w-4" />
                  תזמן {selectedOrderIds.size}{' '}
                  {selectedOrderIds.size === 1 ? 'הזמנה' : 'הזמנות'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
