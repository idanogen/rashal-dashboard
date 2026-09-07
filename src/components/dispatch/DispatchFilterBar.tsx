import { Search, X } from 'lucide-react';

import { ZoneFilter } from '@/components/deliveries/ZoneFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import { useRailSection } from '@/hooks/useRailSection';
import { railAnchorId, railScrollTo } from '@/lib/dispatch-rail-store';
import { HistoryStrip } from '@/components/dispatch/HistoryStrip';
import type { VisitPrefill } from '@/components/dispatch/UnscheduledPanel';

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
  /** תוצאות החיפוש לפי סוג מסמך, לרצועת התוצאות. ריק כשאין חיפוש. */
  breakdown?: Array<{ key: string; label: string; count: number }>;
  /** "שבץ ביקור" מרצועת ההיסטוריה: שיבוץ יזום ללקוח מוכר שאינו ברשימות. */
  onScheduleVisit?: (prefill: VisitPrefill) => void;
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
  breakdown = [],
  onScheduleVisit,
}: DispatchFilterBarProps) {
  // מסנן = סגור כברירת מחדל (החלטת עידן 06/09). v2 כדי שיחול גם על מי שכבר נגע בו.
  const [zoneCollapsed, toggleZoneCollapsed] = usePersistedCollapse(
    'collapse:dispatch-zone-filter:v2', true
  );

  const filtering = search.trim().length > 0 || selectedZones.length > 0;

  // במסילת הניווט: החץ של המסילה סוגר את סינון האזור, החיפוש נשאר תמיד.
  useRailSection({
    id: 'filters', title: 'חיפוש ואזורים', order: 20, tone: 'slate', icon: 'search',
    count: selectedZones.length || null, collapsed: zoneCollapsed, toggle: toggleZoneCollapsed,
  });

  return (
    <div id={railAnchorId('filters')} className="scroll-mt-32 space-y-2">
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

      {/* ⭐ רצועת התוצאות (עידן, 06/09/2026): כמה נמצאו ואיפה, בלחיצה אחת לכל מקום.
          תוצאה אחת = "נמצאה תוצאה אחת" והמסך כבר קפץ אליה. */}
      {search.trim().length >= 2 && breakdown.length > 0 && (() => {
        const total = breakdown.reduce((s, b) => s + b.count, 0);
        return (
          <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            total === 0 ? 'border-slate-200 bg-slate-50 text-slate-600' : total === 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}>
            <span className="font-semibold">
              {total === 0 ? `אין תוצאות ל"${search.trim()}"` : total === 1 ? 'נמצאה תוצאה אחת' : `${total} תוצאות ל"${search.trim()}"`}
            </span>
            {total > 0 && <span className="text-xs opacity-70">·</span>}
            {breakdown.map((b) => (
              <button
                key={b.key}
                type="button"
                disabled={b.count === 0}
                onClick={() => railScrollTo(`${b.key}-list`)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${
                  b.count === 0 ? 'cursor-default border-transparent text-slate-400' : 'border-current/30 bg-white hover:bg-white/70'
                }`}
                title={b.count ? `קפוץ ל${b.label}` : undefined}
              >
                {b.label}
                <span className={`rounded-full px-1.5 font-semibold tabular-nums ${b.count ? 'bg-current/10' : ''}`}>{b.count}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* ⭐ היסטוריה אחת (07/09/2026): מי מוכר לנו בשם הזה, מכל השנים, גם כשיש ממתינים. */}
      <HistoryStrip query={search} onScheduleVisit={onScheduleVisit} />

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
