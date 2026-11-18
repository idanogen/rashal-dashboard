import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { matchesArchiveSearch } from '@/lib/calls-archive-rules';

const SHOWN = 200;

/** שורת ארכיון: אותם שדות לקריאה ולהזמנה (`ArchivedCall`, `ArchivedOrder`). */
export interface ArchiveRow {
  id: string;
  docno: string | null;
  customerName: string;
  customerNumber: string | null;
  phone: string | null;
  city: string | null;
  priorityStatus: string | null;
  created: string;
  archivedAt: string;
  reason: string;
}

export interface ArchiveKind {
  queryKey: string[];
  /** הרשימה החיה שצריכה להתרענן אחרי החזרה. */
  liveKey: string[];
  fetch: () => Promise<ArchiveRow[]>;
  restore: (id: string) => Promise<void>;
  label: (reason: string, priorityStatus: string | null) => string;
  noun: string;
  restoredTo: string;
  placeholder: string;
}

/**
 * רשימת ארכיון אחת (קריאות או הזמנות): חיפוש, ספירה, וכפתור החזרה לכל שורה.
 * מסך משותף: מתרענן בחזרה לחלון וכל דקה, ומראה מתי עודכן.
 */
export function ArchiveSection({ kind }: { kind: ArchiveKind }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: kind.queryKey,
    queryFn: kind.fetch,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const restore = useMutation({
    mutationFn: (r: ArchiveRow) => kind.restore(r.id),
    onSuccess: (_d, r) => {
      toast.success(`${r.docno ?? r.customerName} חזרה ל${kind.restoredTo}`);
      qc.invalidateQueries({ queryKey: kind.queryKey });
      qc.invalidateQueries({ queryKey: kind.liveKey });
    },
    onError: (e) => toast.error('לא הוחזרה', { description: e instanceof Error ? e.message : undefined }),
  });
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => query.data ?? [], [query.data]);
  const matches = useMemo(() => all.filter((r) => matchesArchiveSearch(r, search)), [all, search]);
  const updated = query.dataUpdatedAt ? Math.max(0, Math.round((now - query.dataUpdatedAt) / 60_000)) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xl">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={kind.placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 ps-9 text-base sm:text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {query.isFetching ? 'מתעדכן…' : updated === null ? '' : updated < 1 ? 'עודכן עכשיו' : `עודכן לפני ${updated} דק'`}
        </p>
      </div>

      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3 text-xs text-muted-foreground">
          {search.trim() ? (
            <>
              נמצאו <span className="font-semibold text-foreground tabular-nums">{matches.length}</span> מתוך{' '}
              <span className="tabular-nums">{all.length}</span>
            </>
          ) : (
            <>
              בארכיון <span className="font-semibold text-foreground tabular-nums">{all.length}</span> {kind.noun}
            </>
          )}
        </div>
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען ארכיון…
          </div>
        ) : query.error ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {query.error.message}
          </div>
        ) : matches.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {all.length === 0 ? 'הארכיון ריק' : 'אין בארכיון התאמה לחיפוש'}
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {matches.slice(0, SHOWN).map((r) => (
                <ArchiveLine
                  key={r.id}
                  r={r}
                  label={kind.label(r.reason, r.priorityStatus)}
                  busy={restore.isPending && restore.variables?.id === r.id}
                  onRestore={() => restore.mutate(r)}
                />
              ))}
            </ul>
            {matches.length > SHOWN && (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                מוצגות {SHOWN} הראשונות. חיפוש מצמצם את הרשימה.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ArchiveLine({ r, label, busy, onRestore }: { r: ArchiveRow; label: string; busy: boolean; onRestore: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
      <bdi className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{r.docno ?? 'בלי מספר'}</bdi>
      <span className="font-medium">{r.customerName || 'לקוח לא ידוע'}</span>
      {r.city && <span className="text-muted-foreground">{r.city}</span>}
      {r.phone && <bdi className="text-xs text-muted-foreground">{r.phone}</bdi>}
      <span className="text-xs text-muted-foreground">נפתחה {fmtDate(r.created)}</span>
      <span className="ms-auto rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{label}</span>
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onRestore} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
        החזר לרשימה
      </Button>
    </li>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
