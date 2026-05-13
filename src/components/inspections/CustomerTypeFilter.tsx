import { cn } from '@/lib/utils';

export const CUSTOMER_TYPES_ORDER = [
  'כללית הנדסה',
  'משרד הבריאות',
  'מכבי',
  'מאוחדת',
  'לאומית',
  'אחר',
] as const;

export type CustomerTypeKey = typeof CUSTOMER_TYPES_ORDER[number] | 'הכל';

interface CustomerTypeFilterProps {
  value: CustomerTypeKey;
  onChange: (value: CustomerTypeKey) => void;
  countByType: Record<string, number>;
  totalCount: number;
}

export function CustomerTypeFilter({
  value,
  onChange,
  countByType,
  totalCount,
}: CustomerTypeFilterProps) {
  const tabs: Array<{ key: CustomerTypeKey; label: string; count: number }> = [
    { key: 'כללית הנדסה', label: 'כללית', count: countByType['כללית הנדסה'] ?? 0 },
    { key: 'הכל', label: 'הכל', count: totalCount },
    { key: 'משרד הבריאות', label: 'משרד הבריאות', count: countByType['משרד הבריאות'] ?? 0 },
    { key: 'מכבי', label: 'מכבי', count: countByType['מכבי'] ?? 0 },
    { key: 'מאוחדת', label: 'מאוחדת', count: countByType['מאוחדת'] ?? 0 },
    { key: 'לאומית', label: 'לאומית', count: countByType['לאומית'] ?? 0 },
    { key: 'אחר', label: 'אחר', count: countByType['אחר'] ?? 0 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'mr-1.5 inline-flex items-center justify-center rounded px-1.5 text-xs',
                active ? 'bg-primary-foreground/20' : 'bg-background/60'
              )}
            >
              {tab.count.toLocaleString('he-IL')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
