import { useMemo } from 'react';
import { useDedupedServiceCalls } from './useDedupedServiceCalls';
import { getZoneForCity, ZONES } from '@/types/zone';
import type { ServiceCall } from '@/types/service-call';

export interface ZonedServiceCallsResult {
  allCalls: ServiceCall[];
  pendingCalls: ServiceCall[];
  scheduledCalls: ServiceCall[];
  completedCalls: ServiceCall[];
  callCountByZone: Map<string, number>;
  callZoneMap: Map<string, string>;
  getCallZone: (callId: string) => string | undefined;
  /** callId → group size (>=2 = duplicate group). Empty when dedup is off. */
  groupSize: Map<string, number>;
  hiddenCount: number;
  isLoading: boolean;
  error: Error | null;
}

export function useZonedServiceCalls(): ZonedServiceCallsResult {
  const { calls, groupSize, hiddenCount, isLoading, error } = useDedupedServiceCalls();

  const result = useMemo(() => {
    const allCalls = calls;

    const callZoneMap = new Map<string, string>();
    for (const call of allCalls) {
      const zoneId = getZoneForCity(call.city);
      if (zoneId) {
        callZoneMap.set(call.id, zoneId);
      }
    }

    // טיוטא = טרם אושרה בפריוריטי, כמו בהזמנות (החלטת עידן 05/08/2026).
    // סטטוס ריק נספר כ"קריאה חדשה": קריאה בלי סטטוס אחרת לא נכנסת לאף
    // רשימה ונעלמת מכל המסכים בלי שגיאה (23 כאלה נמצאו ב-30/08/2026).
    const pendingCalls = allCalls.filter(
      (c) => (c.serviceCallStatus ?? 'קריאה חדשה') === 'קריאה חדשה' && c.priorityStatus !== 'טיוטא'
    );

    const scheduledCalls = allCalls.filter(
      (c) => c.serviceCallStatus === 'תואם ביקור'
    );

    const completedCalls = allCalls.filter(
      (c) => c.serviceCallStatus === 'בוצע'
    );

    const callCountByZone = new Map<string, number>();
    for (const zone of ZONES) {
      callCountByZone.set(zone.id, 0);
    }
    for (const call of pendingCalls) {
      const zoneId = callZoneMap.get(call.id);
      if (zoneId) {
        callCountByZone.set(zoneId, (callCountByZone.get(zoneId) ?? 0) + 1);
      }
    }

    const getCallZone = (callId: string) => callZoneMap.get(callId);

    return {
      allCalls,
      pendingCalls,
      scheduledCalls,
      completedCalls,
      callCountByZone,
      callZoneMap,
      getCallZone,
    };
  }, [calls]);

  return {
    ...result,
    groupSize,
    hiddenCount,
    isLoading,
    error,
  };
}
