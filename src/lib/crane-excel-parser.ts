import * as XLSX from 'xlsx';
import type { ParsedExcelRow } from './crane-sync';

/**
 * Parses an Excel file in the format Rashal uses for the monthly crane report.
 * Expected headers (row 1, sheet "DataSheet"):
 *   מס' מכשיר, תחילת תקופת אחריות, תום תקופת אחריות, ת. התקנה, ת. ביטול,
 *   מק"ט, לקוח, שם לקוח, ת. פתיחה, טלפון, מספר מדבקה, קוד סוג לקוח, תאור סוג לקוח
 */
export async function parseCraneExcel(file: File): Promise<ParsedExcelRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find((n) => n === 'DataSheet') ?? wb.SheetNames[0];
  if (!sheetName) throw new Error('הקובץ ריק או לא מכיל גיליונות');
  const ws = wb.Sheets[sheetName];

  type RawRow = Record<string, unknown>;
  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: true });

  const seen = new Set<string>();
  const out: ParsedExcelRow[] = [];

  for (const row of rows) {
    const deviceNumber = cellToString(row["מס' מכשיר"]);
    if (!deviceNumber) continue;
    if (seen.has(deviceNumber)) continue;
    seen.add(deviceNumber);

    const model = cellToString(row['מק"ט']);
    if (!model) continue;

    out.push({
      deviceNumber,
      model,
      customerIdNumber: cellToString(row['לקוח']) || undefined,
      customerName: cellToString(row['שם לקוח']) || undefined,
      customerType: cellToString(row['תאור סוג לקוח']) || undefined,
      customerTypeCode: cellToString(row['קוד סוג לקוח']) || undefined,
      phone: cellToString(row['טלפון']) || undefined,
      stickerNumber: cellToString(row['מספר מדבקה']) || undefined,
      installDate: cellToDate(row['ת. התקנה']),
      openedDate: cellToDate(row['ת. פתיחה']),
      warrantyStart: cellToDate(row['תחילת תקופת אחריות']),
      warrantyEnd: cellToDate(row['תום תקופת אחריות']),
      cancelledAt: cellToDate(row['ת. ביטול']),
    });
  }

  return out;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  return s.trim();
}

function cellToDate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  let d: Date | null = null;
  if (v instanceof Date) {
    d = v;
  } else if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30)
    d = new Date(Math.round((v - 25569) * 86400 * 1000));
  } else if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    // Try parse ISO first, then dd/mm/yyyy
    const iso = new Date(trimmed);
    if (!isNaN(iso.getTime())) {
      d = iso;
    } else {
      const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
      if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        let year = parseInt(m[3], 10);
        if (year < 100) year += 2000;
        d = new Date(year, month, day);
      }
    }
  }
  if (!d || isNaN(d.getTime())) return undefined;
  // Filter the Excel "0 = 1899-12-30" sentinel that surfaces as 1900/1902
  if (d.getFullYear() < 1950) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
