import type { TargetStatus } from '@/lib/delivery-target';
import type { DriverDay, WaitingSummary } from '@/lib/my-day';
import { WeeklyTargetStrip } from '@/components/management/WeeklyTargetStrip';
import { WaitingTiles } from './WaitingTiles';
import { DriversDay } from './DriversDay';

/** התצוגה של "הבוקר שלי", בלי שליפות, כדי שתצולם בלי התחברות. הנתונים: MyDayPage. */
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function greeting(h: number): string {
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

export interface MyDayViewProps {
  now: Date;
  firstName: string;
  target: { weekly: TargetStatus; history: { weekStart: string; count: number }[] };
  daysLeft: number;
  perDay: number | null;
  notesLoading: boolean;
  waiting: { deliveries: WaitingSummary; pickups: WaitingSummary; customers: WaitingSummary };
  waitingLoading: boolean;
  todayRows: DriverDay[];
  tomorrowRows: DriverDay[];
  tomorrowDate: Date;
  stopsLoading: boolean;
}

export function MyDayView(p: MyDayViewProps) {
  const { weekly } = p.target;
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">
          {greeting(p.now.getHours())}{p.firstName ? `, ${p.firstName}` : ''}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          יום {WEEKDAYS[p.now.getDay()]}, <bdi>{p.now.toLocaleDateString('he-IL')}</bdi>
        </p>
      </header>

      <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">היעד השבועי של החברה</h3>
            <p className="text-xs text-slate-500">תעודות משלוח שנפתחו בפריוריטי השבוע, ראשון עד חמישי</p>
          </div>
          <p className="text-sm text-slate-600">
            {p.notesLoading ? '' : p.perDay != null
              ? <>נשארו {p.daysLeft} ימי עבודה · צריך <b className="text-slate-900">{p.perDay}</b> ביום כדי להגיע ליעד</>
              : weekly.actual >= weekly.target ? 'היעד הושג השבוע 🎉' : 'השבוע הסתיים'}
          </p>
        </div>
        <div className="grid grid-cols-2">
          <WeeklyTargetStrip s={weekly} history={p.target.history} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-bold text-slate-800">מחכה לשיבוץ</h3>
        <WaitingTiles {...p.waiting} loading={p.waitingLoading} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <DriversDay title="היום" rows={p.todayRows} mode="today" loading={p.stopsLoading} />
        <DriversDay title={`יום ${WEEKDAYS[p.tomorrowDate.getDay()]}`} rows={p.tomorrowRows} mode="tomorrow" loading={p.stopsLoading} />
      </section>
    </div>
  );
}
