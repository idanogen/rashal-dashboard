import { useMemo } from 'react';
import { Wrench } from 'lucide-react';

import { ServiceCallDetailDialog } from '@/components/service-calls/ServiceCallDetailDialog';
import {
  UnscheduledPanel,
  type DispatchItemVM,
  type HandledMatch,
} from '@/components/dispatch/UnscheduledPanel';
import type { ServiceCall } from '@/types/service-call';

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
  /** קריאות שכבר טופלו (תואם ביקור / בוצע) — לחיווי "כבר משובץ" כשחיפוש ריק בממתינים. */
  handledCalls?: ServiceCall[];
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
  handledCalls,
}: UnscheduledServiceCallsProps) {
  const items = useMemo<DispatchItemVM[]>(
    () =>
      calls.map((call) => ({
        id: call.id,
        dragId: `servicecall-${call.id}`,
        dragData: { type: 'serviceCall', call },
        zoneId: callZoneMap.get(call.id) || 'unassigned',
        customerName: call.customerName,
        customerNumber: call.customerNumber,
        phone: call.phone,
        addressLine: call.city,
        created: call.created,
        dupCount: groupSize?.get(call.id),
        searchText: [call.customerName, call.customerNumber, call.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        meta: (
          <>
            {(call.faultDesc || call.symptomDesc) && (
              <p className="mt-0.5 text-[11px] font-medium text-amber-800">
                תקלה: {call.faultDesc ?? call.symptomDesc}
                {call.faultDesc && call.symptomDesc ? ` · ${call.symptomDesc}` : ''}
              </p>
            )}
            {(call.deviceName || call.deviceSerial) && (
              <p
                className="mt-0.5 text-[11px] text-muted-foreground"
                title={call.deviceDesc ?? undefined}
              >
                מכשיר: <bdi>{call.deviceName ?? '—'}</bdi>
                {call.deviceSerial && (
                  <>
                    {' '}
                    · סריאלי <bdi>{call.deviceSerial}</bdi>
                  </>
                )}
              </p>
            )}
          </>
        ),
        renderDetail: (open, onClose) => (
          <ServiceCallDetailDialog call={call} open={open} onClose={onClose} />
        ),
        history: {
          currentId: call.id,
          customerNumber: call.customerNumber,
          customerName: call.customerName,
        },
      })),
    [calls, callZoneMap, groupSize]
  );

  const handled = useMemo<HandledMatch[]>(
    () =>
      (handledCalls ?? []).map((c) => ({
        id: c.id,
        customerName: c.customerName,
        customerNumber: c.customerNumber,
        status: c.serviceCallStatus,
      })),
    [handledCalls]
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
      handled={handled}
    />
  );
}
