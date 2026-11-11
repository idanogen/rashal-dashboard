// מה ריצה של rashal-morning-report שולחת, ובאילו משתנים. טהור, נבדק מ-node (test/morning-report-plan.test.mjs).
//
// 11/11/2026 (שלומי, עידן "מחליף"): דוח האספקות עובר לערב. שני חלקים בכל ריצה:
//   delivery  · דוח האספקות. בוקר = על יום העבודה האחרון, ערב = על היום עצמו (report_slot).
//   reminders · דוח התזכורות. תמיד בבוקר, על הביקורים של היום: התזכורות יצאו אמש
//               והתשובות נאספות עד 07:00 (reminder_replies).

export type Slot = "morning" | "evening";

/** השעה שבה דוח התזכורות יוצא (ושום דבר לא יוצא בחלון הבוקר לפניה). */
export const MORNING_HOUR = 7;

export interface RunPlan {
  delivery: boolean;
  reminders: boolean;
  reason?: string;
}

/**
 * הקרון רץ בשני חלונות (בוקר וערב, UTC רחב בגלל שעון קיץ). השעה בישראל מכריעה איזה חלון זה.
 * ריצה ידנית (`part`) בוחרת חלק בעצמה ולא מחכה לשעה.
 */
export function planRun(o: { slot: Slot; hour: number; trigger: string; sendHour: number; part?: string | null }): RunPlan {
  if (o.trigger !== "cron") {
    if (o.part === "delivery") return { delivery: true, reminders: false };
    if (o.part === "reminders") return { delivery: false, reminders: true };
    return { delivery: true, reminders: true };
  }
  const evening = o.hour >= 12;
  if (!evening) {
    if (o.hour < MORNING_HOUR) {
      return { delivery: false, reminders: false, reason: `before ${MORNING_HOUR}:00 Israel (now ${o.hour})` };
    }
    return { delivery: o.slot === "morning" && o.hour >= o.sendHour, reminders: true };
  }
  if (o.slot !== "evening") return { delivery: false, reminders: false, reason: "evening window, slot is morning" };
  if (o.hour < o.sendHour) {
    return { delivery: false, reminders: false, reason: `before ${o.sendHour}:00 Israel (now ${o.hour})` };
  }
  return { delivery: true, reminders: false };
}

export interface Totals {
  planned: number;
  delivered: number;
  not_delivered: number;
  follow_up?: number;
  open: number;
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function dayLabel(date: string, dow: number): string {
  const [, m, d] = date.split("-");
  return `יום ${DAY_NAMES[dow] ?? ""} ${d}/${m}`;
}

export function deliveryRate(t: Totals): string {
  const reported = t.delivered + t.not_delivered;
  return reported > 0 ? `${Math.round((t.delivered / reported) * 100)}%` : "אין דיווח";
}

/** משתני התבנית. שתי התבניות שונות רק בהמשך הטיפול. */
export function deliveryVariables(slot: Slot, date: string, dow: number, t: Totals): { name: string; value: string }[] {
  const followUp = t.follow_up ?? 0;
  // 🔴 15/09/2026 (עידן): "המשך טיפול" נספר בנפרד ולא כ"לא סופק". בתבנית הבוקר אין לו משתנה,
  // ולכן הוא נכנס ל-not_delivered כהמשך של המשפט ("7 עצירות, להמשך טיפול אחרי ביקור 1" +
  // " עצירות" שבתבנית). לתבנית הערב יש משתנה follow_up משלה.
  const notDelivered = slot === "morning" && followUp > 0
    ? `${t.not_delivered} עצירות, להמשך טיפול אחרי ביקור ${followUp}`
    : String(t.not_delivered);
  return [
    { name: "report_day", value: dayLabel(date, dow) },
    { name: "planned", value: String(t.planned) },
    { name: "delivered", value: String(t.delivered) },
    { name: "not_delivered", value: notDelivered },
    ...(slot === "evening" ? [{ name: "follow_up", value: String(followUp) }] : []),
    { name: "open_count", value: String(t.open) },
    { name: "rate", value: deliveryRate(t) },
    // סיומת כפתור ה-URL: /morning/<תאריך>
    { name: "report_date", value: date },
  ];
}
