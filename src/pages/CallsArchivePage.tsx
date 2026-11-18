import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Archive, ArrowRight, Loader2, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchArchivedCalls, restoreArchivedCall } from '@/lib/calls-archive';
import { archiveReasonLabel, matchesArchiveSearch, type ArchivedCall } from '@/lib/calls-archive-rules';

const ARCHIVE_KEY = ['callsArchive'];
const SHOWN = 200;

/**
 * טענה: "מה שירד מרשימת הקריאות לא נעלם, והחזרה היא לחיצה אחת" (עידן, 18/11/2026).
 * ברשימת הסדרן נשארות רק "לביצוע" ו"להמשך טיפול"; כל השאר כאן, עם חיפוש וכפתור החזרה.
 * מסך משותף: מתרענן בחזרה לחלון וכל דקה, ומראה מתי עודכן.
 */
export function CallsArchivePage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ARCHIVE_KEY,
    queryFn: fetchArchivedCalls,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const restore = useMutation({
    mutationFn: (c: ArchivedCall) => restoreArchivedCall(c.id),
    onSuccess: (_d, c) => {
      toast.success(`${c.docno ?? c.customerName} חזרה לרשימת הקריאות`);
      qc.invalidateQueries({ queryKey: ARCHIVE_KEY });
      qc.invalidateQueries({ queryKey: ['serviceCalls'] });
    },
    onError: (e) => toast.error('הקריאה לא הוחזרה', { description: e instanceof Error ? e.message : undefined }),
  });
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(() => query.data ?? [], [query.data]);
  const matches = useMemo(() => all.filter((c) => matchesArchiveSearch(c, search)), [all, search]);
  const updated = query.dataUpdatedAt ? Math.max(0, Math.round((now - query.dataUpdatedAt) / 60_000)) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/dispatch" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-3.5 w-3.5" />
            חזרה למסך הסדרן
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Archive className="h-5 w-5 text-muted-foreground" />
            ארכיון קריאות שירות
          </h1>
          <p className="text-sm text-muted-foreground">
            ברשימת הקריאות נשארות רק "לביצוע" ו"להמשך טיפול". כל השאר כאן, ואפשר להחזיר כל קריאה לרשימה.
          </p>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {query.isFetching ? 'מתעדכן…' : updated === null ? '' : updated < 1 ? 'עודכן עכשיו' : `עודכן לפני ${updated} דק'`}
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="חיפוש שם / מספר קריאה / מס' לקוח / טלפון / עיר…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 ps-9 text-base sm:text-sm"
        />
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
              בארכיון <span className="font-semibold text-foreground tabular-nums">{all.length}</span> קריאות
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
            {all.length === 0 ? 'הארכיון ריק' : 'אין קריאה בארכיון שמתאימה לחיפוש'}
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {matches.slice(0, SHOWN).map((c) => (
                <ArchivedCallLine key={c.id} c={c} busy={restore.isPending && restore.variables?.id === c.id} onRestore={() => restore.mutate(c)} />
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

function ArchivedCallLine({ c, busy, onRestore }: { c: ArchivedCall; busy: boolean; onRestore: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
      <bdi className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{c.docno ?? 'בלי מספר'}</bdi>
      <span className="font-medium">{c.customerName || 'לקוח לא ידוע'}</span>
      {c.city && <span className="text-muted-foreground">{c.city}</span>}
      {c.phone && <bdi className="text-xs text-muted-foreground">{c.phone}</bdi>}
      <span className="text-xs text-muted-foreground">נפתחה {fmtDate(c.created)}</span>
      <span className="ms-auto rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        {archiveReasonLabel(c.reason, c.priorityStatus)}
      </span>
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
