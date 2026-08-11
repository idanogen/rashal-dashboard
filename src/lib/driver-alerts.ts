import type { CalendarStop } from '@/types/calendar-stop';

/**
 * התראות וואטסאפ על חריגה של נהג מהמסלול.
 *
 * הרעיון: לא לחסום את הנהג בשטח, אלא לוודא שאף סטייה לא עוברת בשקט. נהג
 * שנחסם פיזית פשוט ישקר למערכת, ואילו נהג שיודע שיוצאת הודעה שוקל את
 * הסטייה. הפיקוח האמיתי הוא לא ברגע אלא בדפוס, ולכן כל התראה גם נשמרת.
 */

/**
 * מקבלי ההתראות. עמי הוא מנהל התפעול ברשעל.
 * להוספת נמען: שורה נוספת כאן, בלי שינוי בקוד.
 */
export const ALERT_RECIPIENTS: { name: string; phone: string }[] = [
  { name: 'עמי', phone: '+972584847477' },
];

/**
 * שם התבנית המאושרת ב-heyy / מטא.
 *
 * הודעה יוצאת ביוזמת העסק תקפה רק בתוך חלון 24 השעות של וואטסאפ, ולכן
 * התראה שיכולה לצאת בכל שעה חייבת תבנית. הקוד מנסה תבנית קודם, ואם היא
 * טרם אושרה נופל לטקסט חופשי, שיעבוד כל עוד עמי כתב לעסק לאחרונה.
 *
 * הגוף שהוגש לאישור (7 משתנים, קטגוריה UTILITY, עברית):
 *
 *   עדכון ממערכת השילוח של ר.שעל
 *   אירוע: {{1}}
 *   לקוח: {{2}}
 *   כתובת: {{3}}
 *   טלפון: {{4}}
 *   שעת תיאום: {{5}}
 *   נהג: {{6}}
 *   סיבה: {{7}}
 *   הפרטים המלאים במסך הסדרן.
 *
 * 🔴 שתי מלכודות של מטא: פרמטר ריק פוסל את השליחה (ולכן כל ערך חסר מוחלף
 * ב"לא צוין"), וגוף שמסתיים במשתנה נוטה להידחות (ולכן השורה האחרונה קבועה).
 */
export const DRIVER_ALERT_TEMPLATE = 'driver_stop_alert';

export type AlertKind = 'bypass' | 'not_completed';

interface AlertInput {
  kind: AlertKind;
  stop: Pick<CalendarStop, 'customerName' | 'address' | 'city' | 'phone' | 'timeWindowStart' | 'timeWindowEnd'>;
  driverName: string;
  reason: string;
  /** מיקום העצירה בסדר היום, לצורך הודעה מובנת: "עצירה 3 מתוך 10". */
  position?: { index: number; total: number };
}

function timeWindowLabel(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const trim = (t: string) => t.slice(0, 5);
  return end ? `${trim(start)} - ${trim(end)}` : trim(start);
}

export function buildAlertText({ kind, stop, driverName, reason, position }: AlertInput): string {
  const lines: string[] = [];

  lines.push(kind === 'bypass' ? '⚠️ דילוג על עצירה' : '🔴 עצירה לא בוצעה');
  lines.push('');
  lines.push(`לקוח: ${stop.customerName}`);

  const addr = [stop.address, stop.city].filter(Boolean).join(', ');
  if (addr) lines.push(`כתובת: ${addr}`);
  if (stop.phone) lines.push(`טלפון: ${stop.phone}`);

  const window = timeWindowLabel(stop.timeWindowStart, stop.timeWindowEnd);
  if (window) lines.push(`שעת תיאום: ${window}`);

  lines.push(`נהג: ${driverName}`);
  if (position) lines.push(`עצירה ${position.index} מתוך ${position.total}`);
  lines.push(`סיבה: ${reason}`);

  return lines.join('\n');
}

export interface AlertResult {
  sent: boolean;
  isDemo: boolean;
  error?: string;
}

/**
 * שליחה בפועל. עוברת דרך `/api/heyy-send` הקיים, שכבר מטפל בנרמול הטלפון,
 * ברישום ל-`whatsapp_outbound` ובמצב הדמו.
 *
 * ⚠️ הודעת טקסט חופשי ביוזמת העסק תקפה רק בתוך חלון 24 השעות של וואטסאפ.
 * להתראה שיוצאת בכל שעה נדרשת תבנית מאושרת. עד שתאושר, כישלון כאן לא עוצר
 * את הנהג: החריגה כבר נשמרה במסד והסדרן יראה אותה בדוח.
 */
/** פרמטרי התבנית. מטא פוסלת פרמטר ריק, ולכן אין כאן אף מחרוזת ריקה. */
export function buildAlertParams(input: AlertInput): string[] {
  const or = (v: string | null | undefined) => {
    const t = String(v ?? '').trim();
    return t.length ? t : 'לא צוין';
  };
  const { stop } = input;

  return [
    input.kind === 'bypass' ? 'דילוג על עצירה' : 'עצירה לא בוצעה',
    or(stop.customerName),
    or([stop.address, stop.city].filter(Boolean).join(', ')),
    or(stop.phone),
    or(timeWindowLabel(stop.timeWindowStart, stop.timeWindowEnd)),
    or(input.driverName),
    or(input.reason),
  ];
}

async function postSend(body: Record<string, unknown>): Promise<AlertResult> {
  const res = await fetch('/api/heyy-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; isDemo?: boolean; error?: string };
  return { sent: !!json.ok, isDemo: !!json.isDemo, error: json.error };
}

export async function sendDriverAlert(input: AlertInput): Promise<AlertResult[]> {
  const bodyText = buildAlertText(input);
  const parameters = buildAlertParams(input);

  return Promise.all(
    ALERT_RECIPIENTS.map(async (recipient) => {
      const common = {
        phoneE164: recipient.phone,
        reminderKind: 'team_notification',
        triggeredBy: `driver:${input.driverName}`,
      };
      try {
        const viaTemplate = await postSend({
          ...common,
          kind: 'template',
          templateId: DRIVER_ALERT_TEMPLATE,
          parameters,
        });
        if (viaTemplate.sent) return viaTemplate;

        // התבנית טרם אושרה או נדחתה — ניסיון בטקסט חופשי, שיעבור אם חלון
        // 24 השעות פתוח. עדיף הודעה שנוחתת מאשר שקט מוחלט.
        return await postSend({ ...common, kind: 'text', bodyText });
      } catch (e) {
        return { sent: false, isDemo: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}
