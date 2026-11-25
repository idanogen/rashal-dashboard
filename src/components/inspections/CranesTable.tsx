import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Crane, CraneStatus } from '@/types/crane';
import { serialKey, type FieldInspection } from '@/lib/field-inspections';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { craneStartDate } from '@/lib/crane-due';

interface CranesTableProps {
  rows: Array<{ crane: Crane; status: CraneStatus }>;
  onRowClick: (crane: Crane) => void;
  /** בדיקות הטכנאים מהשטח לפי מספר מנוף, החדשה ראשונה. */
  fieldBySerial: Map<string, FieldInspection[]>;
}

type SortKey = 'urgency' | 'name' | 'install' | 'next_due' | 'device' | 'model' | 'phone' | 'fund' | 'days' | 'field';

const PAGE_SIZE = 50;

export function CranesTable({ rows, onRowClick, fieldBySerial }: CranesTableProps) {
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
    // ערך ריק תמיד בסוף, בשני הכיוונים (עידן 25/11: מיון בכל העמודות).
    const last = (av: unknown, bv: unknown) => (av == null || av === '' ? 1 : 0) - (bv == null || bv === '' ? 1 : 0);
    const text = (av: string | undefined, bv: string | undefined, numeric = false) =>
      last(av, bv) || (av ?? '').localeCompare(bv ?? '', 'he', { numeric }) * dir;
    const num = (av: number | null | undefined, bv: number | null | undefined) =>
      last(av, bv) || ((av ?? 0) - (bv ?? 0)) * dir;
    const fieldAt = (c: Crane) => fieldBySerial.get(serialKey(c.deviceNumber))?.[0]?.submittedAt;
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
          return text(a.crane.customerName, b.crane.customerName);
        case 'install':
          return text(craneStartDate(a.crane), craneStartDate(b.crane));
        case 'next_due':
          return text(a.status.nextDueDate, b.status.nextDueDate);
        case 'device':
          return text(a.crane.deviceNumber, b.crane.deviceNumber, true);
        case 'model':
          return text(a.crane.model, b.crane.model, true);
        case 'phone':
          return text(a.crane.phone, b.crane.phone, true);
        case 'fund':
          return text(shortTypeOrEmpty(a.crane.customerType), shortTypeOrEmpty(b.crane.customerType));
        case 'days':
          return num(a.status.daysUntilDue, b.status.daysUntilDue);
        case 'field':
          return text(fieldAt(a.crane), fieldAt(b.crane));
      }
    });
  }, [rows, sortKey, sortAsc, fieldBySerial]);

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
                <Th onClick={() => toggleSort('model')} active={sortKey === 'model'} asc={sortAsc}>דגם</Th>
                <Th onClick={() => toggleSort('phone')} active={sortKey === 'phone'} asc={sortAsc}>טלפון</Th>
                <Th onClick={() => toggleSort('fund')} active={sortKey === 'fund'} asc={sortAsc}>קופה</Th>
                <Th onClick={() => toggleSort('install')} active={sortKey === 'install'} asc={sortAsc}>ת. התקנה</Th>
                <Th onClick={() => toggleSort('next_due')} active={sortKey === 'next_due'} asc={sortAsc}>בדיקה הבאה</Th>
                <Th onClick={() => toggleSort('days')} active={sortKey === 'days'} asc={sortAsc}>בעוד</Th>
                <Th onClick={() => toggleSort('field')} active={sortKey === 'field'} asc={sortAsc}>בדיקה בשטח</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">אין מנופים תואמים</td>
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
                    <td className="px-3 py-2.5 text-muted-foreground" title={startTitle(crane)}>{fmt(craneStartDate(crane))}</td>
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
                    <td className="px-3 py-2.5"><LastField list={fieldBySerial.get(serialKey(crane.deviceNumber))} /></td>
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

/** מאיפה התאריך: משלוח מהלוג בפריוריטי, או ת. התקנה מהאקסל כשאין משלוח. */
function startTitle(c: Crane): string {
  if (c.shipDate) return `משלוח ללקוח האחרון${c.shipDoc ? ` (${c.shipDoc})` : ''}`;
  return c.installDate ? 'ת. התקנה מהאקסל, אין משלוח בלוג של פריוריטי' : '';
}

function shortTypeOrEmpty(t: string | undefined): string | undefined {
  return t ? shortType(t) : undefined;
}

function shortType(t: string | undefined): string {
  if (!t) return '—';
  return t.replace('כללית הנדסה', 'כללית').replace('משרד הבריאות', 'מ. בריאות');
}

function LastField({ list }: { list?: FieldInspection[] }) {
  const last = list?.[0];
  if (!last) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={last.verdict === 'out_of_service' ? 'font-semibold text-red-600' : ''}>
      {fmt(toLocalDateStr(new Date(last.submittedAt)))}
      {last.technician && <span className="text-xs text-muted-foreground"> · {last.technician}</span>}
    </span>
  );
}
