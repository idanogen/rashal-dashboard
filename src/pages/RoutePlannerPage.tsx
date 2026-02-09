import { useState, useMemo, useCallback } from 'react';
import { useDeliverableOrders } from '@/hooks/useDeliverableOrders';
import { RouteCityGroups } from '@/components/routes/RouteCityGroups';
import { RouteSelectedPanel } from '@/components/routes/RouteSelectedPanel';
import { Loader2, AlertCircle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Order } from '@/types/order';

export function RoutePlannerPage() {
  const { deliverable, cityGroups, isLoading, error, totalOrders } =
    useDeliverableOrders();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedOrders = useMemo(
    () => deliverable.filter((o) => selectedIds.has(o.id)),
    [deliverable, selectedIds]
  );

  // Toggle single order
  const toggleOrder = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Toggle all orders in a city
  const toggleCity = useCallback((cityOrders: Order[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = cityOrders.every((o) => next.has(o.id));
      if (allSelected) {
        cityOrders.forEach((o) => next.delete(o.id));
      } else {
        cityOrders.forEach((o) => next.add(o.id));
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">טוען הזמנות...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">שגיאה בטעינת הנתונים</p>
        <p className="max-w-md text-center text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'שגיאה לא ידועה'}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          נסה שוב
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">תכנון מסלול משלוח</h2>
          <p className="text-xs text-muted-foreground">
            {deliverable.length} הזמנות מוכנות למשלוח ב-{cityGroups.length} ערים
            {totalOrders > 0 && ` (מתוך ${totalOrders} סה"כ)`}
          </p>
        </div>
      </div>

      {/* Two-column layout: city groups (right/main) | selected panel (left/sidebar) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RouteCityGroups
            cityGroups={cityGroups}
            selectedIds={selectedIds}
            onToggleOrder={toggleOrder}
            onToggleCity={toggleCity}
          />
        </div>
        <div className="lg:col-span-1">
          <RouteSelectedPanel
            selectedOrders={selectedOrders}
            onRemove={toggleOrder}
            onClear={() => setSelectedIds(new Set())}
          />
        </div>
      </div>
    </div>
  );
}
