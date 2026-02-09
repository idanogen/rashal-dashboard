import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { ArrowUpDown, Phone, MapPin, Clock } from 'lucide-react';
import type { Order } from '@/types/order';
import { OrderStatusBadge } from './OrderStatusBadge';
import { StatusDropdown } from './StatusDropdown';
import { OrderDetailDialog } from './OrderDetailDialog';
import { type OrderFiltersState } from './OrderFilters';
import { getDaysSinceCreated, getDaysColor } from '@/lib/utils';

interface OrdersTableProps {
  orders: Order[];
  filters: OrderFiltersState;
}

type SortKey = 'customerName' | 'city' | 'orderStatus' | 'openedBy' | 'created' | 'daysSince';
type SortDir = 'asc' | 'desc';

export function OrdersTable({ orders, filters }: OrdersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filter
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const nameMatch = o.customerName?.toLowerCase().includes(q);
        const phoneMatch = o.phone?.includes(filters.search);
        if (!nameMatch && !phoneMatch) return false;
      }
      // Order status
      if (filters.orderStatus && o.orderStatus !== filters.orderStatus) return false;
      // Worker
      if (filters.worker && o.openedBy !== filters.worker) return false;
      // City
      if (filters.city && o.city !== filters.city) return false;

      return true;
    });
  }, [orders, filters]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === 'daysSince') {
        const daysA = getDaysSinceCreated(a.created) ?? -1;
        const daysB = getDaysSinceCreated(b.created) ?? -1;
        const cmp = daysA - daysB;
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      const cmp = String(valA).localeCompare(String(valB), 'he');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortableHeader({ column, children }: { column: SortKey; children: React.ReactNode }) {
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors text-xs font-semibold"
        onClick={() => toggleSort(column)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </TableHead>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 text-center text-xs font-semibold">#</TableHead>
                <SortableHeader column="customerName">שם הלקוח</SortableHeader>
                <TableHead className="text-xs font-semibold">טלפון</TableHead>
                <SortableHeader column="city">עיר</SortableHeader>
                <SortableHeader column="orderStatus">סטטוס הזמנה</SortableHeader>
                <SortableHeader column="openedBy">נפתח ע״י</SortableHeader>
                <SortableHeader column="created">תאריך</SortableHeader>
                <SortableHeader column="daysSince">ימים</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    לא נמצאו הזמנות
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((order, idx) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{order.customerName}</TableCell>
                    <TableCell>
                      {order.phone && (
                        <a
                          href={`tel:${order.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                          dir="ltr"
                        >
                          {order.phone}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{order.city || '—'}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        orderId={order.id}
                        currentValue={order.orderStatus}
                        type="orderStatus"
                      />
                    </TableCell>
                    <TableCell className="text-sm">{order.openedBy || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.created
                        ? new Date(order.created).toLocaleDateString('he-IL')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const days = getDaysSinceCreated(order.created);
                        if (days === null) return '—';
                        return (
                          <span className={`text-xs font-semibold ${getDaysColor(days)}`}>
                            {days === 0 ? 'היום' : `${days} ימים`}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          מציג {sorted.length} מתוך {orders.length} הזמנות
        </p>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-2 md:hidden">
        {sorted.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">לא נמצאו הזמנות</p>
        ) : (
          sorted.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer p-3 hover:bg-muted/40 transition-colors"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{order.customerName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {order.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <a
                          href={`tel:${order.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary"
                          dir="ltr"
                        >
                          {order.phone}
                        </a>
                      </span>
                    )}
                    {order.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {order.city}
                      </span>
                    )}
                  </div>
                </div>
                <OrderStatusBadge status={order.orderStatus} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{order.openedBy || '—'}</span>
                <div className="flex items-center gap-2">
                  <span>
                    {order.created
                      ? new Date(order.created).toLocaleDateString('he-IL')
                      : ''}
                  </span>
                  {(() => {
                    const days = getDaysSinceCreated(order.created);
                    if (days === null) return null;
                    return (
                      <span className={`font-semibold ${getDaysColor(days)}`}>
                        {days === 0 ? 'היום' : `${days} ימים`}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </Card>
          ))
        )}
        <p className="text-center text-xs text-muted-foreground">
          מציג {sorted.length} מתוך {orders.length} הזמנות
        </p>
      </div>

      {/* Detail Dialog */}
      <OrderDetailDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}
