import { cn } from '@/lib/utils';
import {
  LIGHT_HINT,
  LIGHT_LABEL,
  LIGHT_ORDER,
  type LightCounts,
  type ServiceLight,
} from '@/lib/service-call-light';

const BULB: Record<ServiceLight, string> = {
  red: 'bg-red-600',
  green: 'bg-green-600',
  orange: 'bg-orange-600',
  yellow: 'bg-yellow-400',
};
const ON_RING: Record<ServiceLight, string> = {
  red: 'ring-red-300 bg-red-50/60',
  green: 'ring-green-300 bg-green-50/60',
  orange: 'ring-orange-300 bg-orange-50/60',
  yellow: 'ring-yellow-300 bg-yellow-50/60',
};
/** סדר הרמזור על המסך (ימין לשמאל): אדום, ירוק, כתום, צהוב, כמו במוקאפ. */
const DISPLAY: ServiceLight[] = ['red', 'green', 'orange', 'yellow'];

interface ServiceTrafficLightProps {
  counts: LightCounts;
  /** אילו צבעים מוצגים ברשימה. ריק = הכל. */
  selected: Set<ServiceLight>;
  onToggle: (light: ServiceLight) => void;
  showOldRed: boolean;
  onToggleOldRed: () => void;
}

/**
 * ⭐ הרמזור בראש לשונית קריאות השירות (עידן, 15/09/2026).
 * לחיצה על צבע מסננת את הרשימה; לחיצה נוספת מחזירה. האדום מפולח לפי ותק,
 * והוותיקות (מעל שבועיים) מוסתרות עד שמבקשים, כדי שלא יטביעו את החדשות.
 */
export function ServiceTrafficLight({ counts, selected, onToggle, showOldRed, onToggleOldRed }: ServiceTrafficLightProps) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" dir="rtl">
      {DISPLAY.map((light) => {
        const on = selected.has(light);
        return (
          <button
            key={light}
            type="button"
            onClick={() => onToggle(light)}
            aria-pressed={on}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-start transition-shadow hover:shadow-md',
              on && `ring-2 ${ON_RING[light]}`,
            )}
          >
            <span className={cn('h-9 w-9 shrink-0 rounded-full shadow-inner', BULB[light])} aria-hidden />
            <span className="min-w-0">
              <span className="block text-2xl font-extrabold leading-none text-slate-900">
                <bdi>{counts[light]}</bdi>
              </span>
              <span className="block text-[13px] font-bold text-slate-900">{LIGHT_LABEL[light]}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{LIGHT_HINT[light]}</span>
              {light === 'red' && counts.red > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-full bg-red-50 px-1.5 text-[10.5px] text-red-700">השבוע <bdi>{counts.redWeek}</bdi></span>
                  <span className="rounded-full bg-red-50 px-1.5 text-[10.5px] text-red-700">שבוע שעבר <bdi>{counts.redLastWeek}</bdi></span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleOldRed();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        onToggleOldRed();
                      }
                    }}
                    className={cn(
                      'rounded-full px-1.5 text-[10.5px] underline-offset-2 hover:underline',
                      showOldRed ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700',
                    )}
                    title={showOldRed ? 'הסתר ותיקות משבועיים' : 'הצג גם ותיקות משבועיים'}
                  >
                    ותיקות <bdi>{counts.redOld}</bdi> {showOldRed ? '▾' : '▸'}
                  </span>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { LIGHT_ORDER };
