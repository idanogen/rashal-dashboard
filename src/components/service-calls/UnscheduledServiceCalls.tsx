import { useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';

import { buildServiceCallItems } from '@/components/dispatch/items';
import { useMediaRequests } from '@/hooks/useMediaRequests';
import { useServiceCallLights } from '@/hooks/useServiceCallLights';
import {
  UnscheduledPanel,
  type HandledMatch,
  type VisitPrefill,
} from '@/components/dispatch/UnscheduledPanel';
import { ServiceTrafficLight } from '@/components/dispatch/ServiceTrafficLight';
import { ManualGreenDialog } from '@/components/service-calls/ManualGreenDialog';
import { StopCallInfoSheet } from '@/components/driver/StopCallInfoSheet';
import {
  compareByLight,
  countLights,
  isOldRed,
  type ServiceLight,
} from '@/lib/service-call-light';
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
  // ⭐ רמזור קריאות השירות (עידן, 15/09/2026). כשהוא לא נטען המסך נראה כמו קודם.
  const { data: lights } = useServiceCallLights();
  const [greenCall, setGreenCall] = useState<ServiceCall | null>(null);
  // מה שהלקוח שלח: אותו גיליון של עמוד הנהג, לפי קריאה (15/09/2026).
  const [mediaCall, setMediaCall] = useState<ServiceCall | null>(null);
  const [selectedLights, setSelectedLights] = useState<Set<ServiceLight>>(new Set());
  const [showOldRed, setShowOldRed] = useState(false);

  const items = useMemo(() => {
    const built = buildServiceCallItems(calls, callZoneMap, groupSize, mediaStates, lights, setGreenCall, setMediaCall);
    if (!lights) return built;
    return built
      .filter((vm) => {
        const l = lights.get(vm.id);
        if (!l) return selectedLights.size === 0;
        if (selectedLights.size > 0 && !selectedLights.has(l.light)) return false;
        // ותיקות משבועיים מקופלות בתוך האדום עד שמבקשים (החלטת עידן).
        if (!showOldRed && isOldRed(l)) return false;
        return true;
      })
      .sort((a, b) => compareByLight(lights.get(a.id), lights.get(b.id)));
  }, [calls, callZoneMap, groupSize, mediaStates, lights, selectedLights, showOldRed]);

  const counts = useMemo(() => {
    if (!lights) return null;
    const ids = new Set(calls.map((c) => c.id));
    return countLights([...lights.values()].filter((l) => ids.has(l.serviceCallId)));
  }, [lights, calls]);

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

  const toggleLight = (light: ServiceLight) =>
    setSelectedLights((prev) => {
      const next = new Set(prev);
      if (next.has(light)) next.delete(light);
      else next.add(light);
      return next;
    });

  return (
    <>
      <UnscheduledPanel
        items={items}
        title="קריאות שירות"
        Icon={Wrench}
        accentBorder="border-s-orange-500"
        noun={{ one: 'קריאה', many: 'קריאות' }}
        emptyText={selectedLights.size > 0 ? 'אין קריאות בצבע שנבחר' : 'אין קריאות שירות חדשות'}
        searchPlaceholder="חיפוש: שם / מספר לקוח / טלפון"
        storageKey="calls"
        countByZone={lights ? undefined : callCountByZone}
        selectedIds={selectedCallIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        onBulkSchedule={onBulkSchedule}
        pendingScheduleIds={pendingScheduleIds}
        // ⭐ "חזרו מהקו" מתחבר לשאר הקריאות (עידן, 15/09/2026): הצבע והתג
        // "נהג כבר נגע" אומרים מה קרה, ולא רצועה נפרדת. בלי רמזור, כמו קודם.
        returnedIds={lights ? undefined : returnedIds}
        returnedInfo={lights ? undefined : returnedInfo}
        handled={handled}
        onScheduleVisit={onScheduleVisit}
        search={search}
        selectedZones={selectedZones}
        intro={
          counts ? (
            <ServiceTrafficLight
              counts={counts}
              selected={selectedLights}
              onToggle={toggleLight}
              showOldRed={showOldRed}
              onToggleOldRed={() => setShowOldRed((v) => !v)}
            />
          ) : undefined
        }
      />
      <ManualGreenDialog call={greenCall} onClose={() => setGreenCall(null)} />
      <StopCallInfoSheet
        call={mediaCall ?? undefined}
        open={!!mediaCall}
        onOpenChange={(o) => {
          if (!o) setMediaCall(null);
        }}
      />
    </>
  );
}
