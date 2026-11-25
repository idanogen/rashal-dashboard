import { Link } from 'react-router-dom';
import { PackageOpen, RotateCcw, UserPlus, ChevronLeft } from 'lucide-react';
import type { WaitingSummary } from '@/lib/my-day';

/**
 * מה מחכה לשיבוץ, שלושה אריחים. ⭐ כל אריח הוא קישור לטאב המתאים במסך הסדרן,
 * כי המסך הזה אומר מה לעשות והסדרן הוא איפה עושים.
 */
export function WaitingTiles({
  deliveries, pickups, customers, loading, errors,
}: {
  deliveries: WaitingSummary;
  pickups: WaitingSummary;
  customers: WaitingSummary;
  loading: boolean;
  errors: { deliveries: boolean; pickups: boolean; customers: boolean };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tile to="/dispatch?tab=deliveries" icon={<PackageOpen className="h-5 w-5" />} tone="blue"
        title="אספקות ממתינות לתיאום" s={deliveries} loading={loading} error={errors.deliveries} />
      <Tile to="/dispatch?tab=pickups" icon={<RotateCcw className="h-5 w-5" />} tone="teal"
        title="איסופים ממתינים" s={pickups} loading={loading} error={errors.pickups} />
      <Tile to="/dispatch?tab=customers" icon={<UserPlus className="h-5 w-5" />} tone="violet"
        title="לקוחות חדשים בלי הזמנה" s={customers} loading={loading} error={errors.customers} noReturns />
    </div>
  );
}

const TONES = {
  blue: { bg: '#eff6ff', fg: '#1d4ed8' },
  teal: { bg: '#f0fdfa', fg: '#0f766e' },
  violet: { bg: '#f5f3ff', fg: '#6d28d9' },
} as const;

function Tile({ to, icon, tone, title, s, loading, error, noReturns }: {
  to: string; icon: React.ReactNode; tone: keyof typeof TONES; title: string; s: WaitingSummary; loading: boolean;
  /** לקוח חדש לא יוצא לקו, אז אין לו "חזר מהקו". */
  noReturns?: boolean;
  error: boolean;
}) {
  const t = TONES[tone];
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderColor: '#eef1f6' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: t.bg, color: t.fg }}>{icon}</span>
        <span className="text-[13px] font-semibold text-slate-600">{title}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {error
          ? <span className="text-sm font-semibold text-red-600">לא נטען, לרענן את הדף</span>
          : <span className="text-3xl font-bold tabular-nums" style={{ color: t.fg }}>{loading ? '…' : s.count}</span>}
        {!loading && !error && s.oldestDays != null && s.count > 0 && (
          <span className="text-xs text-slate-500">הוותיק מחכה {s.oldestDays} ימים</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={s.returned > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>
          {loading || error || noReturns ? '' : s.returned > 0 ? `${s.returned} חזרו מהקו` : 'אין שחזרו מהקו'}
        </span>
        <span className="inline-flex items-center gap-0.5 text-slate-400 group-hover:text-slate-700">
          לשיבוץ <ChevronLeft className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
