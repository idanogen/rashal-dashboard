import { useContext } from 'react';
import { FundLookupContext } from '@/components/dispatch/fund-lookup-context';
import { HEALTH_FUND_LABEL, type HealthFundKey } from '@/lib/health-fund';

/**
 * תג הקופה על כל כרטיס (עידן, 18/11/2026: "מאוד חשוב לי לדעת על כל לקוח מאיזו קופה הוא").
 * הזמנות וקריאות נושאות את הקופה ברשומה; איסופים, ביקורים ביומן ולקוחות חדשים לפי
 * מספר הלקוח, דרך הספק שמסך הסדרן מציב (`customer_fund_lookup`).
 */

const TONE: Record<HealthFundKey, string> = {
  clalit: 'border-sky-200 bg-sky-50 text-sky-800',
  maccabi: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  leumit: 'border-amber-200 bg-amber-50 text-amber-800',
  meuhedet: 'border-teal-200 bg-teal-50 text-teal-800',
  moh: 'border-slate-200 bg-slate-50 text-slate-700',
  mod: 'border-lime-200 bg-lime-50 text-lime-800',
  other: 'border-slate-200 bg-slate-50 text-slate-600',
  none: 'border-dashed border-slate-300 bg-white text-slate-400',
};

export function FundBadge({ fund, customerNumber }: { fund?: HealthFundKey; customerNumber?: string | null }) {
  const lookup = useContext(FundLookupContext);
  const key = fund && fund !== 'none' ? fund : lookup?.(customerNumber) ?? fund ?? 'none';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10.5px] font-semibold ${TONE[key]}`}
      title={key === 'none' ? 'לא ידוע מאיזו קופה הלקוח. אפשר להשלים בפריוריטי' : `קופה: ${HEALTH_FUND_LABEL[key]}`}
    >
      {key === 'none' ? 'קופה לא ידועה' : HEALTH_FUND_LABEL[key]}
    </span>
  );
}
