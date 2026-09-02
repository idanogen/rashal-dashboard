import { useMemo } from 'react';
import { useServiceCalls } from './useServiceCalls';
import { useDedupEnabled } from './useDedupEnabled';
import { resolveDedupGroups } from '@/lib/dedup-heads';
import { CALL_CLOSED, PRIORITY_CALL_CLOSED } from '@/lib/constants';
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

    // אותו כלל כמו בהזמנות: כפיל שאיבד את המייצג הפתוח שלו חוזר לרשימה.
    const { heads, groupSize, hiddenCount } = resolveDedupGroups(raw, {
      getId: (c) => c.id,
      getDuplicateOf: (c) => c.duplicateOf,
      isOpen: (c) => !CALL_CLOSED.includes(c.serviceCallStatus as (typeof CALL_CLOSED)[number]),
      isOpenInPriority: (c) =>
        !!c.priorityStatus &&
        !PRIORITY_CALL_CLOSED.includes(c.priorityStatus as (typeof PRIORITY_CALL_CLOSED)[number]),
    });

    return {
      rawCalls: raw,
      calls: heads,
      groupSize,
      hiddenCount,
      isLoading,
      error: (error as Error) ?? null,
    };
  }, [data, enabled, isLoading, error]);
}
