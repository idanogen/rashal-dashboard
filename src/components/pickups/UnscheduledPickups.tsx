import { useMemo } from 'react';
import { Undo2 } from 'lucide-react';

import { UnscheduledPanel, type DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import { Badge } from '@/components/ui/badge';
import type { Pickup } from '@/types/pickup';
import { getZoneForCity } from '@/types/zone';

interface UnscheduledPickupsProps {
  pickups: Pickup[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkSchedule: () => void;
  pendingScheduleIds: Set<string>;
  /** איסופים שחזרו מהקו (סטטוס עצירה "לא בוצע"). */
  returnedIds?: Set<string>;
  onShowDetails: (pickup: Pickup) => void;
}

export function UnscheduledPickups({
  pickups,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  pendingScheduleIds,
  returnedIds,
  onShowDetails,
}: UnscheduledPickupsProps) {
  const items = useMemo<DispatchItemVM[]>(
    () =>
      pickups.map((pickup) => {
        const lineCount = pickup.lines?.length ?? 0;
        return {
          id: pickup.id,
          dragId: pickup.id,
          dragData: { type: 'pickup', pickup },
          zoneId: getZoneForCity(pickup.city) || 'unassigned',
          customerName: pickup.customerName,
          customerNumber: pickup.customerNumber,
          phone: pickup.phone,
          addressLine: `${pickup.address ?? ''}${pickup.city ? `, ${pickup.city}` : ''}`.replace(
            /^, /,
            ''
          ),
          created: pickup.created,
          searchText: [
            pickup.customerName,
            pickup.customerNumber,
            pickup.city,
            pickup.priorityPickupId,
            pickup.phone,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          meta: pickup.priorityPickupId ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
              מסמך: {pickup.priorityPickupId}
            </p>
          ) : undefined,
          footerBadges: (
            <>
              {pickup.priorityStatus && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  {pickup.priorityStatus}
                </Badge>
              )}
              {lineCount > 0 && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  {lineCount} פריטים
                </Badge>
              )}
            </>
          ),
          onShowDetails: () => onShowDetails(pickup),
          history: {
            currentId: pickup.id,
            customerNumber: pickup.customerNumber,
            customerName: pickup.customerName,
          },
        };
      }),
    [pickups, onShowDetails]
  );

  return (
    <UnscheduledPanel
      items={items}
      title="איסופים ממתינים"
      Icon={Undo2}
      accentBorder="border-s-teal-500"
      noun={{ one: 'איסוף', many: 'איסופים' }}
      emptyText="אין איסופים ממתינים"
      searchPlaceholder="חיפוש: שם / מספר לקוח / מסמך / עיר"
      storageKey="pickups"
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
      onBulkSchedule={onBulkSchedule}
      pendingScheduleIds={pendingScheduleIds}
      returnedIds={returnedIds}
    />
  );
}
