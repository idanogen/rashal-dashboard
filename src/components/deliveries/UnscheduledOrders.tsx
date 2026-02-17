import { useState } from 'react';
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
import { Package, Phone, MapPin, Clock, Truck, X, Undo2, RotateCcw } from 'lucide-react';
import { ZoneFilter } from './ZoneFilter';
import { RouteBuilderDialog } from './RouteBuilderDialog';
import { getZoneById } from '@/types/zone';
import { getDaysSinceCreated, getDaysColor, cn } from '@/lib/utils';

// ─── Order Card ────────────────────────────────────────────
interface OrderCardProps {
  order: Order;
  isExcluded?: boolean;
  onExclude?: (id: string) => void;
  onRestore?: (id: string) => void;
}

function OrderCard({ order, isExcluded, onExclude, onRestore }: OrderCardProps) {
  const days = getDaysSinceCreated(order.created);
  const daysColor = getDaysColor(days);

  return (
    <Card
      className={cn(
        'relative transition-all',
        isExcluded
          ? 'opacity-40 border-dashed'
          : 'hover:shadow-md'
      )}
    >
      <CardContent className="p-3">
        {/* Exclude / Restore button */}
        {isExcluded ? (
          <button
            onClick={() => onRestore?.(order.id)}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="החזר למסלול"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onExclude?.(order.id)}
            className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            title="הסר מהמסלול"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
}

export function UnscheduledOrders({
  orders,
  orderCountByZone,
  orderZoneMap,
}: UnscheduledOrdersProps) {
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [isRouteBuilderOpen, setIsRouteBuilderOpen] = useState(false);
  const [excludedOrderIds, setExcludedOrderIds] = useState<Set<string>>(new Set());

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

  // קיבוץ לפי אזור (לתצוגה מקובצת)
  const groupedByZone = new Map<string, Order[]>();
  for (const order of filteredOrders) {
    const zoneId = orderZoneMap.get(order.id) || 'unassigned';
    const group = groupedByZone.get(zoneId) || [];
    group.push(order);
    groupedByZone.set(zoneId, group);
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-muted/30 p-6 text-center">
        <Package className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          אין הזמנות ממתינות לתיאום 🎉
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
                  <Badge variant="outline" className="text-destructive border-destructive/30">
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
              <Button
                size="default"
                variant="default"
                onClick={() => setIsRouteBuilderOpen(true)}
                disabled={activeOrders.length === 0}
                className="gap-2"
              >
                <Truck className="h-4 w-4" />
                בנה מסלול ({activeOrders.length})
              </Button>
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
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'all' ? (
          <div className="grid max-h-[500px] grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredOrders.map((order) => (
              <div key={order.id} className="group">
                <OrderCard
                  order={order}
                  isExcluded={excludedOrderIds.has(order.id)}
                  onExclude={handleExcludeOrder}
                  onRestore={handleRestoreOrder}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[600px] space-y-4 overflow-y-auto p-4">
            {Array.from(groupedByZone.entries()).map(
              ([zoneId, zoneOrders]) => {
                const zone = getZoneById(zoneId);
                const activeInZone = zoneOrders.filter(
                  (o) => !excludedOrderIds.has(o.id)
                ).length;
                return (
                  <div key={zoneId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <h4 className="font-semibold">
                        {zone?.name || 'ללא אזור'}
                      </h4>
                      <Badge variant="outline">{activeInZone}/{zoneOrders.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {zoneOrders.map((order) => (
                        <div key={order.id} className="group">
                          <OrderCard
                            order={order}
                            isExcluded={excludedOrderIds.has(order.id)}
                            onExclude={handleExcludeOrder}
                            onRestore={handleRestoreOrder}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Route Builder Dialog */}
      <RouteBuilderDialog
        open={isRouteBuilderOpen}
        onOpenChange={setIsRouteBuilderOpen}
        orders={activeOrders}
      />
    </div>
  );
}
