import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ORDER_STATUS_OPTIONS, WORKERS } from '@/lib/constants';

export interface OrderFiltersState {
  search: string;
  orderStatus: string;
  worker: string;
  city: string;
}

interface OrderFiltersProps {
  filters: OrderFiltersState;
  onChange: (filters: OrderFiltersState) => void;
  cities: string[];
}

export function OrderFilters({ filters, onChange, cities }: OrderFiltersProps) {
  const hasFilters =
    filters.search || filters.orderStatus || filters.worker || filters.city;

  function update(patch: Partial<OrderFiltersState>) {
    onChange({ ...filters, ...patch });
  }

  function clearAll() {
    onChange({ search: '', orderStatus: '', worker: '', city: '' });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="חיפוש שם או טלפון..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="h-9 pr-9 text-sm"
        />
      </div>

      {/* Order Status */}
      <Select
        value={filters.orderStatus || 'all'}
        onValueChange={(v) => update({ orderStatus: v === 'all' ? '' : v })}
      >
        <SelectTrigger className="h-9 w-[140px] text-sm">
          <SelectValue placeholder="סטטוס הזמנה" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הסטטוסים</SelectItem>
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Worker */}
      <Select
        value={filters.worker || 'all'}
        onValueChange={(v) => update({ worker: v === 'all' ? '' : v })}
      >
        <SelectTrigger className="h-9 w-[120px] text-sm">
          <SelectValue placeholder="עובד" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל העובדים</SelectItem>
          {WORKERS.map((w) => (
            <SelectItem key={w} value={w}>
              {w}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* City */}
      <Select
        value={filters.city || 'all'}
        onValueChange={(v) => update({ city: v === 'all' ? '' : v })}
      >
        <SelectTrigger className="h-9 w-[140px] text-sm">
          <SelectValue placeholder="עיר" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הערים</SelectItem>
          {cities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-xs">
          <X className="h-3.5 w-3.5" />
          נקה
        </Button>
      )}
    </div>
  );
}
