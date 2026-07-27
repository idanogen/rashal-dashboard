import { useState, useCallback } from 'react';

/**
 * מצב כיווץ של אזור במסך, נשמר ב-localStorage כדי לשרוד רענון ומעבר בין טאבים.
 * key ייחודי לכל אזור (למשל 'collapse:orders-returned').
 */
export function usePersistedCollapse(
  key: string,
  defaultCollapsed = false
): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultCollapsed : raw === '1';
    } catch {
      return defaultCollapsed;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // localStorage לא זמין — נמשיך עם state בזיכרון בלבד
      }
      return next;
    });
  }, [key]);

  return [collapsed, toggle];
}
