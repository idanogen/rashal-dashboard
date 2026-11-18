import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArrowRight } from 'lucide-react';
import { ArchiveSection, type ArchiveKind } from '@/components/archive/ArchiveSection';
import { fetchArchivedCalls, restoreArchivedCall } from '@/lib/calls-archive';
import { archiveReasonLabel } from '@/lib/calls-archive-rules';
import { fetchArchivedOrders, restoreArchivedOrder } from '@/lib/orders-archive';
import { orderArchiveReasonLabel } from '@/lib/orders-archive-rules';

const KINDS: Record<'calls' | 'orders', ArchiveKind & { tab: string; intro: string }> = {
  calls: {
    tab: 'קריאות שירות',
    intro: 'ברשימת הקריאות נשארות רק "לביצוע" ו"להמשך טיפול". כל השאר כאן, ואפשר להחזיר כל קריאה לרשימה.',
    queryKey: ['callsArchive'],
    liveKey: ['serviceCalls'],
    fetch: fetchArchivedCalls,
    restore: restoreArchivedCall,
    label: archiveReasonLabel,
    noun: 'קריאות',
    restoredTo: 'רשימת הקריאות',
    placeholder: "חיפוש שם / מספר קריאה / מס' לקוח / טלפון / עיר…",
  },
  orders: {
    tab: 'הזמנות',
    intro:
      'הזמנה שבפריוריטי כבר בוצעה או שולמה ועברו 30 יום בלי שיבוץ, או מאושרת לבצוע מעל 90 יום, עוברת לכאן כל בוקר. אפשר להחזיר כל הזמנה לרשימה.',
    queryKey: ['ordersArchive'],
    liveKey: ['orders'],
    fetch: fetchArchivedOrders,
    restore: restoreArchivedOrder,
    label: orderArchiveReasonLabel,
    noun: 'הזמנות',
    restoredTo: 'הזמנות ממתינות לתיאום',
    placeholder: "חיפוש שם / מספר הזמנה / מס' לקוח / טלפון / עיר…",
  },
};

/**
 * טענה: "מה שירד מהרשימות לא נעלם, והחזרה היא לחיצה אחת" (עידן, 18/11/2026).
 * שתי לשוניות: קריאות שירות והזמנות. הלשונית בכתובת (?tab=orders), כדי שקישור יפתח אותה.
 */
export function CallsArchivePage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'orders' ? 'orders' : 'calls';
  const kind = KINDS[tab];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link to="/dispatch" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-3.5 w-3.5" />
          חזרה למסך הסדרן
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Archive className="h-5 w-5 text-muted-foreground" />
          ארכיון
        </h1>
      </div>

      <div className="flex gap-1 border-b" role="tablist">
        {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setParams(k === 'calls' ? {} : { tab: k }, { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === k ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {KINDS[k].tab}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{kind.intro}</p>
      <ArchiveSection key={tab} kind={kind} />
    </div>
  );
}
