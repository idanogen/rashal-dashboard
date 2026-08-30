import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, Phone, Hash, FileText, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CustomerCard } from '@/components/customer/CustomerCard';
import { LastVisitBadge } from '@/components/customer/LastVisitBadge';
import { searchCustomers, customerSearchKey, type CustomerHit } from '@/lib/customer-card';

/**
 * כרטיס לקוח מאוחד · `/customer`
 *
 * ⭐ **נקודת הכניסה כשלקוח מתקשר.** חיפוש אחד לפי טלפון, שם, מספר לקוח
 * או מספר מסמך, ואז כל התיק במסך אחד.
 *
 * 🔴 **וכשאותו טלפון שייך לשני לקוחות, המסך שואל ולא מנחש.** נמדד
 * ב-24/08/2026: מתוך 4,853 מספרים, 79 משותפים לשניים או שלושה לקוחות.
 * ניחוש שם היה פותח את התיק של אדם אחר.
 */

const KIND_ICON: Record<string, typeof Phone> = {
  phone: Phone,
  'phone-part': Phone,
  number: Hash,
  document: FileText,
  name: User,
};

const KIND_TEXT: Record<string, string> = {
  phone: 'לפי טלפון',
  'phone-part': 'לפי חלק ממספר',
  number: 'לפי מספר לקוח',
  document: 'לפי מספר מסמך',
  name: 'לפי שם',
};

function HitRow({ hit, active, onClick }: { hit: CustomerHit; active: boolean; onClick: () => void }) {
  const Icon = KIND_ICON[hit.match_kind] ?? User;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-2 text-start transition ${
        active ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-slate-900">{hit.customer_name || 'ללא שם'}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground"><bdi>{hit.customer_number}</bdi></span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{KIND_TEXT[hit.match_kind] ?? ''}</span>
        {hit.phone && <bdi className="font-mono">{hit.phone}</bdi>}
        {hit.city && <span>· {hit.city}</span>}
      </div>
      {hit.last_visit_date && (
        <LastVisitBadge
          date={hit.last_visit_date}
          driver={hit.last_visit_driver}
          outcome={hit.last_visit_outcome}
        />
      )}
    </button>
  );
}

export function CustomerPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const selectedNum = params.get('c');
  const selectedPhone = params.get('phone');

  // ⭐ השהיה קצרה: הנציג מקליד תוך כדי שיחה, ואין טעם לשאול על כל תו.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const search = useQuery({
    queryKey: customerSearchKey(debounced),
    queryFn: () => searchCustomers(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60 * 1000,
  });

  const hits = useMemo(() => search.data ?? [], [search.data]);

  // 🔴 **בחירה אוטומטית רק כשיש תוצאה אחת.** שתיים ומעלה פירושן שאלה
  // לנציג, לא ניחוש: אלה שני אנשים שונים.
  useEffect(() => {
    if (hits.length === 1 && !selectedNum && !selectedPhone) {
      const only = hits[0];
      setParams({ q: debounced, c: only.customer_number ?? '', phone: only.phone_local ?? '' }, { replace: true });
    }
  }, [hits, selectedNum, selectedPhone, debounced, setParams]);

  const pick = (h: CustomerHit) =>
    setParams({ q, c: h.customer_number ?? '', phone: h.phone_local ?? '' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">כרטיס לקוח</h1>
        <p className="text-sm text-muted-foreground">כל הפעילות של הלקוח במקום אחד, מפריוריטי ומהמערכת שלנו</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="שם · מספר לקוח · טלפון · מספר מסמך"
          className="h-11 ps-9 text-[15px]"
        />
        {search.isFetching && (
          <Loader2 className="absolute inset-inline-end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {debounced.length >= 2 && hits.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            {hits.length} לקוחות מתאימים. בחר את הנכון.
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {hits.map((h) => (
              <HitRow
                key={h.customer_number ?? h.phone_local ?? ''}
                hit={h}
                active={h.customer_number === selectedNum}
                onClick={() => pick(h)}
              />
            ))}
          </div>
        </div>
      )}

      {debounced.length >= 2 && !search.isFetching && hits.length === 0 && (
        <div className="rounded-xl border bg-slate-50 p-6 text-center text-sm text-muted-foreground">
          לא נמצא לקוח שמתאים ל"{debounced}".
        </div>
      )}

      {(selectedNum || selectedPhone) && (
        <CustomerCard customerNumber={selectedNum || null} phone={selectedPhone || null} />
      )}

      {!selectedNum && !selectedPhone && debounced.length < 2 && (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">
          הקלד טלפון, שם או מספר מסמך כדי לפתוח כרטיס.
        </div>
      )}
    </div>
  );
}
