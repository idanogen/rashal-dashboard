import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, PackageCheck, ShoppingCart } from 'lucide-react';
import { DispatchCard, type DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import { usePersistedCollapse } from '@/hooks/usePersistedCollapse';
import {
  DESK_LABEL,
  buyStatusLabel,
  deskOf,
  followupTimeline,
  shortDateTime,
  type CallFollowup,
  type FollowupDesk,
} from '@/lib/call-followups';
import { Pill } from '@/components/service-calls/FollowupPill';

export interface FollowupItem { f: CallFollowup; vm: DispatchItemVM }

/** ציר ההיסטוריה הקטן, בכרטיס של "החלק הגיע". */
function Timeline({ f }: { f: CallFollowup }) {
  return (
    <ul className="mt-1.5 space-y-0.5 border-t border-dashed pt-1.5 text-[11px] text-muted-foreground">
      {followupTimeline(f).map((t) => (
        <li key={t.at + t.text} className="flex gap-2">
          <bdi className="w-[70px] shrink-0 tabular-nums">{shortDateTime(t.at)}</bdi>
          <span>{t.text}</span>
        </li>
      ))}
      {f.techNote && (
        <li className="flex gap-2">
          <bdi className="w-[70px] shrink-0 tabular-nums">{f.visitDate ? f.visitDate.slice(8, 10) + '/' + f.visitDate.slice(5, 7) : ''}</bdi>
          <span className="line-clamp-2">{f.techName}: {f.techNote}</span>
        </li>
      )}
    </ul>
  );
}

/**
 * "החלק הגיע, לשיבוץ" (15/11/2026): רצועה ירוקה בראש מסך הקריאות. הכרטיס
 * הוא הכרטיס הרגיל של הסדרן, נגרר ליומן באותו חוזה, עם ציר ההיסטוריה.
 */
export function ArrivedStrip({
  items, accentBorder, selectedIds, onToggleSelect,
}: { items: FollowupItem[]; accentBorder: string; selectedIds?: Set<string>; onToggleSelect?: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <PackageCheck className="h-4 w-4 text-emerald-700" />
        <h3 className="text-sm font-bold text-emerald-800">החלק הגיע או תוקן, לשיבוץ ({items.length})</h3>
        <span className="text-[11px] text-emerald-700/80">גוררים ליומן כרגיל, והשיבוץ סוגר את בקשת הרכש</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ f, vm }) => {
          const desk = deskOf(f.kind);
          const withHistory: DispatchItemVM = {
            ...vm,
            nameBadge: (
              <>
                {vm.nameBadge}
                <span className="ms-1"><Pill tone="green">{buyStatusLabel(f, '').text}</Pill></span>
              </>
            ),
            meta: (
              <>
                {vm.meta}
                <p className="mt-1 text-xs font-medium text-foreground">
                  {f.item}{desk ? <span className="text-muted-foreground"> · {DESK_LABEL[desk]}</span> : null}
                </p>
                <Timeline f={f} />
              </>
            ),
          };
          return (
            <DispatchCard
              key={vm.id}
              vm={withHistory}
              accentBorder={vm.accentBorder ?? accentBorder}
              isSelected={selectedIds?.has(vm.id)}
              onToggleSelect={onToggleSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

/** "אצל אלכס, רכש": מקופל כברירת מחדל, שני טורים לפי שולחן, עם הצפי. */
export function BuyingStrip({ items, today }: { items: FollowupItem[]; today: string }) {
  const [collapsed, toggle] = usePersistedCollapse('collapse:calls-buying', true);
  if (items.length === 0) return null;
  const byDesk = (d: FollowupDesk) => items.filter(({ f }) => deskOf(f.kind) === d);
  const overdue = items.filter(({ f }) => buyStatusLabel(f, today).tone === 'red').length;
  const nextEta = items.map(({ f }) => f.eta).filter((e): e is string => !!e && e >= today).sort()[0];
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 shadow-sm">
      <button type="button" onClick={toggle} className="flex w-full flex-wrap items-center gap-2 text-start">
        <ShoppingCart className="h-4 w-4 text-violet-700" />
        <h3 className="text-sm font-bold text-violet-800">אצל אלכס, רכש ({items.length})</h3>
        <span className="text-[11px] text-violet-700/80">
          מחסן {byDesk('warehouse').length} · בית מלאכה {byDesk('workshop').length}
          {nextEta ? ` · הקרוב: ${nextEta.slice(8, 10)}/${nextEta.slice(5, 7)}` : ''}
        </span>
        {overdue > 0 && <Pill tone="red">{overdue} צפי עבר</Pill>}
        <span className="ms-auto text-violet-700">
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {!collapsed && (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {(['warehouse', 'workshop'] as const).map((d) => (
            <div key={d} className="rounded-md border border-violet-100 bg-white">
              <div className="border-b border-violet-100 px-3 py-1.5 text-xs font-bold text-violet-800">
                רכש · אלכס {DESK_LABEL[d]} ({byDesk(d).length})
              </div>
              {byDesk(d).length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">אין בקשות פתוחות</p>}
              {byDesk(d).map(({ f, vm }) => {
                const st = buyStatusLabel(f, today);
                return (
                  <div key={f.id} className="border-b px-3 py-2 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{vm.customerName}</span>
                      <Pill tone={st.tone}>{st.text}</Pill>
                      {f.urgency === 'urgent' && f.status === 'open' && <Pill tone="red">דחוף</Pill>}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{f.item}</p>
                  </div>
                );
              })}
            </div>
          ))}
          <Link to="/parts" className="text-xs font-medium text-violet-700 underline-offset-2 hover:underline md:col-span-2">
            לעמוד הרכש המלא
          </Link>
        </div>
      )}
    </div>
  );
}
