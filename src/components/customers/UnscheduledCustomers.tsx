import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { NewCustomer } from '@/types/customer';
import { isBareCustomer } from '@/types/customer';
import { getZoneForCity } from '@/types/zone';
import { ZoneFilter } from '@/components/deliveries/ZoneFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  GripVertical,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';

interface UnscheduledCustomersProps {
  customers: NewCustomer[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkSchedule: () => void;
  pendingScheduleIds: Set<string>;
}

/** כמה ימים עברו מאז שהלקוח נפתח בפריוריטי. */
function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

function CustomerCard({
  customer,
  selected,
  onToggleSelect,
  isPending,
}: {
  customer: NewCustomer;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: customer.customerNumber,
    data: { type: 'customer', customer },
  });

  const bare = isBareCustomer(customer);
  const age = daysSince(customer.openedAt);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // פס צד צבעוני — סימון סוג לטאב "הכל"
        'group relative flex items-start gap-2 rounded-xl border border-s-4 border-s-violet-500 bg-card p-2.5',
        !isDragging && 'transition-[opacity,box-shadow] duration-150',
        selected && 'ring-2 ring-violet-500',
        // לקוח בלי שום רשומה נלווית הוא בדיוק המקרה שנפל בין הכיסאות עד היום
        bare && 'border-violet-300 bg-violet-50/40',
        isPending && 'pointer-events-none scale-[0.97] opacity-25',
        isDragging && 'opacity-40'
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelect(customer.customerNumber)}
        className="mt-0.5"
        aria-label="בחר לקוח"
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
          <UserPlus className="h-3.5 w-3.5 shrink-0 text-violet-600" />
          <span className="truncate text-sm font-semibold">{customer.customerName}</span>
          {bare && (
            <Badge className="h-4 shrink-0 bg-violet-600 px-1 text-[10px] hover:bg-violet-600">
              ללא הזמנה
            </Badge>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span dir="ltr" className="font-mono">{customer.customerNumber}</span>
          {customer.city && <span>· {customer.city}</span>}
          {customer.phone && <span dir="ltr">· {customer.phone}</span>}
        </div>

        {customer.address && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{customer.address}</div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {age != null && (
            <Badge
              variant="outline"
              className={cn(
                'h-4 px-1 text-[10px]',
                age <= 2 && 'border-emerald-300 text-emerald-700'
              )}
            >
              {age === 0 ? 'נפתח היום' : `לפני ${age} ימים`}
            </Badge>
          )}
          {customer.healthFund && (
            <Badge variant="outline" className="h-4 max-w-[140px] truncate px-1 text-[10px]">
              {customer.healthFund}
            </Badge>
          )}
          {customer.hasOrder && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">יש הזמנה</Badge>
          )}
          {customer.hasServiceCall && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">יש קריאה</Badge>
          )}
          {customer.hasPickup && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">יש איסוף</Badge>
          )}
          {customer.openedBy && (
            <span className="text-[10px] text-muted-foreground">נפתח ע"י {customer.openedBy}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function UnscheduledCustomers({
  customers,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkSchedule,
  pendingScheduleIds,
}: UnscheduledCustomersProps) {
  const [search, setSearch] = useState('');
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  /**
   * ברירת המחדל היא להציג רק לקוחות בלי שום רשומה נלווית. אלה האספקות
   * שאף מסך אחר לא מראה. מי שכבר יש לו הזמנה או קריאה נמצא ממילא בטאב שלו,
   * והצגתו כאן רק תכפיל אותו לסדרן.
   */
  const [onlyBare, setOnlyBare] = useState(true);
  const [zoneFilterCollapsed, toggleZoneFilterCollapsed] = usePersistedCollapse(
    'collapse:customers-zone-filter'
  );
  const [listCollapsed, toggleListCollapsed] = usePersistedCollapse('collapse:customers-list');

  const zoneById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) {
      m.set(c.customerNumber, getZoneForCity(c.city) || 'unassigned');
    }
    return m;
  }, [customers]);

  const scoped = useMemo(
    () => (onlyBare ? customers.filter(isBareCustomer) : customers),
    [customers, onlyBare]
  );

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((c) =>
      [c.customerName, c.customerNumber, c.city, c.phone, c.address, c.openedBy]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [scoped, search]);

  const countByZone = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of searched) {
      const z = zoneById.get(c.customerNumber) || 'unassigned';
      m.set(z, (m.get(z) || 0) + 1);
    }
    return m;
  }, [searched, zoneById]);

  const visible = useMemo(() => {
    if (selectedZones.length === 0) return searched;
    return searched.filter((c) =>
      selectedZones.includes(zoneById.get(c.customerNumber) || 'unassigned')
    );
  }, [searched, selectedZones, zoneById]);

  const toggleZone = (zoneId: string) =>
    setSelectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );

  const allVisibleSelected =
    visible.length > 0 && visible.every((c) => selectedIds.has(c.customerNumber));

  const bareCount = useMemo(() => customers.filter(isBareCustomer).length, [customers]);

  return (
    <div className="space-y-3">
      {/* כותרת דביקה — בטאב "הכל" ארבע הרשימות זו מתחת לזו */}
      <div className="sticky top-[calc(var(--app-header-h,61px)+56px)] z-20 -mx-1 flex items-center gap-2 rounded-lg border bg-muted/95 px-3 py-2 backdrop-blur-sm">
        <UserPlus className="h-4 w-4 text-violet-600" />
        <h3 className="font-bold">לקוחות חדשים</h3>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
          {visible.length}
        </span>
      </div>
      {/* למה המסך הזה קיים — הסדרן לא ראה את הלקוחות האלה עד היום */}
      <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-2.5 text-xs text-violet-900">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
        <span>
          לקוח חדש שנפתח בפריוריטי הוא ברוב המקרים אספקה שממתינה, גם כשעוד לא נפתחה לו הזמנה.
          כרגע יש <strong>{bareCount}</strong> לקוחות כאלה בלי שום רשומה נלווית.
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש: שם / מספר לקוח / טלפון / עיר"
            className="pe-9"
          />
        </div>
        <Button
          variant={onlyBare ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyBare((v) => !v)}
        >
          {onlyBare ? 'רק ללא הזמנה' : 'כל הלקוחות החדשים'}
        </Button>
        {visible.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              allVisibleSelected
                ? onClearSelection()
                : onSelectAll(visible.map((c) => c.customerNumber))
            }
          >
            <CheckCircle2 className="h-4 w-4" />
            {allVisibleSelected ? 'נקה בחירה' : `בחר ${visible.length}`}
          </Button>
        )}
      </div>

      <ZoneFilter
        selectedZones={selectedZones}
        onZoneToggle={toggleZone}
        onClearAll={() => setSelectedZones([])}
        orderCountByZone={countByZone}
        collapsed={zoneFilterCollapsed}
        onToggleCollapse={toggleZoneFilterCollapsed}
      />

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {searched.length === 0 ? 'אין לקוחות חדשים ממתינים' : 'אין לקוחות באזורים שנבחרו'}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              {selectedZones.length > 0
                ? `מציג ${visible.length} מתוך ${searched.length}`
                : `${visible.length} לקוחות · בחר אזור לצמצום`}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleListCollapsed}>
              {listCollapsed ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!listCollapsed && (
            <div className="grid max-h-[400px] gap-2 overflow-y-auto rounded-xl border bg-muted/20 p-2 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <CustomerCard
                  key={c.customerNumber}
                  customer={c}
                  selected={selectedIds.has(c.customerNumber)}
                  onToggleSelect={onToggleSelect}
                  isPending={pendingScheduleIds.has(c.customerNumber)}
                />
              ))}
            </div>
          )}
        </>
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
              תזמן {selectedIds.size} אספקות
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
