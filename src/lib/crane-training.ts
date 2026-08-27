/**
 * אישור קבלת הדרכה: הטופס שהלקוח חותם עליו כשמנוף מגיע אליו הביתה.
 *
 * שלומי, <bdi>20/08/2026</bdi>: "באספקת מנוף הלקוח צריך לקבל מדריך
 * למשתמש ולחתום על טופס".
 *
 * ⭐⭐ **הנושאים אינם נכתבים כאן מחדש אלא נגזרים מפרק הבטיחות של רשימת
 * הבדיקה** (`CRANE_CHECKLIST`, פרק `safety`). זה אותו נוסח בדיוק, כי זה
 * אותו דבר בדיוק: מה שהטכנאי מסמן שהסביר הוא מה שהלקוח חותם שקיבל.
 * שני עותקים של אותם שמונה משפטים היו נפרדים בשקט ברגע שמישהו יתקן
 * ניסוח באחד מהם. [[label_and_math_from_two_mechanisms]]
 *
 * 🔴🔴 **ואין כאן דלת אחורית כמו ב"הוצא משימוש".** בטופס הטכנאי מותר
 * להגיש מילוי חלקי כשהמנוף פגום, כי אז חלק מהבדיקות באמת לא בוצעו.
 * כאן ההפך: אם נושא לא הוסבר, אסור שהלקוח יחתום שהוא קיבל הדרכה עליו.
 * הטופס נחתם במלואו או שאינו נחתם.
 */
// 🔴 עם סיומת `.ts` במפורש. הפרויקט מריץ את הקובץ הזה גם ב-node
// (`node --test`), ושם ייבוא יחסי בלי סיומת אינו נפתר. `allowImportingTsExtensions`
// כבר דלוק ב-tsconfig, ולכן Vite ו-node מסתדרים עם אותה שורה.
import { CRANE_CHECKLIST, type ChecklistItem } from './crane-checklist.ts';

export const TRAINING_TITLE = 'אישור קבלת הדרכה, מנוף SUNLIFT (175/150)';
export const TRAINING_SUBTITLE =
  'המשתמש/ת או המטפל/ת מאשר/ת שקיבל/ה הדרכה מלאה ומדריך למשתמש';

/** גרסת הטופס. 🔴 נשמרת עם כל מילוי, כדי שטופס ישן יישאר קריא כפי שנחתם. */
export const TRAINING_VERSION = 1;

/**
 * נושאי ההדרכה, מפרק הבטיחות של רשימת הבדיקה.
 * 🔴 אם הפרק הזה ישונה או ישנה שם, הבדיקה `crane-training.test.mjs`
 * תיפול מיד, ולא נגלה בשטח שהטופס נחתם על רשימה ריקה.
 */
export const TRAINING_TOPICS: ChecklistItem[] =
  CRANE_CHECKLIST.find((s) => s.id === 'safety')?.items ?? [];

export interface SlingDetails {
  manufacturer: string;
  productionDate: string;
  serial: string;
}

export interface TrainingGate {
  ok: boolean;
  /** מה חוסם, בעברית, מוכן להצגה. */
  reason?: string;
}

/**
 * האם מותר להחתים.
 *
 * הסדר של הבדיקות הוא סדר התיקון: קודם מה שדורש עוד עבודה בשטח, ואחר
 * כך מה שדורש רק להקליד. ⭐ הודעה אחת בכל רגע, כי שלוש הודעות במקביל
 * הן רעש והמשתמש בוחר אחת מהן.
 */
export function canSubmitTraining(
  answers: Record<string, boolean>,
  recipientName: string,
  signature: string | null
): TrainingGate {
  if (TRAINING_TOPICS.length === 0) {
    // 🔴 בקרה על עצמנו: רשימה ריקה פירושה שהפרק ב-`CRANE_CHECKLIST`
    // שינה מזהה. טופס בלי נושאים היה נחתם בקלות ולא היה אומר כלום.
    return { ok: false, reason: 'רשימת נושאי ההדרכה ריקה, יש לפנות לתמיכה' };
  }
  const missing = TRAINING_TOPICS.filter((t) => !answers[t.id]);
  if (missing.length > 0) {
    return {
      ok: false,
      reason:
        missing.length === 1
          ? 'נותר נושא אחד שלא סומן'
          : `נותרו ${missing.length} נושאים שלא סומנו`,
    };
  }
  if (!recipientName.trim()) return { ok: false, reason: 'חסר שם מקבל/ת ההדרכה' };
  if (!signature) return { ok: false, reason: 'חסרה חתימה' };
  return { ok: true };
}

export interface TrainingProgress {
  checked: number;
  total: number;
  missing: ChecklistItem[];
}

export function trainingProgress(answers: Record<string, boolean>): TrainingProgress {
  const missing = TRAINING_TOPICS.filter((t) => !answers[t.id]);
  return { checked: TRAINING_TOPICS.length - missing.length, total: TRAINING_TOPICS.length, missing };
}
