import { CopyCheck, Copy } from 'lucide-react';
import { useDedupEnabled } from '@/hooks/useDedupEnabled';
import { cn } from '@/lib/utils';

interface DedupToggleProps {
  hiddenCount: number;
  className?: string;
}

/**
 * Small inline toggle: when ON, the UI hides Priority-emitted duplicate rows
 * (same customer + phone + address + city, opened within ~5 minutes) and shows
 * a "x2" badge on the surviving row. Persisted across pages via localStorage.
 */
export function DedupToggle({ hiddenCount, className }: DedupToggleProps) {
  const [enabled, setEnabled] = useDedupEnabled();

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        enabled
          ? 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10'
          : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
        className
      )}
      title={enabled ? 'לחץ כדי להציג גם כפילויות' : 'לחץ כדי להסתיר כפילויות'}
    >
      {enabled ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {enabled ? (
        <span>
          סינון כפילויות פעיל
          {hiddenCount > 0 && <span className="mr-1 opacity-70">({hiddenCount} מוסתרות)</span>}
        </span>
      ) : (
        <span>מציג כפילויות</span>
      )}
    </button>
  );
}
