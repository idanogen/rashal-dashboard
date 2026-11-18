import type { DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import { quoteLine, whenLabel, WA_DOCK_OPEN_EVENT, type LastInbound } from '@/lib/customer-last-message';

const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };

const LINE = 'flex w-full items-start gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-start text-[11.5px] text-blue-950 '
  + 'hover:bg-blue-100';

/**
 * מה הלקוח כתב, על הכרטיס (עידן, 18/11/2026: "להנגיש את השיחות בכרטיס"). ציטוט, שעה,
 * נקודה כחולה כשלא נקרא. לחיצה פותחת את תיבת השיחות הצפה ישר על הלקוח, בלי לעזוב את המסך.
 */
export function withLastMessage(vm: DispatchItemVM, msg: LastInbound | undefined): DispatchItemVM {
  if (!msg) return vm;
  const open = () => {
    if (msg.phoneLocal) window.dispatchEvent(new CustomEvent(WA_DOCK_OPEN_EVENT, { detail: { phone: msg.phoneLocal } }));
  };
  const line = (
    <button
      type="button"
      onClick={(e) => { stop(e); open(); }}
      onPointerDown={stop}
      title="לפתיחת השיחה עם הלקוח"
      className={LINE}
    >
      {msg.unread && <span aria-label="לא נקרא" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words">💬 "{quoteLine(msg)}"</span>
        <bdi className="block text-[10.5px] text-blue-800/70">{whenLabel(msg.at)}</bdi>
      </span>
    </button>
  );
  return {
    ...vm,
    meta: (
      <>
        {vm.meta}
        <p className="mt-1">{line}</p>
      </>
    ),
  };
}
