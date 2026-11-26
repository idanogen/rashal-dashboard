import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pill } from '@/components/service-calls/FollowupPill';
import {
  buyStatusLabel,
  deskOf,
  followupTimeline,
  shortDate,
  shortDateTime,
  techLine,
  type CallFollowup,
} from '@/lib/call-followups';
import type { PartsAction } from '@/lib/call-followups-api';
import { cn } from '@/lib/utils';

interface Props {
  f: CallFollowup;
  today: string;
  busy: boolean;
  onAction: (action: PartsAction) => Promise<unknown>;
  onShowCall: () => void;
}

/**
 * בקשת רכש אחת בעמוד של אלכס (15/11/2026). משמאל מה צריך ולמי, מימין המצב
 * והפעולה הבאה: הוזמן עם צפי, הגיע, או לא ניתן להשיג (חוזר לעמי עם הערה).
 */
export function PartRequestCard({ f, today, busy, onAction, onShowCall }: Props) {
  const [eta, setEta] = useState(f.eta ?? '');
  const [po, setPo] = useState(f.poNumber ?? '');
  const [mode, setMode] = useState<'idle' | 'unavailable' | 'eta'>('idle');
  const [why, setWhy] = useState('');
  const st = buyStatusLabel(f, today);
  const run = (a: PartsAction) => onAction(a).then(() => setMode('idle')).catch(() => undefined);

  return (
    <div
      className={cn(
        'grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_260px]',
        f.status === 'open' && 'border-amber-200 shadow-[inset_-3px_0_0_theme(colors.amber.500)]',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-extrabold">{f.customerName}</span>
          <span className="text-xs text-muted-foreground">
            {[f.city, f.callDocno].filter(Boolean).map((x, i) => <bdi key={i}>{i ? ' · ' : ''}{x}</bdi>)}
          </span>
          <Pill tone={st.tone}>{f.status === 'open' ? 'חדש · לא הוזמן' : st.text}</Pill>
          {f.urgency === 'urgent' && f.status === 'open' && <Pill tone="red">דחוף</Pill>}
        </div>
        <p className="mt-2 text-[15px] font-bold leading-snug">{f.item}</p>
        {f.device && <p className="text-xs text-muted-foreground">{f.device}</p>}
        {f.note && <p className="mt-1 text-xs"><b>הערה מהמשרד:</b> {f.note}</p>}
        {f.techNote && (
          <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">{techLine(f)}</p>
        )}
        <button type="button" onClick={onShowCall} className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline">
          פרטי הקריאה ותמונות
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t pt-3 md:border-s md:border-t-0 md:ps-4 md:pt-0">
        {f.status === 'open' && mode !== 'unavailable' && (
          <>
            <p className="text-xs text-muted-foreground">נשלח ע"י {f.decidedByName ?? 'המשרד'} · <bdi>{shortDateTime(f.decidedAt)}</bdi></p>
            {/* בית מלאכה מתקן ולא מזמין: כפתור אחד שמחזיר לשיבוץ (עמי 25/11) */}
            {deskOf(f.kind) === 'workshop' && (
              <Button size="sm" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => run({ type: 'arrived' })}>
                תוקן, חוזר לשיבוץ
              </Button>
            )}
            <label className="text-xs font-semibold text-muted-foreground">צפי הגעה
              <Input type="date" value={eta} min={today} onChange={(e) => setEta(e.target.value)} className="mt-1 text-base sm:text-sm" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">מספר הזמנת רכש (לא חובה)
              <Input value={po} onChange={(e) => setPo(e.target.value)} dir="ltr" className="mt-1 text-base sm:text-sm" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => run({ type: 'ordered', eta: eta || null, poNumber: po || null })}>הוזמן</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('unavailable')}>לא ניתן להשיג</Button>
            </div>
          </>
        )}

        {f.status === 'ordered' && mode === 'idle' && (
          <>
            <p className="text-sm font-bold">
              {f.eta ? <>צפי <bdi>{shortDate(f.eta)}</bdi></> : 'הוזמן, בלי צפי'}
              {f.poNumber && <> · <bdi>{f.poNumber}</bdi></>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => run({ type: 'arrived' })}>
                הגיע
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('eta')}>שינוי צפי</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode('unavailable')}>לא ניתן להשיג</Button>
            </div>
          </>
        )}

        {mode === 'eta' && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-muted-foreground">צפי חדש
              <Input type="date" value={eta} min={today} onChange={(e) => setEta(e.target.value)} className="mt-1 text-base sm:text-sm" />
            </label>
            <Button size="sm" disabled={busy} onClick={() => run({ type: 'eta', eta: eta || null })}>שמירה</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>ביטול</Button>
          </div>
        )}

        {mode === 'unavailable' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">למה? (חוזר לעמי ואבירם)
              <Textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} className="mt-1 text-base sm:text-sm" />
            </label>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !why.trim()} onClick={() => run({ type: 'unavailable', note: why })}>החזרה למשרד</Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>ביטול</Button>
            </div>
          </div>
        )}

        {f.status !== 'open' && mode === 'idle' && (
          <ul className="space-y-0.5 text-[11.5px] text-muted-foreground">
            {followupTimeline(f).map((t) => (
              <li key={t.at + t.text} className="flex gap-2">
                <bdi className="w-[72px] shrink-0 tabular-nums">{shortDateTime(t.at)}</bdi>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
