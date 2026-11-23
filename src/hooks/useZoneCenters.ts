import { CITY_TO_ZONE } from '@/types/zone';
import { useCityCenters } from './useCityCenters';

/**
 * ממלא את מרכזי היישובים של הרשומות ושל ערי הרשימה, כדי ש-getZoneForCity ייתן
 * אזור גם ליישוב שלא ברשימה (העיר הקרובה). מחזיר מונה לתלות של useMemo.
 */
export function useZoneCenters(cities: (string | null | undefined)[]): number {
  return useCityCenters([...Object.keys(CITY_TO_ZONE), ...cities]);
}
