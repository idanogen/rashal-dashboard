import { type DriverDay, type DayCount, sum } from '@/lib/my-day';

/**
 * האספקות והאיסופים של יום אחד לפי נהג. היום: מה בוצע ומה חזר. מחר: כמה כבר משובץ,
 * כדי לראות מי עמוס ומי פנוי לפני שמשבצים עוד.
 */
export function DriversDay({ title, rows, mode, loading }: {
  title: string; rows: DriverDay[]; mode: 'today' | 'tomorrow'; loading: boolean;
}) {
  const totalDel = rows.reduce((n, r) => n + sum(r.deliveries), 0);
  const totalPick = rows.reduce((n, r) => n + sum(r.pickups), 0);
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-500">{totalDel} אספקות · {totalPick} איסופים</span>
      </div>
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">טוען…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">עוד לא שובצו אספקות או איסופים</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1.5 text-start font-medium">נהג</th>
              <th className="py-1.5 text-start font-medium">אספקות</th>
              <th className="py-1.5 text-start font-medium">איסופים</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.driver} className="border-t" style={{ borderColor: '#f0f3f8' }}>
                <td className="py-2 font-medium text-slate-700">{r.driver}</td>
                <td className="py-2"><Counts c={r.deliveries} mode={mode} /></td>
                <td className="py-2"><Counts c={r.pickups} mode={mode} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Counts({ c, mode }: { c: DayCount; mode: 'today' | 'tomorrow' }) {
  if (sum(c) === 0) return <span className="text-slate-300">—</span>;
  if (mode === 'tomorrow') return <span className="tabular-nums text-slate-700">{sum(c)}</span>;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="text-slate-700">{sum(c)}</span>
      {c.done > 0 && <span className="text-xs font-semibold text-green-700">✓ {c.done}</span>}
      {c.notDone > 0 && <span className="text-xs font-semibold text-red-600">✗ {c.notDone}</span>}
      {c.planned > 0 && <span className="text-xs text-slate-400">{c.planned} בדרך</span>}
    </span>
  );
}
