import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEALTH_FUND_LABEL, type HealthFundKey } from '@/lib/health-fund';
import clalit from '@/assets/forms/clalit-logo.png';
import maccabi from '@/assets/forms/maccabi-logo.png';
import leumit from '@/assets/forms/leumit-logo.png';
import meuhedet from '@/assets/forms/meuhedet-logo.png';
import moh from '@/assets/forms/moh-logo-plain.png';

/**
 * צ'יפים של הקופות ליד הרמזורים (עידן, 04/11/2026): קופה אחת או אף אחת, "שעיצובית
 * זה יהיה יפה, אולי הכפתור עם הלוגו של הקופה". הלוגו הוא אותו קובץ של הטפסים.
 * הבחירה מסננת את כל המסך (DispatchPage), כאן רק הציור.
 */
const LOGO: Partial<Record<HealthFundKey, string>> = { clalit, maccabi, leumit, meuhedet, moh };

export interface HealthFundFilterProps {
  counts: Array<{ key: HealthFundKey; count: number }>;
  selected: HealthFundKey | null;
  onSelect: (key: HealthFundKey | null) => void;
}

export function HealthFundFilter({ counts, selected, onSelect }: HealthFundFilterProps) {
  if (!counts.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="סינון לפי קופה">
      <span className="text-xs font-medium text-muted-foreground">קופה:</span>
      {counts.map(({ key, count }) => {
        const on = selected === key;
        const logo = LOGO[key];
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(on ? null : key)}
            title={on ? `הצג את כל הקופות` : `הצג רק ${HEALTH_FUND_LABEL[key]}`}
            className={cn(
              'flex h-9 items-center gap-2 rounded-full border bg-white px-3 text-xs font-semibold transition-all',
              on
                ? 'border-slate-900 shadow-md ring-2 ring-slate-900/10'
                : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:shadow-sm',
              selected && !on && 'opacity-55 grayscale'
            )}
          >
            {logo ? (
              <img src={logo} alt="" className="h-4 w-auto max-w-[64px] object-contain" />
            ) : (
              <span>{HEALTH_FUND_LABEL[key]}</span>
            )}
            <span className={cn('tabular-nums', on ? 'text-slate-900' : 'text-slate-400')}>{count}</span>
            {on && <X className="h-3.5 w-3.5 text-slate-500" />}
          </button>
        );
      })}
    </div>
  );
}
