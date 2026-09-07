import { CustomerCardBody } from '@/components/customer/CustomerCard';
import { CARD_FIXTURE } from './card-fixture';

/** ?view=card: כרטיס לקוח עם ההודעות והתמונות מהשטח על הציר (07/09/2026). */
export function CardScene() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-5xl">
        <CustomerCardBody data={CARD_FIXTURE} layout="page" />
      </div>
    </div>
  );
}
