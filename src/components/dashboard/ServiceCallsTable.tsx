import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, Phone, MapPin, Search } from 'lucide-react';
import type { ServiceCall } from '@/types/service-call';
import { SERVICE_CALL_STATUS_OPTIONS } from '@/lib/constants';
import { useUpdateServiceCall } from '@/hooks/useUpdateServiceCall';
import { getDaysSinceCreated, getDaysColor } from '@/lib/utils';

interface ServiceCallsTableProps {
  calls: ServiceCall[];
}

type SortKey = 'customerName' | 'city' | 'serviceCallStatus' | 'created' | 'daysSince';
type SortDir = 'asc' | 'desc';

const statusColorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-50 text-gray-500 border-gray-200',
};

function getStatusColor(status: string | undefined): string {
  const opt = SERVICE_CALL_STATUS_OPTIONS.find((o) => o.value === status);
  return opt?.color || 'gray';
}

function getStatusLabel(status: string | undefined): string {
  if (!status) return 'לא ידוע';
  const opt = SERVICE_CALL_STATUS_OPTIONS.find((o) => o.value === status);
  return opt?.label || status;
}

function ServiceCallStatusBadge({ status }: { status: string | undefined }) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  return (
    <Badge
      variant="outline"
      className={`font-medium text-xs px-2 py-0.5 ${statusColorMap[color] || statusColorMap.gray}`}
    >
      {label}
    </Badge>
  );
}

function ServiceCallStatusDropdown({
  callId,
  currentValue,
}: {
  callId: string;
  currentValue: string | undefined;
}) {
  const { mutate } = useUpdateServiceCall();

  function handleChange(value: string) {
    if (value !== currentValue) {
      mutate({ id: callId, fields: { serviceCallStatus: value as ServiceCall['serviceCallStatus'] } });
    }
  }

  return (
    <Select value={currentValue || ''} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-[130px] text-xs border-dashed">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SERVICE_CALL_STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ServiceCallsTable({ calls }: ServiceCallsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = c.customerName?.toLowerCase().includes(q);
        const phoneMatch = c.phone?.includes(search);
        if (!nameMatch && !phoneMatch) return false;
      }
      if (statusFilter && c.serviceCallStatus !== statusFilter) return false;
      return true;
    });
  }, [calls, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === 'daysSince') {
        const daysA = getDaysSinceCreated(a.created) ?? -1;
        const daysB = getDaysSinceCreated(b.created) ?? -1;
        const cmp = daysA - daysB;
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      const cmp = String(valA).localeCompare(String(valB), 'he');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortableHeader({ column, children }: { column: SortKey; children: React.ReactNode }) {
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors text-xs font-semibold"
        onClick={() => toggleSort(column)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </TableHead>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם או טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] text-sm">
            <SelectValue placeholder="סטטוס קריאה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            {SERVICE_CALL_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 text-center text-xs font-semibold">#</TableHead>
                <SortableHeader column="customerName">שם הלקוח</SortableHeader>
                <TableHead className="text-xs font-semibold">טלפון</TableHead>
                <SortableHeader column="city">עיר</SortableHeader>
                <TableHead className="text-xs font-semibold">קופ״ח</TableHead>
                <SortableHeader column="serviceCallStatus">סטטוס קריאה</SortableHeader>
                <SortableHeader column="created">תאריך</SortableHeader>
                <SortableHeader column="daysSince">ימים</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    לא נמצאו קריאות שירות
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((call, idx) => (
                  <TableRow key={call.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{call.customerName}</TableCell>
                    <TableCell>
                      {call.phone && (
                        <a
                          href={`tel:${call.phone}`}
                          className="text-primary hover:underline"
                          dir="ltr"
                        >
                          {call.phone}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{call.city || '—'}</TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]">{call.healthFund || '—'}</TableCell>
                    <TableCell>
                      <ServiceCallStatusDropdown
                        callId={call.id}
                        currentValue={call.serviceCallStatus}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {call.created
                        ? new Date(call.created).toLocaleDateString('he-IL')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const days = getDaysSinceCreated(call.created);
                        if (days === null) return '—';
                        return (
                          <span className={`text-xs font-semibold ${getDaysColor(days)}`}>
                            {days === 0 ? 'היום' : `${days} ימים`}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          מציג {sorted.length} מתוך {calls.length} קריאות שירות
        </p>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-2 md:hidden">
        {sorted.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">לא נמצאו קריאות שירות</p>
        ) : (
          sorted.map((call) => (
            <Card key={call.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{call.customerName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {call.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${call.phone}`} className="text-primary" dir="ltr">
                          {call.phone}
                        </a>
                      </span>
                    )}
                    {call.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {call.city}
                      </span>
                    )}
                    {call.healthFund && (
                      <span className="truncate">{call.healthFund}</span>
                    )}
                  </div>
                </div>
                <ServiceCallStatusBadge status={call.serviceCallStatus} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{call.openedBy || '—'}</span>
                <div className="flex items-center gap-2">
                  <span>
                    {call.created
                      ? new Date(call.created).toLocaleDateString('he-IL')
                      : ''}
                  </span>
                  {(() => {
                    const days = getDaysSinceCreated(call.created);
                    if (days === null) return null;
                    return (
                      <span className={`font-semibold ${getDaysColor(days)}`}>
                        {days === 0 ? 'היום' : `${days} ימים`}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </Card>
          ))
        )}
        <p className="text-center text-xs text-muted-foreground">
          מציג {sorted.length} מתוך {calls.length} קריאות שירות
        </p>
      </div>
    </div>
  );
}
