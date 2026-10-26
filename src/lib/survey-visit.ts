/**
 * ההקשר של דירוג נמוך: על איזה ביקור הלקוח דירג, ומה המצב עכשיו.
 *
 * 26/10/2026, עידן על מסך הסקרים: "חסר לי פה תאריך הביקור ומהות הביקור".
 * הכרטיס הציג שם, ציון והערה, והמנהל חיפש את הלקוח במסך אחר כדי להבין על
 * מה הוא כועס. הנתונים מ-`survey_visit_context` במסד; כאן רק הניסוח.
 *
 * ⭐ שעת ההגעה מוצגת בשורה קטנה ולא ככותרת. נמדד 26/10: 21% מהביקורים
 * שדורגו נמוך הגיעו אחרי החלון, מול 19% מאלה שדורגו טוב. איחור אינו
 * מה שמסביר דירוג נמוך, ולכן אסור לו לצעוק.
 *
 * בלי ייבוא, ולכן נבדק ביחידה.
 */

export interface SurveyVisit {
  surveyId: string;
  visitType: string | null;
  visitDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  arrivedAt: string | null;
  stopStatus: string | null;
  resolutionKind: string | null;
  resolutionNote: string | null;
  docno: string | null;
  essence: string | null;
  device: string | null;
  photos: number;
  calls90: number;
  priorLow: number;
  openCallDocno: string | null;
  openCallStatus: string | null;
  nextStopDate: string | null;
  nextStopDriver: string | null;
  nextStopType: string | null;
}

/** שמות סוגי הביקור במסך. אותם מפתחות כמו `calendar_stops.source_type`. */
export const VISIT_TYPE_LABEL: Record<string, string> = {
  service: 'שירות',
  delivery: 'אספקה',
  customer: 'אספקה ללקוח חדש',
  pickup: 'איסוף',
  task: 'משימה',
  inspection: 'בדיקה',
};

export function visitTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return VISIT_TYPE_LABEL[type] ?? type;
}

/** "2026-10-19" → "19/10". */
export function ddmm(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  return m ? `${m[3]}/${m[2]}` : '';
}

/** שורות חיוב שאינן מוצר ואין להן מקום ב"מה סופק". */
const FEE_LINE = /השתתפות עצמית|דמי משלוח|דמי הובלה/;

/**
 * מהות הביקור בשורה אחת: בשירות התקלה (בלי מספרי טלפון שהמוקד מדביק
 * בתאור), באספקה הפריטים בלי שורות החיוב, במשימה ההערה.
 */
