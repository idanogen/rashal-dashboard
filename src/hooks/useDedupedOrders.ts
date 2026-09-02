import { useMemo } from 'react';
import { useOrders } from './useOrders';
import { useDedupEnabled } from './useDedupEnabled';
import { resolveDedupGroups } from '@/lib/dedup-heads';
import { ORDER_CLOSED, PRIORITY_ORDER_CLOSED } from '@/lib/constants';
import type { Order } from '@/types/order';

export interface DedupedOrdersResult {
  /** Raw orders from Supabase (heads + duplicates), no dedup applied */
  rawOrders: Order[];
  /** Orders to display — heads only when the flag is on, identical to raw when off */
  orders: Order[];
  /** orderId → group size (head row + its dupes). Empty when dedup is off. */
  groupSize: Map<string, number>;
  /** How many rows were hidden by dedup (0 when dedup is off) */
  hiddenCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The DB marks Priority-emitted duplicates with `duplicate_of`. We rely on that
 * field — set by `mark_new_order_as_duplicate` trigger + backfill — instead of
 * recomputing in the client.
 */
export function useDedupedOrders(): DedupedOrdersResult {
  const { data, isLoading, error, refetch } = useOrders();
  const [enabled] = useDedupEnabled();

  return useMemo(() => {
    const raw = data ?? [];
    const refetchFn = () => { void refetch(); };

    if (!enabled) {
      return {
        rawOrders: raw,
        orders: raw,
        groupSize: new Map(),
        hiddenCount: 0,
        isLoading,
        error: (error as Error) ?? null,
        refetch: refetchFn,
      };
    }

    // הכפיל יורד מהמסך רק כל עוד יש לו מייצג פתוח. ראש שנסגר או שאורכב
    // היה מוריד איתו עבודה פתוחה, ולכן הכלל יושב ב-resolveDedupGroups.
    const { heads, groupSize, hiddenCount } = resolveDedupGroups(raw, {
      getId: (o) => o.id,
      getDuplicateOf: (o) => o.duplicateOf,
      isOpen: (o) => !ORDER_CLOSED.includes(o.orderStatus as (typeof ORDER_CLOSED)[number]),
      isOpenInPriority: (o) =>
        !!o.priorityStatus &&
        !PRIORITY_ORDER_CLOSED.includes(o.priorityStatus as (typeof PRIORITY_ORDER_CLOSED)[number]),
    });

    return {
      rawOrders: raw,
      orders: heads,
      groupSize,
      hiddenCount,
      isLoading,
      error: (error as Error) ?? null,
      refetch: refetchFn,
    };
  }, [data, enabled, isLoading, error, refetch]);
}
