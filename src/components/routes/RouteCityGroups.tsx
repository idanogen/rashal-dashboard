import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { buildSingleMapUrl } from '@/lib/maps';
import type { CityGroup } from '@/hooks/useDeliverableOrders';
import type { Order } from '@/types/order';

interface RouteCityGroupsProps {
  cityGroups: CityGroup[];
  selectedIds: Set<string>;
  onToggleOrder: (id: string) => void;
  onToggleCity: (orders: Order[]) => void;
}

export function RouteCityGroups({
  cityGroups,
  selectedIds,
  onToggleOrder,
  onToggleCity,
}: RouteCityGroupsProps) {
  // Track which cities are collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(city: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  if (cityGroups.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            אין הזמנות מוכנות למשלוח
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            הזמנות עם סטטוס "תואמה אספקה" יופיעו כאן
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {cityGroups.map((group) => {
        const isCollapsed = collapsed.has(group.city);
        const allSelected = group.orders.every((o) => selectedIds.has(o.id));
        const someSelected = group.orders.some((o) => selectedIds.has(o.id));
        const selectedCount = group.orders.filter((o) => selectedIds.has(o.id)).length;

        return (
          <Card key={group.city} className="border shadow-sm overflow-hidden">
            {/* City Header */}
            <button
              type="button"
              onClick={() => toggleCollapse(group.city)}
              className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-right transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCity(group.orders);
                  }}
                >
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    className="ml-1"
                  />
                </div>
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{group.city}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.orders.length} הזמנות
                </Badge>
                {selectedCount > 0 && (
                  <Badge className="text-xs bg-primary/10 text-primary border-0">
                    {selectedCount} נבחרו
                  </Badge>
                )}
              </div>
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Orders List */}
            {!isCollapsed && (
              <CardContent className="p-0">
                <div className="divide-y">
                  {group.orders.map((order) => {
                    const isSelected = selectedIds.has(order.id);
                    const mapUrl = buildSingleMapUrl(order);

                    return (
                      <label
                        key={order.id}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleOrder(order.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {order.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {order.phone && (
                            <a
                              href={`tel:${order.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                              dir="ltr"
                            >
                              <Phone className="h-3 w-3" />
                              {order.phone}
                            </a>
                          )}
                          {mapUrl && (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                              title="הצג במפה"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
