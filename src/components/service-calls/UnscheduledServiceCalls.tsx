import { useMemo } from 'react';
import { Wrench } from 'lucide-react';

import { buildServiceCallItems } from '@/components/dispatch/items';
import { useMediaRequests } from '@/hooks/useMediaRequests';
import {
  UnscheduledPanel,
  type HandledMatch,
  type VisitPrefill,
} from '@/components/dispatch/UnscheduledPanel';
import type { ServiceCall } from '@/types/service-call';
import type { ReturnedInfo } from '@/lib/returned-from-route';

interface UnscheduledServiceCallsProps {
  calls: ServiceCall[];
  callCountByZone: Map<string, number>;
  callZoneMap: Map<string, string>;
  groupSize?: Map<string, number>;
  // Selection props
  selectedCallIds?: Set<string>;
  onToggleSelect?: (callId: string) => void;
  onSelectAll?: (callIds: string[]) => void;
  onBulkSchedule?: () => void;
  onClearSelection?: () => void;
  /** קריאות שמחכות לבחירת נהג — opacity מופחת */
  pendingScheduleIds?: Set<string>;
  /** callIds that came back from the route (a not_completed stop exists). */
  returnedIds?: Set<string>;
  /** ישות ⟵ הסיבה שהנהג רשם. עובר יחד עם returnedIds ולא בנפרד. */
  returnedInfo?: Map<string, ReturnedInfo>;
  /** קריאות שכבר טופלו (תואם ביקור / בוצע) — לחיווי "כבר משובץ" כשחיפוש ריק בממתינים. */
  handledCalls?: ServiceCall[];
  /** מזהה קריאה ⟵ "משובץ ל-01/09 · אולג", כשקיימת עצירה פעילה ביומן. */
  handledStopLines?: Map<string, string>;
  /** שיבוץ יזום מהמבוי הסתום של החיפוש — ראה UnscheduledPanel. */
  onScheduleVisit?: (prefill: VisitPrefill) => void;
  /** חיפוש ואזורים משותפים למסך הסדרן. כשמועברים, הפאנל לא מצייר אותם בעצמו. */
  search?: string;
  selectedZones?: string[];
}

export function UnscheduledServiceCalls({
  calls,
  callCountByZone,
  callZoneMap,
  groupSize,
  selectedCallIds,
  onToggleSelect,
  onSelectAll,
  onBulkSchedule,
  onClearSelection,
  pendingScheduleIds,
  returnedIds,
  returnedInfo,
  handledCalls,
  handledStopLines,
  onScheduleVisit,
  search,
  selectedZones,
}: UnscheduledServiceCallsProps) {
  const { data: mediaStates } = useMediaRequests();
  const items = useMemo(
    () => buildServiceCallItems(calls, callZoneMap, groupSize, mediaStates),
    [calls, callZoneMap, groupSize, mediaStates]
  );

  const handled = useMemo<HandledMatch[]>(
    () =>
      (handledCalls ?? []).map((c) => ({
        id: c.id,
        customerName: c.customerName,
        customerNumber: c.customerNumber,
        status: c.serviceCallStatus,
        phone: c.phone,
        address: c.address,
        city: c.city,
        scheduledLine: handledStopLines?.get(c.id),
      })),
    [handledCalls, handledStopLines]
  );

  return (
    <UnscheduledPanel
      items={items}
      title="קריאות שירות חדשות"
      Icon={Wrench}
      accentBorder="border-s-orange-500"
      noun={{ one: 'קריאה', many: 'קריאות' }}
      emptyText="אין קריאות שירות חדשות"
      searchPlaceholder="חיפוש: שם / מספר לקוח / טלפון"
      storageKey="calls"
      countByZone={callCountByZone}
      selectedIds={selectedCallIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
      onBulkSchedule={onBulkSchedule}
      pendingScheduleIds={pendingScheduleIds}
      returnedIds={returnedIds}
      returnedInfo={returnedInfo}
      handled={handled}
      onScheduleVisit={onScheduleVisit}
      search={search}
      selectedZones={selectedZones}
    />
  );
}
