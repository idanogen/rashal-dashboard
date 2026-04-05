import { useState, useMemo } from 'react';
import type { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  onExclude?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
}

function DraggableOrderCard({
  order,
  isExcluded,
  isSelected,
  isDragging: isAnyDragging,
  onExclude,
  onRestore,
  onToggleSelect,
}: OrderCardProps) {
  const days = getDaysSinceCreated(order.created);
  const daysColor = getDaysColor(days);

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
        'relative transition-all',
        isExcluded
          ? 'opacity-40 border-dashed cursor-default'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md',
        isSelected && !isExcluded && 'ring-2 ring-primary bg-primary/5',
        isDragging && 'opacity-30 scale-95'
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
            </p>
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
          {days !== null && (
            <Badge variant="outline" className={`text-xs ${daysColor}`}>
              <Clock className="ml-1 h-3 w-3" />
              {days}d
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {order.address}
            {order.city ? `, ${order.city}` : ''}
          </span>
        </div>
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
  onBulkSchedule?: () => void;
  onClearSelection?: () => void;
  isDragging?: boolean;
  // Route building → calendar
  onBuildRoute?: (orders: Order[]) => void;
}

export function UnscheduledOrders({
  orders,
  orderCountByZone,
  orderZoneMap,
  selectedOrderIds = new Set(),
  onToggleSelect,
  onBulkSchedule,
  onClearSelection,
  isDragging,
  onBuildRoute,
}: UnscheduledOrdersProps) {
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
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

  // סינון לפי אזורים נבחרים
  const filteredOrders =
    selectedZones.length > 0
      ? orders.filter((o) => {
          const zone = orderZoneMap.get(o.id);
          return zone && selectedZones.includes(zone);
        })
      : orders;

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

  if (orders.length === 0) {
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
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-bold">הזמנות ממתינות לתיאום</h3>
              <Badge variant="secondary">{filteredOrders.length}</Badge>
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
          <div className="grid max-h-[500px] grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredOrders.map((order) => (
              <div key={order.id} className="group">
                <DraggableOrderCard
                  order={order}
                  isExcluded={excludedOrderIds.has(order.id)}
                  isSelected={selectedOrderIds.has(order.id)}
                  isDragging={isDragging}
                  onExclude={handleExcludeOrder}
                  onRestore={handleRestoreOrder}
                  onToggleSelect={onToggleSelect}
                />
              </div>
            ))}
          </div>
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
