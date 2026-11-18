import type { DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import { canStartNudge, nudgeBlockedReason, nudgeLine, type MediaNudge } from '@/lib/media-nudge';

const NUDGE_BTN = 'inline-flex h-6 items-center rounded-md border border-amber-300 bg-amber-50 px-2 '
  + 'text-[11.5px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60';

/** הכפתור יושב בתוך כרטיס נגרר ונלחץ: לא לתת ללחיצה להגיע לגרירה או לבחירה. */
const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
const day = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Jerusalem' });

/**
 * "שלח תזכורת לתמונה" על כרטיס אדום (עידן, 18/11/2026). לחיצה = עד 3 הודעות,
 * יום אחרי יום ב-10:00, עד שהלקוח שולח תמונה. אחרי הלחיצה הכפתור מתחלף לשורת מצב.
 */
export function withNudgeFooter(
  vm: DispatchItemVM,
  isRed: boolean,
  nudge: MediaNudge | undefined,
  mediaState: string | undefined,
  busy: boolean,
  onStart: (callId: string) => void,
): DispatchItemVM {
  if (!isRed && !nudge) return vm;
  const blocked = nudgeBlockedReason(mediaState);
  const showButton = isRed && canStartNudge(nudge, mediaState);
  const extra = (
    <>
      {nudge && (
        <span
          className={nudge.state === 'failed' ? 'text-[11px] font-semibold text-red-700' : 'text-[11px] text-amber-800'}
          title={nudge.startedByName ? `התחיל: ${nudge.startedByName}` : undefined}
        >
          🔔 {nudgeLine(nudge, day)}
        </span>
      )}
      {showButton && (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => { stop(e); onStart(vm.id); }}
          onPointerDown={stop}
          className={NUDGE_BTN}
        >
          {busy ? 'שולח…' : nudge ? 'שלח שוב תזכורת לתמונה' : 'שלח תזכורת לתמונה'}
        </button>
      )}
      {isRed && !nudge && blocked && (
        <span
          className="inline-flex h-6 cursor-not-allowed items-center rounded-md bg-slate-100 px-2 text-[11.5px] text-slate-500"
          title={blocked}
        >
          אין למי לשלוח · {blocked}
        </span>
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
