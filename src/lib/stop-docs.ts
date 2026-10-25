/**
 * חיווי "יש מסמך מצורף" על כרטיס העצירה ביומן (עידן, 21/10/2026: "אני רוצה
 * שבדשבורד יהיה חיווי איפה יש מסמך מצורף, תעודות משלוח או קריאת שירות").
 *
 * 🔴 הרקע: התעודה להחתמה (18/10) והטפסים החתומים הופיעו רק לנהג באפליקציה
 * ובכרטיס הלקוח. ביומן של המשרד היה רק "📄 טופס" קטן בתוך כפתור הקריאה, ולכן
 * הסדרן לא ראה למי יש תעודה ולמי לא.
 *
 * קובץ טהור, בלי ייבוא, כדי שייבדק ב-node --test.
 */

export type StopDocKind = 'signed' | 'note' | 'callDoc' | 'missingTraining';

export interface StopDocChip {
  kind: StopDocKind;
  label: string;
  title: string;
}

export interface StopDocInput {
  sourceType: string;
  /** תעודת המשלוח המקורית מפריוריטי (SH...), אם נקלטה. */
  noteDocno?: string | null;
  /** כמה טפסים נחתמו על העצירה (תעודה, החזרה, תיקון). */
  signedCount?: number;
  /** טופס הקריאה המקורי מפריוריטי (קריאת שירות בלבד). */
  hasCallDoc?: boolean;
  /** איזה טופס מנוף העצירה דורשת, אם בכלל (`stops_form_status`). */
  craneKind?: 'training' | 'inspection' | null;
  /** האם טופס המנוף מולא. */
  craneSigned?: boolean;
  /** האם העצירה סומנה בוצע. */
  completed?: boolean;
}

/**
 * ⭐ סדר: חתום קודם (זה מה שהמשרד מחפש אחרי הביקור), אחריו המקור.
 * תעודה שנחתמה לא מוצגת פעמיים: "נחתם" מחליף את "תעודה".
 */
export function stopDocChips(s: StopDocInput): StopDocChip[] {
  const chips: StopDocChip[] = [];
  const signed = s.signedCount ?? 0;
  const isDelivery = s.sourceType === 'delivery' || s.sourceType === 'customer';
  if (signed > 0) {
    chips.push({
      kind: 'signed',
      label: signed > 1 ? `✍️ נחתם ×${signed}` : '✍️ נחתם',
      title: 'הטופס החתום מהביקור. לחיצה פותחת אותו',
    });
  }
  if (isDelivery && s.noteDocno && signed === 0) {
    chips.push({
      kind: 'note',
      label: '📄 תעודה',
      title: `תעודת משלוח ${s.noteDocno} מפריוריטי, מחכה לחתימה. לחיצה פותחת אותה`,
    });
  }
  if (s.sourceType === 'service' && s.hasCallDoc) {
    chips.push({
      kind: 'callDoc',
      label: '📄 טופס קריאה',
      title: 'טופס הקריאה המקורי מפריוריטי נקלט מהמייל. לחיצה פותחת את כרטיס הקריאה',
    });
  }
  // 🔴 אספקת מנוף שנסגרה בלי אישור הדרכה חתום (עמי, 25/10/2026: לוזון).
  // טופס המנוף בכוונה לא חוסם סגירה, ולכן החוסר חייב להיראות למשרד.
  if (isDelivery && s.completed && s.craneKind === 'training' && !s.craneSigned) {
    chips.push({
      kind: 'missingTraining',
      label: '⚠️ בלי הדרכה',
      title: 'מנוף סופק והעצירה נסגרה בלי אישור קבלת הדרכה חתום. להשלים מול הנהג או בביקור הבא',
    });
  }
  return chips;
}
