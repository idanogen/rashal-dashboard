import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Pickup } from '@/types/pickup';
import { getZoneForCity, getZoneById, ZONES } from '@/types/zone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  GripVertical,
  Search,
  Undo2,
} from 'lucide-react';

interface UnscheduledPickupsProps {
  pickups: Pickup[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkSchedule: () => void;
  pendingScheduleIds: Set<string>;
  /** איסופים שחזרו מהקו (סטטוס עצירה "לא בוצע"). */
  returnedIds?: Set<string>;
  onShowDetails: (pickup: Pickup) => void;
}

function PickupCard({
  pickup,
  selected,
  onToggleSelect,
  isPending,
  isReturned,
  onShowDetails,
}: {
  pickup: Pickup;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  isPending: boolean;
  isReturned: boolean;
  onShowDetails: (pickup: Pickup) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pickup.id,
    data: { type: 'pickup', pickup },
  });

  const lineCount = pickup.lines?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex items-start gap-2 rounded-xl border bg-card p-2.5',
        !isDragging && 'transition-[opacity,box-shadow] duration-150',
        selected && 'ring-2 ring-teal-500',
        isReturned && 'border-red-300 bg-red-50/50',
        isPending && 'opacity-25 scale-[0.97] pointer-events-none',
        isDragging && 'opacity-40'
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelect(pickup.id)}
        className="mt-0.5"
        aria-label="בחר איסוף"
      />

      <button
        {...listeners}
        {...attributes}
        className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="גרור ליומן"
        type="button"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Undo2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
          <span className="truncate text-sm font-semibold">{pickup.customerName}</span>
          {isReturned && (
            <Badge variant="destructive" className="h-4 px-1 text-[10px]">חזר מהקו</Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {pickup.priorityPickupId && (
            <span dir="ltr" className="font-mono">{pickup.priorityPickupId}</span>
          )}
          {pickup.customerNumber && <span dir="ltr">· {pickup.customerNumber}</span>}
          {pickup.city && <span>· {pickup.city}</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {pickup.priorityStatus && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">{pickup.priorityStatus}</Badge>
          )}
          <button
            type="button"
            onClick={() => onShowDetails(pickup)}
            className="text-xs font-medium text-teal-700 hover:underline"
          >
            פרטים{lineCount > 0 ? ` · ${lineCount} פריטים` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnscheduledPickups({
  pickups,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  pendingScheduleIds,
  returnedIds,
  onShowDetails,
}: UnscheduledPickupsProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'all'>('grouped');
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickups;
    return pickups.filter((p) =>
      [p.customerName, p.customerNumber, p.city, p.priorityPickupId, p.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [pickups, search]);

  // קיבוץ לפי אזור גיאוגרפי (לפי העיר), ממוין צפון→דרום, "ללא אזור" בסוף.
  const groupedByZone = useMemo(() => {
    const map = new Map<string, Pickup[]>();
    for (const p of filtered) {
      const zoneId = getZoneForCity(p.city) || 'unassigned';
      const g = map.get(zoneId) || [];
      g.push(p);
      map.set(zoneId, g);
    }
    const zoneOrder = ZONES.map((z) => z.id);
    const sorted = new Map<string, Pickup[]>();
    Array.from(map.entries())
      .sort(([a], [b]) => {
        const ia = a === 'unassigned' ? Infinity : (zoneOrder.indexOf(a) === -1 ? Infinity : zoneOrder.indexOf(a));
        const ib = b === 'unassigned' ? Infinity : (zoneOrder.indexOf(b) === -1 ? Infinity : zoneOrder.indexOf(b));
        return ia - ib;
      })
      .forEach(([k, v]) => sorted.set(k, v));
    return sorted;
  }, [filtered]);

  const toggleZone = (zoneId: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      next.has(zoneId) ? next.delete(zoneId) : next.add(zoneId);
      return next;
    });
  };

  const allZoneIds = Array.from(groupedByZone.keys());
  const allExpanded = allZoneIds.length > 0 && allZoneIds.every((id) => expandedZones.has(id));
  const toggleAllZones = () =>
    setExpandedZones(allExpanded ? new Set() : new Set(allZoneIds));

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const renderCard = (p: Pickup) => (
    <PickupCard
      key={p.id}
      pickup={p}
      selected={selectedIds.has(p.id)}
      onToggleSelect={onToggleSelect}
      isPending={pendingScheduleIds.has(p.id)}
      isReturned={returnedIds?.has(p.id) ?? false}
      onShowDetails={onShowDetails}
    />
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש: שם / מספר לקוח / מסמך / עיר"
            className="pe-9"
          />
        </div>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'grouped' | 'all')}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grouped">קיבוץ לפי אזור</SelectItem>
            <SelectItem value="all">תצוגה רגילה</SelectItem>
          </SelectContent>
        </Select>
        {filtered.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              allVisibleSelected ? onClearSelection() : onSelectAll(filtered.map((p) => p.id))
            }
          >
            <CheckCircle2 className="h-4 w-4" />
            {allVisibleSelected ? 'נקה בחירה' : 'בחר הכל'}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          אין איסופים ממתינים
        </div>
      ) : viewMode === 'all' ? (
        // ── תצוגה רגילה — רשת בתוך מיכל גלילה תחום (הדף לא גדל) ──
        <div className="grid max-h-[560px] gap-2 overflow-y-auto rounded-xl border bg-muted/20 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(renderCard)}
        </div>
      ) : (
        // ── קיבוץ לפי אזור — כל אזור מתקפל, בתוך מיכל גלילה תחום ──
        <div className="max-h-[560px] space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">
              {allZoneIds.length} אזורים · {filtered.length} איסופים
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllZones}
              className="h-7 gap-1 text-xs text-muted-foreground"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {allExpanded ? 'סגור הכל' : 'פתח הכל'}
            </Button>
          </div>
          {Array.from(groupedByZone.entries()).map(([zoneId, zonePickups]) => {
            const zone = getZoneById(zoneId);
            const isExpanded = expandedZones.has(zoneId);
            const selectedInZone = zonePickups.filter((p) => selectedIds.has(p.id)).length;
            return (
              <div key={zoneId} className="overflow-hidden rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => toggleZone(zoneId)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2.5 text-start transition-colors hover:bg-muted/50',
                    isExpanded && 'border-b bg-muted/30'
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  {zone?.color && (
                    <span className={cn('h-3 w-3 flex-shrink-0 rounded-full', zone.color)} />
                  )}
                  <span className="font-semibold">{zone?.name || 'ללא אזור'}</span>
                  <Badge variant="secondary" className="text-xs">{zonePickups.length}</Badge>
                  {selectedInZone > 0 && (
                    <Badge className="bg-teal-500 text-xs">{selectedInZone} נבחרו</Badge>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const ids = zonePickups.map((p) => p.id);
                      const allSel = ids.every((id) => selectedIds.has(id));
                      onSelectAll(
                        allSel
                          ? [...selectedIds].filter((id) => !ids.includes(id))
                          : [...new Set([...selectedIds, ...ids])]
                      );
                    }}
                    className="ms-auto text-[11px] font-medium text-teal-700 hover:underline"
                  >
                    בחר אזור
                  </button>
                </button>
                {isExpanded && (
                  <div className="grid gap-2 p-2 sm:grid-cols-2">
                    {zonePickups.map(renderCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <span className="text-sm font-medium">{selectedIds.size} נבחרו</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              נקה
            </Button>
            <Button size="sm" onClick={onBulkSchedule} className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              תזמן {selectedIds.size} איסופים
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
