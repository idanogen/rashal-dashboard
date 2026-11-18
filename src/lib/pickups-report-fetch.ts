import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import {
  FUND_SHEET_HEADER, compareSources, fundSheetRow, parsePickupsReport, type PickupsReport,
} from './pickups-report';

export async function fetchPickupsReport(fund: string, from: string, to: string): Promise<PickupsReport> {
  const { data, error } = await supabase.rpc('pickups_fund_report', { p_fund: fund, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return parsePickupsReport(data);
}

function sheet(title: string, period: string, rows: (string | number)[][], header: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([[title], [period], header, ...rows]);
  ws['!cols'] = header.map((h) => ({ wch: Math.max(10, h.length + 4) }));
  // RTL כמו הקובץ שעובר לקופה.
  ws['!views'] = [{ RTL: true }];
  return ws;
}

/**
 * קובץ אחד לקופה, שלוש לשוניות: מהמערכת שלנו (לשליחה), מפריוריטי, וההשוואה.
 * ⭐ בתקופת ההרצה המשרד משווה את שתי הראשונות ושולח את מה שנכון.
 */
export function downloadPickupsReport(r: PickupsReport): void {
  const period = `${r.from.split('-').reverse().join('/')} עד ${r.to.split('-').reverse().join('/')}`;
  const title = `איסופים - מבוטחי ${r.fund}`;
  const cmp = compareSources(r);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(title, `${period} · מהמערכת`, r.app.map(fundSheetRow), FUND_SHEET_HEADER), 'מהמערכת');
  XLSX.utils.book_append_sheet(wb, sheet(title, `${period} · מפריוריטי`, r.priority.map(fundSheetRow), FUND_SHEET_HEADER), 'מפריוריטי');
  const cmpRows = [
    ...cmp.priorityOnly.map((x) => ['נסגר בפריוריטי ולא באפליקציה', x.rt ?? '', x.name, x.tz, x.picked.split('-').reverse().join('/')]),
    ...cmp.appOnly.map((x) => ['נסגר באפליקציה ולא בפריוריטי', x.rt ?? '', x.name, x.tz, x.picked.split('-').reverse().join('/')]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(`השוואה · ${r.fund}`, `${period} · בשני המקורות: ${cmp.both.length}`, cmpRows, ['פער', 'תעודה', 'שם', 'ת"ז', 'תאריך']),
    'השוואה',
  );
  XLSX.writeFile(wb, `איסופים-${r.fund}-${r.from}-עד-${r.to}.xlsx`);
}
