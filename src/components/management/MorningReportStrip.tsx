import { Link } from 'react-router-dom';
import { ChevronLeft, Sun } from 'lucide-react';
import { useMorningReport } from '@/hooks/useMorningReport';
import { deliveryRate, morningDayLabel } from '@/lib/morning-report';

const NAVY = '#14223a';

/**
 * כרטיס הקישור לדוח הבוקר בראש דשבורד ההנהלה (החלטת עידן, 09/09/2026):
 * שורה אחת על יום העבודה האחרון, והמסך המלא בלחיצה. אותה קריאה למסד
 * שהמסך עצמו עושה, ולכן אין כאן חישוב שני לאותם מספרים.
 */
export function MorningReportStrip() {
  const { data } = useMorningReport(null);
  const t = data?.totals;
  const rate = t ? deliveryRate(t.delivered, t.not_delivered) : null;
  return (
    <Link
      to={data ? `/morning/${data.date}` : '/morning'}
      className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border bg-white px-5 py-3 shadow-sm transition-colors hover:bg-amber-50/40"
      style={{ borderColor: '#fde68a' }}
    >
      <span className="flex items-center gap-2 text-sm font-bold" style={{ color: NAVY }}>
        <Sun className="h-4 w-4 text-amber-500" /> דוח בוקר
      </span>
      {t ? (
        <span className="text-[12.5px] text-slate-600">
          {morningDayLabel(data!.date)}: סופקו <b style={{ color: '#15803d' }}><bdi>{t.delivered}</bdi></b> מתוך <bdi>{t.planned}</bdi> ששובצו
          {t.not_delivered > 0 && <> · <b style={{ color: '#c2410c' }}><bdi>{t.not_delivered}</bdi></b> לא סופקו</>}
          {t.open > 0 && <> · <b style={{ color: '#b45309' }}><bdi>{t.open}</bdi></b> נשארו פתוחות</>}
          {rate != null && <> · אחוז אספקה <b><bdi>{rate}%</bdi></b></>}
        </span>
      ) : (
        <span className="text-[12.5px] text-slate-400">טוען…</span>
      )}
      <span className="ms-auto flex items-center gap-1 text-[12px] font-semibold" style={{ color: NAVY }}>
        לדוח המלא <ChevronLeft className="h-4 w-4" />
      </span>
    </Link>
  );
}
