import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Search, ChevronDown, Plus } from 'lucide-react';
import type { Order } from '@/types/order';
import { getDaysColor } from '@/lib/utils';

interface AvailableOrdersPanelProps {
  /** כל ההזמנות הזמינות */
  orders: Order[];
  /** IDs של הזמנות שכבר במסלול */
  selectedIds: string[];
  /** קריאה חוזרת להוספת הזמנה */
  onAdd: (orderId: string) => void;
}

/**
 * פאנל הזמנות זמינות להוספה למסלול
 *
 * מציג:
 * - חיפוש/סינון
 * - קיבוץ לפי עיר (collapsible)
 * - כפתור הוספה לכל הזמנה
 */
export function AvailableOrdersPanel({
  orders,
  selectedIds,
  onAdd,
}: AvailableOrdersPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // סינון הזמנות שלא במסלול
  const availableOrders = useMemo(() => {
    return orders.filter((order) => !selectedIds.includes(order.id));
  }, [orders, selectedIds]);

  // סינון לפי חיפוש
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableOrders;
    }

    const query = searchQuery.toLowerCase();
    return availableOrders.filter(
      (order) =>
        order.customerName?.toLowerCase().includes(query) ||
        order.city?.toLowerCase().includes(query) ||
        order.address?.toLowerCase().includes(query)
    );
  }, [availableOrders, searchQuery]);

  // קיבוץ לפי עיר
  const groupedByCity = useMemo(() => {
    const groups: Record<string, Order[]> = {};

    filteredOrders.forEach((order) => {
      const city = order.city || 'ללא עיר';
      if (!groups[city]) {
        groups[city] = [];
      }
      groups[city].push(order);
    });

    // מיון ערים לפי מספר הזמנות (יורד)
    return Object.entries(groups).sort(
      ([, ordersA], [, ordersB]) => ordersB.length - ordersA.length
    );
  }, [filteredOrders]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* חיפוש */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="חיפוש לפי שם, עיר או כתובת..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* רשימה */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {groupedByCity.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {availableOrders.length === 0
              ? 'כל ההזמנות כבר במסלול'
              : 'לא נמצאו תוצאות'}
          </div>
        ) : (
          groupedByCity.map(([city, cityOrders]) => (
            <CityGroup
              key={city}
              city={city}
              orders={cityOrders}
              onAdd={onAdd}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * קבוצת עיר (collapsible)
 */
function CityGroup({
  city,
  orders,
  onAdd,
}: {
  city: string;
  orders: Order[];
  onAdd: (orderId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 p-3 text-right hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
          <span className="font-semibold text-sm">{city}</span>
          <Badge variant="secondary" className="text-xs">
            {orders.length}
          </Badge>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-1 space-y-1">
        {orders.map((order) => (
          <AvailableOrderItem
            key={order.id}
            order={order}
            onAdd={onAdd}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * פריט הזמנה זמינה
 */
function AvailableOrderItem({
  order,
  onAdd,
}: {
  order: Order;
  onAdd: (orderId: string) => void;
}) {
  const days = order.created
    ? Math.floor(
        (Date.now() - new Date(order.created).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const daysColor = getDaysColor(days);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2 text-sm">
      {/* פרטי הזמנה */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium">{order.customerName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {order.address}
        </p>
      </div>

      {/* Badge ימים */}
      {days !== null && (
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${daysColor}`}
        >
          {days}
        </Badge>
      )}

      {/* כפתור הוספה */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAdd(order.id)}
        className="h-7 w-7 shrink-0 p-0 text-primary hover:bg-primary/10"
        aria-label="הוסף למסלול"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
