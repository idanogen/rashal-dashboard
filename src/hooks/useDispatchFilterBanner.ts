import { useCallback, useMemo } from 'react';

import { useActiveFilters } from '@/hooks/useActiveFilters';
import { useDedupEnabled } from '@/hooks/useDedupEnabled';
import { countFromToday, defaultHidings, type DefaultKey, type FilterKey } from '@/lib/active-filters';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { isOldRed, LIGHT_LABEL, type ServiceCallLight, type ServiceLight } from '@/lib/service-call-light';
import { getZoneById } from '@/types/zone';
import { isBareCustomer, type NewCustomer } from '@/types/customer';
import type { CalendarStop } from '@/types/calendar-stop';
import type { CalendarStopSource } from '@/types/delivery';

type Tab = 'all' | 'deliveries' | 'service' | 'pickups' | 'customers';

/** כל מה שמסנן או מסתיר במסך הסדרן, עם הפעולות שמבטלות אותו. */
export interface DispatchFilterInputs {
  tab: Tab;
  search: string;
  setSearch: (v: string) => void;
  zones: string[];
  setZones: (v: string[]) => void;
  fundLabel: string | null;
  clearFund: () => void;
  lights: Set<ServiceLight>;
  setLights: (v: Set<ServiceLight>) => void;
  showOldRed: boolean;
  setShowOldRed: (v: boolean) => void;
  onlyBare: boolean;
  setOnlyBare: (v: boolean) => void;
  hiddenTypeLabels: string[];
  showAllTypes: () => void;
  isTypeVisible: (s: { sourceType: CalendarStopSource }) => boolean;
  calendarSearch: string;
  setCalendarSearch: (v: string) => void;
  allCalendarStops: CalendarStop[];
  searchedCalendarStops: CalendarStop[];
  /** ממתינים בלי שום סינון, לכל סוג */
  totals: { deliveries: number; service: number; pickups: number; customers: NewCustomer[] };
  /** קריאות וללקוחות אחרי סינון הקופה, לספירת הסתרות ברירת המחדל */
  pendingCallIds: string[];
  pendingCustomers: NewCustomer[];
  callLights: Map<string, ServiceCallLight> | undefined;
  pendingShown: number;
  ordersHiddenCount: number;
  callsHiddenCount: number;
}

/**
 * פס "המסך מסונן" (22/11/2026): הסינונים שהמשתמש בחר והסתרות ברירת המחדל,
 * עם הספירות והביטולים. הוצא מ-DispatchPage כדי שהקובץ לא יגדל.
 */
export function useDispatchFilterBanner(i: DispatchFilterInputs) {
  const [dedup, setDedup] = useDedupEnabled();
  const on = (t: Tab[]) => i.tab === 'all' || t.includes(i.tab);

  const defaults = useMemo(() => {
    const withOrder = i.onlyBare && on(['customers'])
      ? i.pendingCustomers.length - i.pendingCustomers.filter(isBareCustomer).length
      : 0;
    const redShown = i.lights.size === 0 || i.lights.has('red');
    const oldRed = !i.showOldRed && redShown && i.callLights && on(['service'])
      ? i.pendingCallIds.filter((id) => {
          const l = i.callLights?.get(id);
          return !!l && isOldRed(l);
        }).length
      : 0;
    const duplicates = dedup
      ? (on(['deliveries']) ? i.ordersHiddenCount : 0) + (on(['service']) ? i.callsHiddenCount : 0)
      : 0;
    return defaultHidings({ withOrder, oldRed, duplicates });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on() נגזר מ-i.tab
  }, [i.tab, i.onlyBare, i.pendingCustomers, i.showOldRed, i.lights, i.callLights, i.pendingCallIds, dedup,
    i.ordersHiddenCount, i.callsHiddenCount]);

  const pendingTotal = useMemo(() => {
    const t = i.totals;
    const customers = (i.onlyBare ? t.customers.filter(isBareCustomer) : t.customers).length;
    const n = { deliveries: t.deliveries, service: t.service, pickups: t.pickups, customers };
    return i.tab === 'all' ? n.deliveries + n.service + n.pickups + n.customers : n[i.tab];
  }, [i.tab, i.onlyBare, i.totals]);

  const calendarHidden = useMemo(() => {
    const today = toLocalDateStr(new Date());
    const shown = countFromToday(i.searchedCalendarStops, today, i.isTypeVisible);
    return countFromToday(i.allCalendarStops, today) - shown;
  }, [i.allCalendarStops, i.searchedCalendarStops, i.isTypeVisible]);

  const state = useMemo(
    () => ({
      search: i.search,
      zoneLabels: i.zones.map((z) => getZoneById(z)?.name ?? 'חסרה כתובת'),
      fundLabel: i.fundLabel,
      hiddenTypeLabels: i.hiddenTypeLabels,
      calendarSearch: i.calendarSearch,
      lightLabels: [...i.lights].map((l) => LIGHT_LABEL[l]),
      defaultsOn: defaults.map((d) => d.key),
    }),
    [i.search, i.zones, i.fundLabel, i.hiddenTypeLabels, i.calendarSearch, i.lights, defaults]
  );
  const counts = useMemo(
    () => ({ pendingShown: i.pendingShown, pendingTotal, calendarHidden }),
    [i.pendingShown, pendingTotal, calendarHidden]
  );
  const { filters, summary } = useActiveFilters(state, counts);

  const { setSearch, setZones, clearFund, setLights, showAllTypes, setCalendarSearch } = i;
  const clearFilter = useCallback(
    (key: FilterKey) => {
      if (key === 'fund') clearFund();
      else if (key === 'zones') setZones([]);
      else if (key === 'lights') setLights(new Set());
      else if (key === 'types') showAllTypes();
      else if (key === 'search') setSearch('');
      else setCalendarSearch('');
    },
    [clearFund, setZones, setLights, showAllTypes, setSearch, setCalendarSearch]
  );
  const clearAll = useCallback(() => {
    for (const key of ['fund', 'zones', 'lights', 'types', 'search', 'calendarSearch'] as const) clearFilter(key);
  }, [clearFilter]);

  const { setOnlyBare, setShowOldRed } = i;
  const showDefault = useCallback(
    (key: DefaultKey) => {
      if (key === 'withOrder') setOnlyBare(false);
      else if (key === 'oldRed') setShowOldRed(true);
      else setDedup(false);
    },
    [setOnlyBare, setShowOldRed, setDedup]
  );

  return { filters, summary, defaults, clearFilter, clearAll, showDefault };
}
