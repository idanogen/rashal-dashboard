import { useMemo } from 'react';
import { useOrders } from './useOrders';
import { useDedupEnabled } from './useDedupEnabled';
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

    // Count duplicates per head
    const childCount = new Map<string, number>();
    for (const o of raw) {
      if (o.duplicateOf) {
        childCount.set(o.duplicateOf, (childCount.get(o.duplicateOf) ?? 0) + 1);
      }
    }

    const heads = raw.filter((o) => !o.duplicateOf);
    const groupSize = new Map<string, number>();
    for (const [headId, n] of childCount.entries()) {
      groupSize.set(headId, n + 1); // +1 for the head itself
    }

    return {
      rawOrders: raw,
      orders: heads,
      groupSize,
      hiddenCount: raw.length - heads.length,
      isLoading,
      error: (error as Error) ?? null,
      refetch: refetchFn,
    };
  }, [data, enabled, isLoading, error, refetch]);
}
