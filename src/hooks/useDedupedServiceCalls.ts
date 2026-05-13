import { useMemo } from 'react';
import { useServiceCalls } from './useServiceCalls';
import { useDedupEnabled } from './useDedupEnabled';
import type { ServiceCall } from '@/types/service-call';

export interface DedupedServiceCallsResult {
  rawCalls: ServiceCall[];
  calls: ServiceCall[];
  groupSize: Map<string, number>;
  hiddenCount: number;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Service-call duplicates are tagged in the DB via `duplicate_of` (set by the
 * `mark_new_service_call_as_duplicate` trigger + backfill). We just project.
 */
export function useDedupedServiceCalls(): DedupedServiceCallsResult {
  const { data, isLoading, error } = useServiceCalls();
  const [enabled] = useDedupEnabled();

  return useMemo(() => {
    const raw = data ?? [];

    if (!enabled) {
      return {
        rawCalls: raw,
        calls: raw,
        groupSize: new Map(),
        hiddenCount: 0,
        isLoading,
        error: (error as Error) ?? null,
      };
    }

    const childCount = new Map<string, number>();
    for (const c of raw) {
      if (c.duplicateOf) {
        childCount.set(c.duplicateOf, (childCount.get(c.duplicateOf) ?? 0) + 1);
      }
    }

    const heads = raw.filter((c) => !c.duplicateOf);
    const groupSize = new Map<string, number>();
    for (const [headId, n] of childCount.entries()) {
      groupSize.set(headId, n + 1);
    }

    return {
      rawCalls: raw,
      calls: heads,
      groupSize,
      hiddenCount: raw.length - heads.length,
      isLoading,
      error: (error as Error) ?? null,
    };
  }, [data, enabled, isLoading, error]);
}
