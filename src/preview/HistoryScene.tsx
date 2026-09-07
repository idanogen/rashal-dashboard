import { Package } from 'lucide-react';
import { HistoryStripView } from '@/components/dispatch/HistoryStrip';
import { DispatchCard, type DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import type { HistoryHit } from '@/lib/history-line';

/**
 * ?view=history: רצועת "בהיסטוריה" בחיפוש "חייט" (הנתונים האמיתיים מ-07/09/2026),
 * ושלושה כרטיסים עם שורת "ביקור אחרון" בשלושת המצבים.
 */
const HITS: HistoryHit[] = [
  { customerNumber: '05472701', customerName: 'חייט יעקב', phone: '0523456789', city: 'תל אביב', lastVisitDate: null, lastVisitDriver: null, lastVisitOutcome: null, lastOrderDate: '2026-07-28', lastOrderStatus: 'ממתין לתאום', lastOrderRef: 'SO2602911', lastCallDate: null, lastCallStatus: null, lastCallRef: null, lastCallBy: null, lastCallType: null, lastNoteDate: null, openOrders: 1, openCalls: 0, deliveries: 0 },
  { customerNumber: '325938827', customerName: 'חייט שי', phone: '0541112233', city: 'חולון', lastVisitDate: null, lastVisitDriver: null, lastVisitOutcome: null, lastOrderDate: '2024-01-02', lastOrderStatus: 'סופק', lastOrderRef: 'SO2400119', lastCallDate: null, lastCallStatus: null, lastCallRef: null, lastCallBy: null, lastCallType: null, lastNoteDate: null, openOrders: 0, openCalls: 0, deliveries: 0 },
  { customerNumber: '008511305', customerName: 'ביבר חייטוב רות', phone: '0509876543', city: 'ירושלים', lastVisitDate: '2026-08-14', lastVisitDriver: 'רודי', lastVisitOutcome: 'completed', lastOrderDate: '2025-05-20', lastOrderStatus: 'סופק', lastOrderRef: 'SO2501120', lastCallDate: '2026-03-11', lastCallStatus: 'בוצע', lastCallRef: 'SC2600812', lastCallBy: 'ישראל', lastCallType: 'פרונטלית', lastNoteDate: '2025-05-22', openOrders: 0, openCalls: 0, deliveries: 2 },
  { customerNumber: '301138640', customerName: 'חייט שירן', phone: '0528765432', city: 'באר שבע', lastVisitDate: null, lastVisitDriver: null, lastVisitOutcome: null, lastOrderDate: '2021-11-22', lastOrderStatus: 'סופק', lastOrderRef: 'SO2100911', lastCallDate: '2026-02-03', lastCallStatus: 'קריאה חדשה', lastCallRef: 'SC2600302', lastCallBy: null, lastCallType: 'פרונטלית', lastNoteDate: null, openOrders: 0, openCalls: 1, deliveries: 0 },
];

function vm(id: string, name: string, num: string, city: string): DispatchItemVM {
  return {
    id, dragId: `order-${id}`, dragData: { type: 'order' }, zoneId: 'z', customerName: name, customerNumber: num,
    phone: '052-345-6789', addressLine: `שדרות ירושלים 12, ${city}`, created: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    searchText: name, meta: <p className="text-xs text-muted-foreground">כרית אוויר · 1</p>,
  };
}

export function HistoryScene() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-xs text-slate-500">רצועת "בהיסטוריה" מתחת לחיפוש "חייט"</p>
        <HistoryStripView hits={HITS} onScheduleVisit={() => undefined} />
        <p className="pt-2 text-xs text-slate-500">שורת "ביקור אחרון" על הכרטיס, בשלושת המצבים</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DispatchCard vm={vm('a', 'ביבר חייטוב רות', '008511305', 'ירושלים')} accentBorder="border-s-blue-500"
            lastTouch={{ visits: 3, lastVisitDate: '2026-08-14', lastVisitDriver: 'רודי', lastVisitOutcome: 'completed', deliveries: 3, lastDeliveryDate: '2026-08-14', callsDone: 1, lastCallDate: '2026-03-11', lastCallBy: 'ישראל' }} />
          <DispatchCard vm={vm('b', 'חייט שי', '325938827', 'חולון')} accentBorder="border-s-blue-500"
            lastTouch={{ visits: 1, lastVisitDate: '2026-08-02', lastVisitDriver: 'דוד', lastVisitOutcome: 'not_completed', deliveries: 0, lastDeliveryDate: null, callsDone: 0, lastCallDate: null, lastCallBy: null }} />
          <DispatchCard vm={vm('c', 'חייט יעקב', '05472701', 'תל אביב')} accentBorder="border-s-blue-500" lastTouch={null} />
        </div>
        <Package className="hidden" />
      </div>
    </div>
  );
}
