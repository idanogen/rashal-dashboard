/**
 * מה שהטכנאי רושם, בצורה שנכנסת לקריאת השירות בפריוריטי (עידן, 15/09/2026).
 *   מלל → "תאור התיקון" (DOCTEXT_Q_SUBFORM, APPEND) · תמונות → "נספחים" (EXTFILES_SUBFORM)
 *
 * 🔴 קובץ טהור בלי ייבוא, כדי שייבדק (`test/call-repair-text.test.mjs`).
 */

/**
 * "15/09/26 13:12" בשעון ישראל.
 * 🔴 `toLocaleString` בלי `timeZone` רץ ב-Vercel ב-UTC, והשעה בכרטיס הלקוח
 * יצאה שלוש שעות אחורה עד 15/09/2026.
 */
export function israelStamp(iso: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)) {
    parts[p.type] = p.value;
  }
  const date = `${parts.day}/${parts.month}/${parts.year}`;
  return withTime ? `${date} ${parts.hour}:${parts.minute}` : date;
}

const RESOLUTION_LABEL: Record<string, string> = {
  not_done: 'לא בוצע',
  follow_up: 'להמשך טיפול',
};

export interface RepairCandidate {
  kind: string;
  user_name?: string | null;
  content?: string | null;
  at: string;
  resolution_kind?: string | null;
}

/**
 * שורה אחת לתאור התיקון: "[אבי · 15/09/26 13:12] הוחלף גב 40/50 חדש".
 * סיבה מסימון הביקור מקבלת את שם הסימון: "[אולג · 14/09/26 18:02 · להמשך טיפול] חסר חלק".
 * שורות מרובות מתחברות ב-" / ", כדי שלא ייבלעו בעטיפת ה-HTML של פריוריטי.
 */
export function repairLine(c: RepairCandidate): string | null {
  const text = String(c.content ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' / ');
  if (!text) return null;
  const who = String(c.user_name ?? '').trim() || 'טכנאי';
  const tag = c.kind === 'note' ? RESOLUTION_LABEL[String(c.resolution_kind ?? '')] ?? 'סימון ביקור' : '';
  const head = [who, israelStamp(c.at), tag].filter(Boolean).join(' · ');
  return `[${head}] ${text}`;
}

/** DOCUMENTS_Q מתוּבְת במפתח מורכב: DOCNO + TYPE='Q' (לקח #82). */
export function callSubformUrl(base: string, docno: string, subform: string): string {
  return `${base}/DOCUMENTS_Q(DOCNO='${encodeURIComponent(docno)}',TYPE='Q')/${subform}`;
}

/** שם הנספח: "SC2603230 טכנאי 15.09.26 (1).jpg", עד 60 תווים. */
export function photoDes(docno: string, at: string, idx: number, ext: string): string {
  const date = israelStamp(at, false).replace(/\//g, '.');
  return `${docno} טכנאי ${date} (${idx}).${ext}`.slice(0, 60);
}
