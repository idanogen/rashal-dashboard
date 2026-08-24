import type { WaTemplate } from './templates-store.js';

/**
 * התבניות כפי שהחלונית והדשבורד צריכים אותן.
 *
 * 🔴🔴 **הכלל "מה אפשר לשלוח מאיפה" נכתב כאן, פעם אחת.** עד 24/08/2026
 * הוא היה כתוב בשלושה מקומות: `priority-context` החזירה הכל, החלונית
 * חסמה תבנית עם מסמך לפי `needsDocument`, והדשבורד סינן שוב בדפדפן ב-
 * `lib/wa-templates.ts`. שלוש הצהרות של אותו כלל, ואחת מהן כבר נפרדה:
 * החלונית לא הציעה שום תבנית כשהחלון היה סגור ושלחה את העובד לפריוריטי,
 * בזמן שהדשבורד כבר ידע לשלוח משם. [[screen_and_sender_must_share_one_module]]
 *
 * ⭐ **`allowDocument` הוא הקו המפריד, וזה הקו האמיתי:**
 *   תבנית שדורשת מסמך **חדש לכל הודעה** (תעודה, חשבונית) מחייבת את הסשן
 *   של פריוריטי כדי להפיק אותו, ולכן היא נשלחת מהחלונית בלבד, כשעומדים
 *   על השורה. כל השאר, כולל תבנית שנושאת מדיה **קבועה** כמו סרטון
 *   הבטיחות, נשלחות מכל מקום, כי הקובץ כבר יושב אצל heyy.
 *
 * 🔴 ותבנית שמטא עוד לא אישרה אינה נעלמת בשקט אלא חוזרת עם `available:
 * false` ועם הסיבה. תבנית שנמחקה מהרשימה נראית כמו תבנית שלא קיימת, ואז
 * מחפשים אותה במסך הניהול ולא מבינים למה היא לא שם.
 */
export interface PanelTemplate {
  key: string;
  label: string;
  variables: string[];
  preview: string;
  category: string;
  /** מדיה קבועה שאושרה עם התבנית: "video" · "document" · null. */
  attachmentKind: string | null;
  available: boolean;
  needsDocument: boolean;
  unavailableReason: string | null;
}

export function toPanelTemplates(
  list: WaTemplate[],
  opts: { allowDocument: boolean },
): PanelTemplate[] {
  const out: PanelTemplate[] = [];
  for (const t of list) {
    // תבנית שדורשת מסמך פר-הודעה אינה שייכת למקום שאין בו שורה בפריוריטי.
    if (t.mediaPerMessage && !opts.allowDocument) continue;

    const approved = t.heyyStatus === 'active';
    out.push({
      key: t.key,
      label: t.label,
      variables: t.variables,
      preview: t.bodyPreview,
      category: t.category,
      attachmentKind: t.attachmentKind,
      available: approved,
      needsDocument: t.mediaPerMessage,
      unavailableReason: approved ? null : 'מטא עוד לא אישרה את התבנית הזאת.',
    });
  }
  return out;
}
