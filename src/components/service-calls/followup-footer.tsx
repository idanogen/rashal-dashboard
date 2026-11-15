import type { DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import type { ReturnedInfo } from '@/lib/returned-from-route';
import { KIND_TAG, needsDecision, type CallFollowup } from '@/lib/call-followups';
import { Pill } from '@/components/service-calls/FollowupPill';
import type { DecisionTarget } from '@/components/service-calls/FollowupDecisionDialog';

const KIND_TONE = { not_home: 'slate', revisit: 'blue', buy_warehouse: 'violet', buy_workshop: 'violet' } as const;

/** הכפתור יושב בתוך כרטיס נגרר ונלחץ: לא לתת ללחיצה להגיע לגרירה או לבחירה. */
const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };

/**
 * מוסיף לכרטיס הקריאה את מצב ההכרעה (15/11/2026): כפתור "מה עושים?" על ביקור
 * שחזר ועוד לא הוכרע (או שאלכס החזיר "לא ניתן להשיג"), ותג ההכרעה כשיש.
 */
export function withFollowupFooter(
  vm: DispatchItemVM,
  f: CallFollowup | undefined,
  returned: ReturnedInfo | undefined,
  onDecide: (t: DecisionTarget) => void,
): DispatchItemVM {
  if (!f && !returned) return vm;
  const ask = needsDecision(f) && (returned || f);
  const target: DecisionTarget | null = returned
    ? { stopId: returned.stopId, customerName: vm.customerName, techNote: returned.note, current: f }
    : f
      ? { stopId: f.stopId, customerName: vm.customerName, city: f.city ?? undefined, device: f.device ?? undefined, techNote: f.techNote, current: f }
      : null;

  const extra = (
    <>
      {f && f.status === 'unavailable' && (
        <Pill tone="red" title={f.unavailableNote ?? undefined}>לא ניתן להשיג{f.unavailableNote ? `: ${f.unavailableNote}` : ''}</Pill>
      )}
      {f && !needsDecision(f) && (
        <Pill tone={KIND_TONE[f.kind]} title={f.note ?? undefined}>
          {KIND_TAG[f.kind]}{f.note && f.kind === 'revisit' ? `: ${f.note}` : ''}
        </Pill>
      )}
      {ask && target && (
        <button
          type="button"
          onClick={(e) => { stop(e); onDecide(target); }}
          onPointerDown={stop}
          className="inline-flex h-6 items-center rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          מה עושים?
        </button>
      )}
      {f && !needsDecision(f) && target && (
        <button
          type="button"
          onClick={(e) => { stop(e); onDecide(target); }}
          onPointerDown={stop}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          שינוי
        </button>
      )}
    </>
  );
  return {
    ...vm,
    footerBadges: (
      <>
        {vm.footerBadges}
        {extra}
      </>
    ),
  };
}
