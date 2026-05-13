import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, Search, Upload, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCranes } from '@/hooks/useCranes';
import { useCraneInspections } from '@/hooks/useCraneInspections';
import { useLatestSync } from '@/hooks/useCraneSync';
import { computeCraneStatus } from '@/lib/cranes';
import { InspectionStatsCards } from '@/components/inspections/InspectionStatsCards';
import { CustomerTypeFilter, type CustomerTypeKey } from '@/components/inspections/CustomerTypeFilter';
import { CranesTable } from '@/components/inspections/CranesTable';
import { CraneDetailDialog } from '@/components/inspections/CraneDetailDialog';
import { SyncDialog } from '@/components/inspections/SyncDialog';
import type { Crane, CraneStatus } from '@/types/crane';

type UrgencyFilter = 'all' | 'overdue' | 'due_soon' | 'unknown';

const MAIN_CUSTOMER_TYPES = new Set([
  'כללית הנדסה',
  'משרד הבריאות',
  'מכבי',
  'מאוחדת',
  'לאומית',
]);

export function InspectionsPage() {
  const cranesQ = useCranes();
  const inspectionsQ = useCraneInspections();
  const latestSyncQ = useLatestSync();

  const [customerType, setCustomerType] = useState<CustomerTypeKey>('כללית הנדסה');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [search, setSearch] = useState('');
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [selectedCrane, setSelectedCrane] = useState<Crane | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  // Compute status for each crane
  const cranesWithStatus = useMemo(() => {
    const inspections = inspectionsQ.data ?? [];
    const inspectionsByCrane = new Map<string, typeof inspections>();
    for (const ins of inspections) {
      const arr = inspectionsByCrane.get(ins.craneId) ?? [];
      arr.push(ins);
      inspectionsByCrane.set(ins.craneId, arr);
    }
    return (cranesQ.data ?? []).map((c) => ({
      crane: c,
      status: computeCraneStatus(c, inspectionsByCrane.get(c.id) ?? []),
    }));
  }, [cranesQ.data, inspectionsQ.data]);

  // Apply "include cancelled" toggle
  const visibleCranes = useMemo(
    () => cranesWithStatus.filter((r) => includeCancelled || !r.crane.cancelledAt),
    [cranesWithStatus, includeCancelled]
  );

  // Count by customer type (for tabs)
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    let otherCount = 0;
    for (const { crane } of visibleCranes) {
      const t = crane.customerType ?? '';
      if (MAIN_CUSTOMER_TYPES.has(t)) {
        counts[t] = (counts[t] ?? 0) + 1;
      } else {
        otherCount += 1;
      }
    }
    counts['אחר'] = otherCount;
    return counts;
  }, [visibleCranes]);

  // Apply all filters → table rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleCranes.filter(({ crane, status }) => {
      // Customer type
      if (customerType !== 'הכל') {
        if (customerType === 'אחר') {
          if (MAIN_CUSTOMER_TYPES.has(crane.customerType ?? '')) return false;
        } else if (crane.customerType !== customerType) {
          return false;
        }
      }
      // Urgency
      if (urgencyFilter !== 'all' && status.urgency !== urgencyFilter) return false;
      // Search
      if (q) {
        const hay =
          (crane.customerName ?? '') +
          ' ' +
          crane.deviceNumber +
          ' ' +
          (crane.phone ?? '') +
          ' ' +
          (crane.customerIdNumber ?? '');
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [visibleCranes, customerType, urgencyFilter, search]);

  // Stats for cards (based on currently-selected customer type)
  const stats = useMemo(() => {
    const byTypeRows = visibleCranes.filter(({ crane }) => {
      if (customerType === 'הכל') return true;
      if (customerType === 'אחר') return !MAIN_CUSTOMER_TYPES.has(crane.customerType ?? '');
      return crane.customerType === customerType;
    });
    return {
      totalActive: byTypeRows.length,
      overdue: byTypeRows.filter((r) => r.status.urgency === 'overdue').length,
      dueSoon: byTypeRows.filter((r) => r.status.urgency === 'due_soon').length,
      unknown: byTypeRows.filter((r) => r.status.urgency === 'unknown').length,
    };
  }, [visibleCranes, customerType]);

  function handleRowClick(crane: Crane) {
    setSelectedCrane(crane);
    setDetailOpen(true);
  }

  const selectedStatus: CraneStatus | undefined = useMemo(
    () => cranesWithStatus.find((r) => r.crane.id === selectedCrane?.id)?.status,
    [cranesWithStatus, selectedCrane]
  );

  if (cranesQ.isLoading || inspectionsQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        טוען מנופים…
      </div>
    );
  }

  if (cranesQ.error) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" />
        שגיאה בטעינת מנופים: {cranesQ.error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">בדיקות מנופים</h1>
          <p className="text-sm text-muted-foreground">
            ניהול בדיקות תקופתיות (כל 3 שנים) למנופי G150 ו-G175
          </p>
        </div>
        <div className="flex items-center gap-2">
          {latestSyncQ.data && (
            <div className="text-xs text-muted-foreground">
              סנכרון אחרון: {fmtDateTime(latestSyncQ.data.syncedAt)}
            </div>
          )}
          <Button onClick={() => setSyncOpen(true)}>
            <Upload className="h-4 w-4" />
            סנכרן דוח
          </Button>
        </div>
      </div>

      {/* Customer type tabs */}
      <CustomerTypeFilter
        value={customerType}
        onChange={(v) => {
          setCustomerType(v);
          setUrgencyFilter('all');
        }}
        countByType={countByType}
        totalCount={visibleCranes.length}
      />

      {/* Stats */}
      <InspectionStatsCards {...stats} />

      {/* Filter + search row */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש שם / מס' מכשיר / טלפון…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pr-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <FilterPill active={urgencyFilter === 'all'} onClick={() => setUrgencyFilter('all')}>הכל</FilterPill>
          <FilterPill active={urgencyFilter === 'overdue'} onClick={() => setUrgencyFilter('overdue')} tone="red">
            פג תוקף ({stats.overdue})
          </FilterPill>
          <FilterPill active={urgencyFilter === 'due_soon'} onClick={() => setUrgencyFilter('due_soon')} tone="amber">
            דחוף ({stats.dueSoon})
          </FilterPill>
          <FilterPill active={urgencyFilter === 'unknown'} onClick={() => setUrgencyFilter('unknown')}>
            ללא ת.התקנה ({stats.unknown})
          </FilterPill>
        </div>

        <label className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={includeCancelled} onCheckedChange={(v) => setIncludeCancelled(!!v)} />
          כלול מבוטלים
        </label>
      </div>

      {/* Table */}
      <CranesTable rows={filteredRows} onRowClick={handleRowClick} />

      {/* Dialogs */}
      <CraneDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        crane={selectedCrane}
        status={selectedStatus}
      />
      <SyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
    </div>
  );
}

function FilterPill({
  children,
  active,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: 'red' | 'amber';
}) {
  const base = 'rounded px-2 py-1 font-medium transition-colors';
  if (active) {
    if (tone === 'red') return <button onClick={onClick} className={`${base} bg-red-100 text-red-800`}>{children}</button>;
    if (tone === 'amber') return <button onClick={onClick} className={`${base} bg-amber-100 text-amber-800`}>{children}</button>;
    return <button onClick={onClick} className={`${base} bg-primary text-primary-foreground`}>{children}</button>;
  }
  return (
    <button onClick={onClick} className={`${base} bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground`}>
      {children}
    </button>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}
