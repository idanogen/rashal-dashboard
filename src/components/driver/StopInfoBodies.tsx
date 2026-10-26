import { PackageOpen, Truck } from 'lucide-react';
import { itemLine, type OrderInfo, type PickupInfo } from '@/lib/call-info';
import { Empty, OfficeNoteSection, Section } from '@/components/driver/StopInfoSection';

type OfficeNote = { userName: string; content: string; at: string } | null;

/** אספקה: מה לספק (עמי, 06/10/2026). הפריטים מ-ORDERITEMS בפריוריטי. */
export function OrderBody({ order, officeNote }: { order: OrderInfo; officeNote: OfficeNote }) {
  const meta = [order.orderType, order.healthFund].filter(Boolean).join(' · ');
  return (
    <>
      <Section icon={<Truck className="h-4 w-4 text-blue-600" />} title="מה לספק" meta={meta || 'מפריוריטי'}>
        {order.items.length ? (
          <ul className="divide-y rounded-lg border border-blue-200 bg-blue-50/60">
            {order.items.map((i, idx) => (
              <li key={`${i.part ?? ''}-${idx}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2.5 py-1.5 text-sm">
                <span className="font-semibold text-slate-900">{itemLine(i)}</span>
                {i.part && i.desc && <bdi className="font-mono text-[11px] text-slate-500">{i.part}</bdi>}
                {i.serial && (
                  <bdi className="select-all rounded bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 ring-1 ring-slate-200">
                    {i.serial}
                  </bdi>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>בהזמנה בפריוריטי לא רשומים פריטים.</Empty>
        )}
      </Section>
      <OfficeNoteSection note={officeNote} />
    </>
  );
}

/** איסוף: מה לאסוף, מאיזו הזמנה, ולאן. */
export function PickupBody({ pickup, officeNote }: { pickup: PickupInfo; officeNote: OfficeNote }) {
  const where = [pickup.toWarehouse ? `ליעד: ${pickup.toWarehouse}` : '', pickup.sourceOrder ? `מהזמנה ${pickup.sourceOrder}` : '']
    .filter(Boolean).join(' · ');
  const meta = pickup.totalQty != null ? `${pickup.totalQty} פריטים` : undefined;
  return (
    <>
      <Section icon={<PackageOpen className="h-4 w-4 text-teal-600" />} title="מה לאסוף" meta={meta}>
        {pickup.lines.length ? (
          <ul className="divide-y rounded-lg border border-teal-200 bg-teal-50/60">
            {pickup.lines.map((l, idx) => (
              <li key={`${l.part ?? ''}-${idx}`} className="px-2.5 py-1.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-slate-900">{itemLine(l)}</span>
                  {l.part && l.desc && <bdi className="font-mono text-[11px] text-slate-500">{l.part}</bdi>}
                  {l.sourceOrder && <bdi className="text-[11px] text-slate-500">מהזמנה {l.sourceOrder}</bdi>}
                </div>
                {l.returnReason && <div className="text-[12px] text-amber-800">סיבת ההחזרה: {l.returnReason}</div>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>במסמך האיסוף בפריוריטי לא רשומים פריטים.</Empty>
        )}
        {(where || pickup.deliveryNote || pickup.reference) && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-slate-600">
            {where && <span>{where}</span>}
            {pickup.deliveryNote && <span>תעודת משלוח <bdi>{pickup.deliveryNote}</bdi></span>}
            {pickup.reference && <span>אסמכתה <bdi>{pickup.reference}</bdi></span>}
          </div>
        )}
      </Section>
      <OfficeNoteSection note={officeNote} />
    </>
  );
}
