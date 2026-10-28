import { Check, MessageCircle, X } from 'lucide-react';
import type { CalendarStop } from '@/types/delivery';

/** שורת הפעולות של כרטיס העצירה ביומן: תיאום, בוצע, לא בוצע. */
export function StopCardActions({ stop, isResolved, onCoordinate, onResolve }: {
  stop: CalendarStop;
  isResolved: boolean;
  onCoordinate?: (stop: CalendarStop) => void;
  onResolve?: (stopId: string, status: 'completed' | 'not_completed') => void;
}) {
  return (
    <>
      {/* Action buttons row — bigger and on their own line for easier tap */}
      {!isResolved && (onCoordinate || onResolve) && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40">
          {onCoordinate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCoordinate(stop);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs font-semibold text-emerald-700
                hover:bg-emerald-500/20 transition-colors"
              title="שלח תיאום ללקוח"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              תיאום
            </button>
          )}
          {onResolve && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(stop.stopId, 'completed');
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs font-semibold text-emerald-700
                  hover:bg-emerald-500/20
                  dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors"
                title="סמן כבוצע"
              >
                <Check className="h-3.5 w-3.5" />
                בוצע
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(stop.stopId, 'not_completed');
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 rounded-md bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-700
                  hover:bg-red-500/20
                  dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                title="סמן כלא בוצע"
              >
                <X className="h-3.5 w-3.5" />
                לא בוצע
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
