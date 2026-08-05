import { Button } from '@/components/ui/button';

interface LoadMoreProps {
  /** how many rows are currently rendered */
  shown: number;
  /** how many rows match the active filters */
  matched: number;
  /** how many rows exist before filtering */
  total: number;
  /** plural noun for the row type, e.g. "הזמנות" */
  noun: string;
  onMore: () => void;
  onAll: () => void;
}

/**
 * Footer for long lists that render in chunks: shows the counts and offers to
 * render more. Nothing is hidden from the data set — only from the DOM.
 */
export function LoadMore({ shown, matched, total, noun, onMore, onAll }: LoadMoreProps) {
  const hasMore = shown < matched;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <p className="text-xs text-muted-foreground">
        מציג <bdi>{shown}</bdi> מתוך <bdi>{matched}</bdi> {noun}
        {matched < total && (
          <span className="text-muted-foreground/70">
            {' '}
            (מסונן מתוך <bdi>{total}</bdi>)
          </span>
        )}
      </p>
      {hasMore && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onMore}>
            הצג עוד
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAll}>
            הצג הכל (<bdi>{matched}</bdi>)
          </Button>
        </div>
      )}
    </div>
  );
}
