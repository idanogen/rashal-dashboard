import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { PartRequestCard } from '@/components/parts/PartRequestCard';
import { StopCallInfoSheet } from '@/components/driver/StopCallInfoSheet';
import { useCallFollowupMutations, useCallFollowups, useMyDesks } from '@/hooks/useCallFollowups';
import { DESK_LABEL, partsList, type CallFollowup, type FollowupDesk, type PartsTab } from '@/lib/call-followups';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { cn } from '@/lib/utils';
import type { ServiceCall } from '@/types/service-call';

/**
 * רכש לקריאות שירות (15/11/2026): העמוד של אלכס מחסן ואלכס בית מלאכה.
 *
 * טענה: "יש לך N חלקים להזמין, וכל מה שהזמנת מחכה לסימון הגעה". הבקשות
 * מגיעות מעמי ואבירם (כפתור "מה עושים?" על קריאה שחזרה מהקו). "הגיע" מחזיר
 * את הקריאה לראש מסך הקריאות לשיבוץ. בלי כתיבה לפריוריטי.
 *
 * מי רואה מה: מי שרשום על שולחן (`call_followup_desks`) נכנס ישר לשלו; מי
 * שלא רשום (מנהלים, ועד שעמי אומר מי מהאלכסים הוא מה) עובר בין השניים.
 * מסך משותף: מתרענן בחזרה לחלון וכל דקה, ומראה מתי עודכן.
 */
export function PartsPage() {
  const query = useCallFollowups();
  const myDesks = useMyDesks();
  const { act } = useCallFollowupMutations();
  const [pickedDesk, setDesk] = useState<FollowupDesk>('warehouse');
  const [tab, setTab] = useState<PartsTab>('open');
  const [callOf, setCallOf] = useState<CallFollowup | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const today = toLocalDateStr(new Date());

  // מי שרשום על שולחן אחד נכנס ישר אליו; השאר בוחרים במתג.
  const desk: FollowupDesk = myDesks.length === 1 ? myDesks[0] : pickedDesk;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => query.data ?? [], [query.data]);
  const list = useMemo(() => partsList(all, desk, tab, today), [all, desk, tab, today]);
  const count = (d: FollowupDesk, t: PartsTab) => partsList(all, d, t, today).length;
  const fixedDesk = myDesks.length === 1;
  const updated = query.dataUpdatedAt ? Math.max(0, Math.round((now - query.dataUpdatedAt) / 60_000)) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart className="h-5 w-5 text-violet-700" />
            רכש לקריאות שירות{fixedDesk ? ` · ${DESK_LABEL[desk]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            מה שעמי ואבירם שלחו. כשהחלק מגיע, לוחצים "הגיע" והקריאה חוזרת אליהם לשיבוץ.
          </p>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {query.isFetching ? 'מתעדכן…' : updated === null ? '' : updated < 1 ? 'עודכן עכשיו' : `עודכן לפני ${updated} דק'`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!fixedDesk && (
          <div className="inline-flex overflow-hidden rounded-lg border" role="tablist" aria-label="שולחן רכש">
            {(['warehouse', 'workshop'] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={desk === d}
                onClick={() => setDesk(d)}
                className={cn(
                  'px-3.5 py-1.5 text-sm font-semibold',
                  desk === d ? 'bg-violet-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                אלכס {DESK_LABEL[d]} ({count(d, 'open')})
              </button>
            ))}
          </div>
        )}
        <div className="inline-flex overflow-hidden rounded-lg border" role="tablist" aria-label="סינון">
          {([['open', 'פתוחות'], ['arrived', 'הגיעו השבוע'], ['all', 'הכל']] as const).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'border-s px-3.5 py-1.5 text-sm font-semibold first:border-s-0',
                tab === t ? 'bg-muted text-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60',
              )}
            >
              {label}{t !== 'all' ? ` (${count(desk, t)})` : ''}
            </button>
          ))}
        </div>
      </div>

      {query.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          לא הצלחנו לטעון את הבקשות. {query.error instanceof Error ? query.error.message : ''}
        </div>
      )}
      {query.isLoading && <div className="h-32 animate-pulse rounded-xl bg-muted" />}
      {!query.isLoading && !query.isError && list.length === 0 && (
        <div className="rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          {tab === 'open' ? `אין בקשות פתוחות לאלכס ${DESK_LABEL[desk]}.` : 'אין כאן כלום עדיין.'}
        </div>
      )}

      <div className="space-y-3">
        {list.map((f) => (
          <PartRequestCard
            key={f.id + f.updatedAt}
            f={f}
            today={today}
            busy={act.isPending}
            onAction={(action) => act.mutateAsync({ id: f.id, action })}
            onShowCall={() => setCallOf(f)}
          />
        ))}
      </div>

      <StopCallInfoSheet
        call={callOf?.serviceCallId ? asCall(callOf) : undefined}
        open={!!callOf?.serviceCallId}
        onOpenChange={(o) => { if (!o) setCallOf(null); }}
      />
    </div>
  );
}

/** הגיליון של כרטיס הקריאה צריך רק את המזהה והשם; השאר נטען מהמסד לפי המזהה. */
function asCall(f: CallFollowup): ServiceCall {
  return {
    id: f.serviceCallId ?? '',
    customerName: f.customerName ?? '',
    customerNumber: f.customerNumber ?? undefined,
    city: f.city ?? undefined,
    created: '',
  } as ServiceCall;
}
