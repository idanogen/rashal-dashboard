import { useMemo } from 'react';
import { useZoneCenters } from '@/hooks/useZoneCenters';
import { Undo2 } from 'lucide-react';

import { buildPickupItems } from '@/components/dispatch/items';
import { UnscheduledPanel } from '@/components/dispatch/UnscheduledPanel';
import type { Pickup } from '@/types/pickup';
import type { ReturnedInfo } from '@/lib/returned-from-route';

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
  /** ישות ⟵ הסיבה שהנהג רשם. עובר יחד עם returnedIds ולא בנפרד. */
  returnedInfo?: Map<string, ReturnedInfo>;
  onShowDetails: (pickup: Pickup) => void;
  /** חיפוש ואזורים משותפים למסך הסדרן. כשמועברים, הפאנל לא מצייר אותם בעצמו. */
  search?: string;
  selectedZones?: string[];
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
  returnedInfo,
  onShowDetails,
  search,
  selectedZones,
}: UnscheduledPickupsProps) {
  const centers = useZoneCenters(pickups.map((p) => p.city));
  const items = useMemo(
    () => buildPickupItems(pickups, onShowDetails),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- centers: אזור ליישוב שלא ברשימה
    [pickups, onShowDetails, centers]
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
      returnedInfo={returnedInfo}
      search={search}
      selectedZones={selectedZones}
    />
  );
}
