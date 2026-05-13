import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'rashal:dedup-enabled';

function readInitial(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

/**
 * Global flag persisted in localStorage: when true (default) the UI hides
 * Priority-emitted duplicate rows. Components subscribe via a `storage` event
 * so toggling on one page updates every other page in the same window.
 */
export function useDedupEnabled() {
  const [enabled, setEnabled] = useState<boolean>(readInitial);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setEnabled(e.newValue === '1');
    }
    function handleLocalChange(e: Event) {
      const detail = (e as CustomEvent<boolean>).detail;
      setEnabled(detail);
    }
    window.addEventListener('storage', handleStorage);
    window.addEventListener('rashal:dedup-toggle', handleLocalChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('rashal:dedup-toggle', handleLocalChange as EventListener);
    };
  }, []);

  const setEnabledPersisted = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    setEnabled(next);
    // Notify other components in the same window (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent('rashal:dedup-toggle', { detail: next }));
  }, []);

  return [enabled, setEnabledPersisted] as const;
}
