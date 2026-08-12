import { Search, X } from 'lucide-react';

import { ZoneFilter } from '@/components/deliveries/ZoneFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';

/**
 * חיפוש וסינון אזורים אחד לכל מסך הסדרן. עד 12/08/2026 לכל סוג מסמך היו
 * תיבת חיפוש וסינון אזור משלו, כך שבטאב "הכל" היו ארבעה עותקים של אותו
 * סינון וחיפוש שם לקוח דרש להקליד אותו ארבע פעמים. החיפוש רץ על כל השדות
 * של הרשומה, לא רק על שם, מספר לקוח וטלפון.
 */
interface DispatchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedZones: string[];
  onZoneToggle: (zoneId: string) => void;
  onClearZones: () => void;
  countByZone: Map<string, number>;
  /** כמה רשומות מוצגות אחרי הסינון, מתוך כמה בסך הכל */
  matchCount: number;
  totalCount: number;
}

export function DispatchFilterBar({
  search,
  onSearchChange,
  selectedZones,
  onZoneToggle,
  onClearZones,
  countByZone,
  matchCount,
  totalCount,
}: DispatchFilterBarProps) {
  const [zoneCollapsed, toggleZoneCollapsed] = usePersistedCollapse(
    'collapse:dispatch-zone-filter'
  );

  const filtering = search.trim().length > 0 || selectedZones.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="חיפוש בכל השדות: שם, מספר לקוח, טלפון, כתובת, מכשיר, תקלה, מסמך, פריט"
            className="h-9 pr-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              title="נקה חיפוש"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filtering && (
          <>
            <Badge variant="secondary" className="h-7 px-2 text-xs">
              {matchCount} מתוך {totalCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                onSearchChange('');
                onClearZones();
              }}
            >
              <X className="h-3.5 w-3.5" />
              נקה סינון
            </Button>
          </>
        )}
      </div>

      <ZoneFilter
        selectedZones={selectedZones}
        onZoneToggle={onZoneToggle}
        onClearAll={onClearZones}
        orderCountByZone={countByZone}
        collapsed={zoneCollapsed}
        onToggleCollapse={toggleZoneCollapsed}
      />
    </div>
  );
}
