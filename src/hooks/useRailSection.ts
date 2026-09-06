import { useEffect } from 'react';
import { railRegister, railUnregister, type RailSection } from '@/lib/dispatch-rail-store';

/**
 * רישום אזור במסילת הניווט של מסך הסדרן. נקרא מתוך האזור עצמו, עם
 * הספירה ומצב הקיפול שלו; ביטול הרישום כשהאזור יורד מהמסך.
 */
export function useRailSection(section: RailSection | null) {
  const id = section?.id;
  useEffect(() => {
    if (section) railRegister(section);
  });
  useEffect(() => () => { if (id) railUnregister(id); }, [id]);
}
