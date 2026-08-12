import { useMemo, useState } from 'react';
import { Sparkles, UserPlus } from 'lucide-react';

import { UnscheduledPanel, type DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NewCustomer } from '@/types/customer';
import { isBareCustomer } from '@/types/customer';
import { getZoneForCity } from '@/types/zone';

interface UnscheduledCustomersProps {
  customers: NewCustomer[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkSchedule: () => void;
  pendingScheduleIds: Set<string>;
}

export function UnscheduledCustomers({
  customers,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  pendingScheduleIds,
}: UnscheduledCustomersProps) {
  /**
   * ברירת המחדל היא להציג רק לקוחות בלי שום רשומה נלווית. אלה האספקות
   * שאף מסך אחר לא מראה. מי שכבר יש לו הזמנה או קריאה נמצא ממילא בטאב שלו,
   * והצגתו כאן רק תכפיל אותו לסדרן.
   */
  const [onlyBare, setOnlyBare] = useState(true);

  const scoped = useMemo(
    () => (onlyBare ? customers.filter(isBareCustomer) : customers),
    [customers, onlyBare]
  );

  const bareCount = useMemo(() => customers.filter(isBareCustomer).length, [customers]);

  const items = useMemo<DispatchItemVM[]>(
    () =>
      scoped.map((customer) => ({
        id: customer.customerNumber,
        dragId: customer.customerNumber,
        dragData: { type: 'customer', customer },
        zoneId: getZoneForCity(customer.city) || 'unassigned',
        customerName: customer.customerName,
        customerNumber: customer.customerNumber,
        phone: customer.phone,
        addressLine: `${customer.address ?? ''}${customer.city ? `, ${customer.city}` : ''}`.replace(
          /^, /,
          ''
        ),
        created: customer.openedAt,
        searchText: [
          customer.customerName,
          customer.customerNumber,
          customer.city,
          customer.phone,
          customer.address,
          customer.openedBy,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        nameBadge: isBareCustomer(customer) ? (
          <span className="ms-1 inline-flex h-4 items-center rounded bg-violet-600 px-1 text-[10px] font-semibold text-white">
            ללא הזמנה
          </span>
        ) : undefined,
        footerBadges: (
          <>
            {customer.healthFund && (
              <Badge variant="outline" className="h-4 max-w-[140px] truncate px-1 text-[10px]">
                {customer.healthFund}
              </Badge>
            )}
            {customer.hasOrder && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                יש הזמנה
              </Badge>
            )}
            {customer.hasServiceCall && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                יש קריאה
              </Badge>
            )}
            {customer.hasPickup && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                יש איסוף
              </Badge>
            )}
            {customer.openedBy && (
              <span className="text-[10px] text-muted-foreground">
                נפתח ע"י {customer.openedBy}
              </span>
            )}
          </>
        ),
        history: {
          currentId: customer.customerNumber,
          customerNumber: customer.customerNumber,
          customerName: customer.customerName,
        },
      })),
    [scoped]
  );

  return (
    <UnscheduledPanel
      items={items}
      title="לקוחות חדשים"
      Icon={UserPlus}
      accentBorder="border-s-violet-500"
      noun={{ one: 'אספקה', many: 'אספקות' }}
      emptyText="אין לקוחות חדשים ממתינים"
      searchPlaceholder="חיפוש: שם / מספר לקוח / טלפון / עיר"
      storageKey="customers"
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
      onBulkSchedule={onBulkSchedule}
      pendingScheduleIds={pendingScheduleIds}
      intro={
        // למה המסך הזה קיים — הסדרן לא ראה את הלקוחות האלה עד היום
        <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-2.5 text-xs text-violet-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
          <span>
            לקוח חדש שנפתח בפריוריטי הוא ברוב המקרים אספקה שממתינה, גם כשעוד לא נפתחה לו הזמנה.
            כרגע יש <strong>{bareCount}</strong> לקוחות כאלה בלי שום רשומה נלווית.
          </span>
        </div>
      }
      toolbarExtra={
        <Button
          variant={onlyBare ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setOnlyBare((v) => !v)}
        >
          {onlyBare ? 'רק ללא הזמנה' : 'כל הלקוחות החדשים'}
        </Button>
      }
    />
  );
}
