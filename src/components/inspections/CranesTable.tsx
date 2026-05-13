import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Crane, CraneStatus } from '@/types/crane';

interface CranesTableProps {
  rows: Array<{ crane: Crane; status: CraneStatus }>;
  onRowClick: (crane: Crane) => void;
}

type SortKey = 'urgency' | 'name' | 'install' | 'next_due' | 'device';

const PAGE_SIZE = 50;

export function CranesTable({ rows, onRowClick }: CranesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const URGENCY_RANK: Record<CraneStatus['urgency'], number> = {
      overdue: 0,
      due_soon: 1,
      ok: 2,
      unknown: 3,
    };
    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'urgency': {
          const ua = URGENCY_RANK[a.status.urgency];
          const ub = URGENCY_RANK[b.status.urgency];
          if (ua !== ub) return (ua - ub) * dir;
          const da = a.status.daysUntilDue ?? Number.POSITIVE_INFINITY;
          const db = b.status.daysUntilDue ?? Number.POSITIVE_INFINITY;
          return (da - db) * dir;
        }
        case 'name':
          return (a.crane.customerName ?? '').localeCompare(b.crane.customerName ?? '', 'he') * dir;
        case 'install':
          return cmpDate(a.crane.installDate, b.crane.installDate) * dir;
        case 'next_due':
          return cmpDate(a.status.nextDueDate, b.status.nextDueDate) * dir;
        case 'device':
          return a.crane.deviceNumber.localeCompare(b.crane.deviceNumber, 'he', { numeric: true }) * dir;
      }
    });
  }, [rows, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(0);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <Th onClick={() => toggleSort('urgency')} active={sortKey === 'urgency'} asc={sortAsc}>סטטוס</Th>
                <Th onClick={() => toggleSort('name')} active={sortKey === 'name'} asc={sortAsc}>שם לקוח</Th>
                <Th onClick={() => toggleSort('device')} active={sortKey === 'device'} asc={sortAsc}>מס' מכשיר</Th>
                <Th>דגם</Th>
                <Th>טלפון</Th>
                <Th>קופה</Th>
                <Th onClick={() => toggleSort('install')} active={sortKey === 'install'} asc={sortAsc}>ת. התקנה</Th>
                <Th onClick={() => toggleSort('next_due')} active={sortKey === 'next_due'} asc={sortAsc}>בדיקה הבאה</Th>
                <Th>בעוד</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">אין מנופים תואמים</td>
                </tr>
              ) : (
                pageRows.map(({ crane, status }) => (
                  <tr
                    key={crane.id}
                    onClick={() => onRowClick(crane)}
                    className={cn(
                      'cursor-pointer border-t transition-colors hover:bg-muted/40',
                      status.urgency === 'overdue' && 'bg-red-50/70',
                      status.urgency === 'due_soon' && 'bg-amber-50/60'
                    )}
                  >
                    <td className="px-3 py-2.5"><UrgencyBadge urgency={status.urgency} /></td>
                    <td className="px-3 py-2.5 font-medium">{crane.customerName || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{crane.deviceNumber}</td>
                    <td className="px-3 py-2.5">{crane.model}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{crane.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{shortType(crane.customerType)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmt(crane.installDate)}</td>
                    <td className="px-3 py-2.5">{fmt(status.nextDueDate)}</td>
                    <td className="px-3 py-2.5">
                      {status.daysUntilDue == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : status.daysUntilDue < 0 ? (
                        <span className="font-semibold text-red-600">{Math.abs(status.daysUntilDue)} ימים באיחור</span>
                      ) : status.daysUntilDue === 0 ? (
                        <span className="font-semibold text-amber-600">היום</span>
                      ) : (
                        <span>{status.daysUntilDue} ימים</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            עמוד {safePage + 1} מתוך {pageCount} · סה"כ {sorted.length.toLocaleString('he-IL')} מנופים
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              הקודם
            </Button>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
              הבא
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  asc,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  asc?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'whitespace-nowrap px-3 py-2 text-right font-medium',
        onClick && 'cursor-pointer select-none hover:text-foreground'
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && (
          active ? (asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

function UrgencyBadge({ urgency }: { urgency: CraneStatus['urgency'] }) {
  switch (urgency) {
    case 'overdue':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">פג תוקף</Badge>;
    case 'due_soon':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">דחוף</Badge>;
    case 'ok':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">תקין</Badge>;
    case 'unknown':
      return <Badge variant="outline" className="text-slate-500">אין ת.התקנה</Badge>;
  }
}

function fmt(iso: string | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function cmpDate(a: string | undefined, b: string | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function shortType(t: string | undefined): string {
  if (!t) return '—';
  return t.replace('כללית הנדסה', 'כללית').replace('משרד הבריאות', 'מ. בריאות');
}
