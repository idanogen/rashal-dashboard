import { useMemo, useState, type ReactNode } from 'react';
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
import { useCallsWithDoc } from '@/hooks/useStopCallInfo';
import {
  compareByLight,
  countLights,
  isOldRed,
  type ServiceLight,
} from '@/lib/service-call-light';
import type { ServiceCall } from '@/types/service-call';
import type { ReturnedInfo } from '@/lib/returned-from-route';
import { useCallFollowups } from '@/hooks/useCallFollowups';
import { activeByCall, dispatchPlace } from '@/lib/call-followups';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { FollowupDecisionDialog, type DecisionTarget } from '@/components/service-calls/FollowupDecisionDialog';
import { ArrivedStrip, BuyingStrip, type FollowupItem } from '@/components/service-calls/FollowupStrips';
import { withFollowupFooter } from '@/components/service-calls/followup-footer';
import { withNudgeFooter } from '@/components/service-calls/nudge-footer';
import { useMediaNudges, useStartMediaNudge } from '@/hooks/useMediaNudges';
import { toast } from 'sonner';

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
  /** צ'יפי הקופות (04/11/2026): מצוירים ליד הרמזור, המצב חי בדף כי הסינון חל על כל המסך. */
  fundFilter?: ReactNode;
}

export function UnscheduledServiceCalls({
  calls,
  fundFilter,
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
  // חיווי "יש טופס קריאה" מהמייל (עידן, 19/10/2026: "שיהיה חיווי לקובץ").
  const { data: docsByCall } = useCallsWithDoc(calls.map((c) => c.id));
  const [greenCall, setGreenCall] = useState<ServiceCall | null>(null);
  // מה שהלקוח שלח: אותו גיליון של עמוד הנהג, לפי קריאה (15/09/2026).
  const [mediaCall, setMediaCall] = useState<ServiceCall | null>(null);
  const [selectedLights, setSelectedLights] = useState<Set<ServiceLight>>(new Set());
  const [showOldRed, setShowOldRed] = useState(false);
  // ⭐ קריאות שחזרו מהקו: הכרעה של עמי ואבירם ורכש אצל אלכס (15/11/2026).
  const { data: followups } = useCallFollowups();
  const [decision, setDecision] = useState<DecisionTarget | null>(null);
  const active = useMemo(() => activeByCall(followups ?? []), [followups]);
  const today = toLocalDateStr(new Date());
  // ⭐ "שלח תזכורת לתמונה" על כרטיס אדום (עידן, 18/11/2026).
  const { data: nudges } = useMediaNudges();
  const startNudge = useStartMediaNudge();

  const onStartNudge = (callId: string) =>
    startNudge.mutate(callId, {
      onSuccess: () =>
        toast.success('התזכורת לתמונה יוצאת ללקוח בדקות הקרובות, ואחריה עוד שתיים אם לא תגיע תמונה'),
      onError: (e) => toast.error('התזכורת לא נשלחה', { description: e instanceof Error ? e.message : undefined }),
    });

  const { items, buying, arrived } = useMemo(() => {
    const docIds = docsByCall ? new Set(Object.keys(docsByCall)) : undefined;
    const raw = buildServiceCallItems(calls, callZoneMap, groupSize, mediaStates, lights, setGreenCall, setMediaCall, docIds);
    // רכש פתוח יוצא מהרשימה לרצועה של אלכס, וחלק שהגיע עולה לרצועה הירוקה למעלה.
    const buying: FollowupItem[] = [];
    const arrived: FollowupItem[] = [];
    const built = raw.flatMap((vm) => {
      const f = active.get(vm.id);
      const place = dispatchPlace(f);
      if (f && place === 'buying') { buying.push({ f, vm }); return []; }
      if (f && place === 'arrived') { arrived.push({ f, vm }); return []; }
      const withF = withFollowupFooter(vm, f, returnedInfo?.get(vm.id), setDecision);
      return [withNudgeFooter(withF, lights?.get(vm.id)?.light === 'red', nudges?.get(vm.id), mediaStates?.get(vm.id)?.state,
        startNudge.isPending && startNudge.variables === vm.id, onStartNudge)];
    });
    const out = { buying, arrived };
    if (!lights) return { ...out, items: built };
    const kept = built
      .filter((vm) => {
        const l = lights.get(vm.id);
        if (!l) return selectedLights.size === 0;
        if (selectedLights.size > 0 && !selectedLights.has(l.light)) return false;
        // ותיקות משבועיים מקופלות בתוך האדום עד שמבקשים (החלטת עידן).
        if (!showOldRed && isOldRed(l)) return false;
        return true;
      })
      .sort((a, b) => compareByLight(lights.get(a.id), lights.get(b.id)));
    return { ...out, items: kept };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onStartNudge נשען על startNudge.mutate שיציב
  }, [
    calls, callZoneMap, groupSize, mediaStates, lights, docsByCall, selectedLights, showOldRed, active, returnedInfo,
    nudges, startNudge.isPending, startNudge.variables,
  ]);

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
          counts || fundFilter || buying.length > 0 || arrived.length > 0 ? (
            <div className="space-y-3">
              <ArrivedStrip items={arrived} accentBorder="border-s-orange-500" selectedIds={selectedCallIds} onToggleSelect={onToggleSelect} />
              {fundFilter}
              {counts && (
                <ServiceTrafficLight
                  counts={counts}
                  selected={selectedLights}
                  onToggle={toggleLight}
                  showOldRed={showOldRed}
                  onToggleOldRed={() => setShowOldRed((v) => !v)}
                />
              )}
              <BuyingStrip items={buying} today={today} />
            </div>
          ) : undefined
        }
      />
      <ManualGreenDialog call={greenCall} onClose={() => setGreenCall(null)} />
      <FollowupDecisionDialog target={decision} onClose={() => setDecision(null)} />
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
