import { useEffect, useState } from 'react';
import { primeCityCenters } from '@/lib/city-centers';

/**
 * ממלא את מטמון מרכזי היישובים לשמות שעוד לא נשאלו, ומחזיר מונה שעולה
 * כשנוסף משהו, כדי ש-useMemo שקורא ל-getCityCoordinates יחושב מחדש.
 */
export function useCityCenters(cities: (string | null | undefined)[]): number {
  const [version, setVersion] = useState(0);
  const key = [...new Set(cities.filter(Boolean))].sort().join('|');
  useEffect(() => {
    let alive = true;
    primeCityCenters(key ? key.split('|') : []).then((added) => {
      if (alive && added) setVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return version;
}