export function essenceText(v: Pick<SurveyVisit, 'essence'>, max = 140): string | null {
  const raw = (v.essence ?? '')
    .split(' · ')
    .filter((part) => !FEE_LINE.test(part))
    .join(' · ')
    .replace(/(?:נייד|טלפון|טל[׳']?)?\s*:?\s*\b0\d{1,2}-?\d{7}\b/g, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .replace(/^[\s.·]+|[\s.·]+$/g, '');
  if (!raw) return null;
  return raw.length > max ? `${raw.slice(0, max).trimEnd()}…` : raw;
}

function minutesOfDay(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** השעה בישראל של רגע ההגעה, "HH:MM". */
export function israelHHMM(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d);
}

/**
 * הגעה מול החלון שהובטח. `lateMin` חיובי רק כשהגיע אחרי סוף החלון.
 * בלי חלון או בלי הגעה רשומה: null, ולא "בזמן".
 */
export function arrivalNote(v: Pick<SurveyVisit, 'arrivedAt' | 'windowStart' | 'windowEnd'>):
  { text: string; lateMin: number } | null {
  const at = israelHHMM(v.arrivedAt);
  if (!at) return null;
  const end = minutesOfDay(v.windowEnd);
  const arrived = minutesOfDay(at) as number;
  if (end === null || !v.windowStart) return { text: `הגיע ${at}`, lateMin: 0 };
  // מקף שאינו שובר (U+2011): בטלפון החלון נשבר באמצע, "12:00-" בשורה אחת ו-"14:00" בבאה.
  // 🔴 ועטוף בבידוד LTR (U+2066..U+2069): בלעדיו המקף הזה הפך את הסדר ל-"14:00-12:00" בעברית.
  const window = `\u2066${v.windowStart.slice(0, 5)}\u2011${v.windowEnd!.slice(0, 5)}\u2069`;
  const late = arrived - end;
  if (late > 0) {
    const howLate = late >= 60 ? `${Math.floor(late / 60)} ש' ${late % 60 ? `${late % 60} ד'` : ''}`.trim() : `${late} ד'`;
    return { text: `הגיע ${at}, חלון ${window} (איחור ${howLate})`, lateMin: late };
  }
  return { text: `הגיע ${at}, בתוך החלון ${window}`, lateMin: 0 };
}

/** מה הטכנאי סיכם על הביקור. */
export function outcomeText(v: Pick<SurveyVisit, 'stopStatus' | 'resolutionKind' | 'resolutionNote' | 'photos'>):
  string | null {
  const kind =
    v.resolutionKind === 'follow_up' ? 'להמשך טיפול'
      : v.resolutionKind === 'not_done' || v.stopStatus === 'not_completed' ? 'לא בוצע'
        : v.stopStatus === 'completed' ? 'בוצע'
          : null;
  const photos = v.photos > 0 ? (v.photos === 1 ? 'תמונה אחת' : `${v.photos} תמונות`) : null;
  const note = (v.resolutionNote ?? '').trim();
  const parts = [kind, note ? `"${note}"` : null, photos].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * מה המצב עכשיו: האם כבר מטפלים בלקוח. קודם ביקור משובץ (מעשי יותר),
 * אחר כך קריאה פתוחה בפריוריטי.
 */
export function nowText(v: Pick<SurveyVisit, 'nextStopDate' | 'nextStopDriver' | 'nextStopType' |
  'openCallDocno' | 'openCallStatus'>): { text: string; tone: 'active' | 'open' } | null {
  if (v.nextStopDate) {
    const type = visitTypeLabel(v.nextStopType);
    const who = v.nextStopDriver ? ` אצל ${v.nextStopDriver}` : '';
    return { text: `משובץ ${type ? `ל${type} ` : ''}ב-${ddmm(v.nextStopDate)}${who}`, tone: 'active' };
  }
  if (v.openCallDocno) {
    return { text: `קריאה פתוחה ${v.openCallDocno}${v.openCallStatus ? ` (${v.openCallStatus})` : ''}, לא משובצת`, tone: 'open' };
  }
  return null;
}

/** היסטוריה קצרה, רק כשיש מה לומר. קריאה אחת היא הביקור עצמו. */
export function historyText(v: Pick<SurveyVisit, 'calls90' | 'priorLow'>): string | null {
  const parts: string[] = [];
  if (v.calls90 >= 2) parts.push(`${v.calls90} קריאות שירות ב-90 יום`);
  if (v.priorLow > 0) parts.push(v.priorLow === 1 ? 'דירג נמוך גם בעבר' : `דירג נמוך ${v.priorLow} פעמים בעבר`);
  return parts.length ? parts.join(' · ') : null;
}

/** שורת הביקור: סוג · תאריך · טכנאי · מסמך. */
export function visitLine(v: Pick<SurveyVisit, 'visitType' | 'visitDate' | 'docno'>, driver: string | null): string {
  return [visitTypeLabel(v.visitType), ddmm(v.visitDate), driver, v.docno].filter(Boolean).join(' · ');
}

interface VisitRow {
  survey_id: string;
  visit_type: string | null;
  visit_date: string | null;
  window_start: string | null;
  window_end: string | null;
  arrived_at: string | null;
  stop_status: string | null;
  resolution_kind: string | null;
  resolution_note: string | null;
  docno: string | null;
  essence: string | null;
  device: string | null;
  photos: number | null;
  calls_90: number | null;
  prior_low: number | null;
  open_call_docno: string | null;
  open_call_status: string | null;
  next_stop_date: string | null;
  next_stop_driver: string | null;
  next_stop_type: string | null;
}

export function toSurveyVisit(r: VisitRow): SurveyVisit {
  return {
    surveyId: r.survey_id,
    visitType: r.visit_type,
    visitDate: r.visit_date,
    windowStart: r.window_start,
    windowEnd: r.window_end,
    arrivedAt: r.arrived_at,
    stopStatus: r.stop_status,
    resolutionKind: r.resolution_kind,
    resolutionNote: r.resolution_note,
    docno: r.docno,
    essence: r.essence,
    device: r.device,
    photos: r.photos ?? 0,
    calls90: r.calls_90 ?? 0,
    priorLow: r.prior_low ?? 0,
    openCallDocno: r.open_call_docno,
    openCallStatus: r.open_call_status,
    nextStopDate: r.next_stop_date,
    nextStopDriver: r.next_stop_driver,
    nextStopType: r.next_stop_type,
  };
}
