import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Pickup } from '@/types/pickup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { CalendarDays, CheckCircle2, GripVertical, Search, Undo2 } from 'lucide-react';

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
        'group relative flex items-start gap-2 rounded-xl border bg-card p-3',
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
        ref={setNodeRef as never}
        {...listeners}
        {...attributes}
        className="mt-0.5 cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickups;
    return pickups.filter((p) =>
      [p.customerName, p.customerNumber, p.city, p.priorityPickupId, p.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [pickups, search]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  return (
    <div className="space-y-3">
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
        {filtered.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              allVisibleSelected
                ? onClearSelection()
                : onSelectAll(filtered.map((p) => p.id))
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
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((p) => (
            <PickupCard
              key={p.id}
              pickup={p}
              selected={selectedIds.has(p.id)}
              onToggleSelect={onToggleSelect}
              isPending={pendingScheduleIds.has(p.id)}
              isReturned={returnedIds?.has(p.id) ?? false}
              onShowDetails={onShowDetails}
            />
          ))}
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
