import { useState } from 'react';
import { AlertCircle, ClipboardCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { countSince, isUnmatchedCrane, type FieldInspection } from '@/lib/field-inspections';
import { VERDICT_LABELS, type CraneVerdict } from '@/lib/crane-checklist';

interface RecentFieldInspectionsProps {
  list: FieldInspection[];
  knownSerials: Set<string>;
  isLoading: boolean;
  error: Error | null;
  /** רגע הטעינה האחרונה (`dataUpdatedAt`): "היום" ו"7 ימים" נספרים ממנו, לא משעון בזמן רינדור. */
  asOf: number;
}

const COLLAPSED = 6;

/**
 * הבדיקות שהטכנאים מילאו באפליקציה, החדשה למעלה (עמי, 16/11/2026: "לא רואה
 * שמישהו בכלל מילא בדיקת מנופים"). נקודת הכניסה של המנהל: מי בדק, איפה ומתי.
 */
export function RecentFieldInspections({ list, knownSerials, isLoading, error, asOf }: RecentFieldInspectionsProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? list : list.slice(0, COLLAPSED);
  const today = countSince(list, new Date(new Date(asOf).setHours(0, 0, 0, 0)).toISOString());
  const week = countSince(list, new Date(asOf - 7 * 86_400_000).toISOString());

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          בדיקות טכנאים מהשטח
        </h2>
        {!isLoading && !error && (
          <p className="text-xs text-muted-foreground">
            היום <span className="font-semibold text-foreground tabular-nums">{today}</span>
            {' · '}7 ימים אחרונים <span className="font-semibold text-foreground tabular-nums">{week}</span>
            {' · '}סה"כ <span className="tabular-nums">{list.length}</span>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען בדיקות…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          שגיאה בטעינת הבדיקות: {error.message}
        </div>
      ) : list.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">עוד לא מולאה בדיקה באפליקציה</div>
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((f) => (
              <FieldInspectionLine key={f.id} f={f} unmatched={isUnmatchedCrane(f, knownSerials)} />
            ))}
          </ul>
          {list.length > COLLAPSED && (
            <div className="border-t px-4 py-2">
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'הצג פחות' : `הצג את כל ${list.length} הבדיקות`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function FieldInspectionLine({ f, unmatched, compact }: { f: FieldInspection; unmatched?: boolean; compact?: boolean }) {
  const failed = f.verdict === 'out_of_service';
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
      <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{fmtDateTime(f.submittedAt)}</span>
      {!compact && (
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          {f.formType === 'chair_inspection' ? 'כיסא ממונע' : 'מנוף'}
        </Badge>
      )}
      <span className="font-medium">{f.technician || 'טכנאי לא ידוע'}</span>
      {!compact && <span className="min-w-0 truncate">{f.customerName || '—'}</span>}
      {!compact && f.craneSerial && (
        <bdi className="font-mono text-xs text-muted-foreground">{f.craneSerial}</bdi>
      )}
      {unmatched && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
          {f.craneSerial ? 'המספר לא במאגר המנופים' : 'בלי מספר מנוף'}
        </span>
      )}
      <span className={failed ? 'ms-auto font-semibold text-red-600' : 'ms-auto text-xs text-muted-foreground'}>
        {verdictLabel(f.verdict)}
      </span>
      {f.notes && <span className="basis-full ps-[7.75rem] text-xs text-muted-foreground">הערות: {f.notes}</span>}
    </li>
  );
}

function verdictLabel(v: string | null): string {
  if (!v) return 'בלי סיכום';
  return VERDICT_LABELS[v as CraneVerdict] ?? v;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}
