import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useCallFollowupMutations } from '@/hooks/useCallFollowups';
import {
  FOLLOWUP_KINDS,
  KIND_HINT,
  KIND_LABEL,
  isBuy,
  prefillItem,
  validateDecision,
  type CallFollowup,
  type FollowupKind,
  type FollowupUrgency,
} from '@/lib/call-followups';
import { cn } from '@/lib/utils';

export interface DecisionTarget {
  stopId: string;
  customerName: string;
  city?: string;
  device?: string;
  techNote: string | null;
  current?: CallFollowup;
}

const SEND_LABEL: Record<FollowupKind, string> = {
  not_home: 'שמירה, נשאר לשיבוץ',
  revisit: 'שמירה, נשאר לשיבוץ',
  buy_warehouse: 'שליחה לאלכס מחסן',
  buy_workshop: 'שליחה לאלכס בית מלאכה',
};

/**
 * "מה עושים עם הקריאה?" (15/11/2026): עמי או אבירם מכריעים על ביקור שחזר,
 * בארבעת הסטטוסים של עמי. רכש מבקש "מה צריך" (ממולא מההערה של הטכנאי)
 * ודחיפות; השאר רק נשמרים. בלי כתיבה לפריוריטי.
 */
export function FollowupDecisionDialog({ target, onClose }: { target: DecisionTarget | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        {/* מפתח לפי הביקור: כל קריאה פותחת טופס נקי עם הערכים שלה, בלי איפוס ב-effect. */}
        {target && <DecisionForm key={target.stopId + (target.current?.updatedAt ?? '')} target={target} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DecisionForm({ target, onClose }: { target: DecisionTarget; onClose: () => void }) {
  const { decide } = useCallFollowupMutations();
  const cur = target.current;
  const [kind, setKind] = useState<FollowupKind | null>(cur && cur.status !== 'unavailable' ? cur.kind : null);
  const [item, setItem] = useState(cur?.item ?? prefillItem(target.techNote));
  const [urgency, setUrgency] = useState<FollowupUrgency>(cur?.urgency ?? 'normal');
  const [note, setNote] = useState(cur?.kind === 'revisit' ? (cur.note ?? '') : '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const err = validateDecision(kind, item);
    setError(err);
    if (err || !kind) return;
    try {
      await decide.mutateAsync({
        stopId: target.stopId,
        kind,
        item: isBuy(kind) ? item : null,
        urgency: isBuy(kind) ? urgency : 'normal',
        note: kind === 'revisit' || isBuy(kind) ? note : null,
      });
      onClose();
    } catch {
      // ההודעה כבר עלתה ב-toast מה-hook; החלון נשאר פתוח עם מה שהוקלד.
    }
  };

  const unavailable = cur?.status === 'unavailable' ? cur : null;

  return (
    <>
        <DialogHeader className="text-start">
          <DialogTitle>מה עושים עם הקריאה?</DialogTitle>
          <DialogDescription>
            {[target.customerName, target.city, target.device].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {target.techNote && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <b className="text-foreground">הטכנאי כתב:</b> {target.techNote}
          </p>
        )}
        {unavailable && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {unavailable.unavailableByName ?? 'אלכס'}: לא ניתן להשיג{unavailable.unavailableNote ? `. ${unavailable.unavailableNote}` : ''}
          </p>
        )}

        <div className="space-y-1.5" role="radiogroup" aria-label="מה עושים">
          {FOLLOWUP_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm',
                kind === k ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              )}
            >
              <input
                type="radio"
                name="followup-kind"
                checked={kind === k}
                onChange={() => { setKind(k); setError(null); }}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block font-semibold">{KIND_LABEL[k]}</span>
                <span className="block text-xs text-muted-foreground">{KIND_HINT[k]}</span>
              </span>
            </label>
          ))}
        </div>

        {kind && isBuy(kind) && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">מה צריך</label>
              <Textarea value={item} onChange={(e) => setItem(e.target.value)} rows={2} className="text-base sm:text-sm" />
              <p className="mt-1 text-[11px] text-muted-foreground">ממולא מההערה של הטכנאי, אפשר לתקן.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">דחיפות</label>
                <div className="flex gap-1.5">
                  {(['normal', 'urgent'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={cn(
                        'h-9 flex-1 rounded-md border text-sm',
                        urgency !== u && 'hover:bg-muted/50',
                        urgency === u && u === 'urgent' && 'border-red-300 bg-red-50 font-semibold text-red-700',
                        urgency === u && u === 'normal' && 'border-primary bg-primary/5 font-semibold',
                      )}
                    >
                      {u === 'urgent' ? 'דחוף' : 'רגיל'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">הערה לאלכס</label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="לא חובה" className="text-base sm:text-sm" />
              </div>
            </div>
          </div>
        )}
        {kind === 'revisit' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">מה חסר או לא מתאים</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="לא חובה" className="text-base sm:text-sm" />
          </div>
        )}

        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}

        <div className="flex justify-start gap-2">
          <Button onClick={submit} disabled={decide.isPending || !kind}>
            {kind ? SEND_LABEL[kind] : 'בחרו אפשרות'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={decide.isPending}>ביטול</Button>
        </div>
    </>
  );
}
