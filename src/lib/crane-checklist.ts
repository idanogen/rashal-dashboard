/**
 * רשימת הבדיקה לטכנאי במנוף SUNLIFT 150/175.
 *
 * ⭐ **הועתקה מילה במילה מהטופס של ר.שעל** ("רשימת בדיקה לטכנאי, מנוף
 * SUNLIFT (175/150)", מבוסס על מדריך המשתמש של SUNRISE), שעידן צירף
 * ב-<bdi>26/08/2026</bdi>. 🔴 **לא נוסח מחדש ולא קוצר**: זה טופס בטיחות
 * של ציוד הרמה רפואי, והניסוח שלו הוא מה שהטכנאי מכיר ומה שעומד מאחוריו.
 *
 * ⭐ **קובץ בלי שום ייבוא, ולכן נבדק ביחידה.** אותו דפוס של
 * `coordination-message` ו-`survey-badge`: הנוסח שנמסר ללקוח או שנחתם
 * על ידו לא ייבדק בעיניים בכל שינוי, ולכן הוא נבדק בקוד.
 *
 * 🔴 **הפריטים המודגשים הם אלה שמסומנים באדום בטופס המקורי**, וכולם
 * נוגעים בעצירת חירום, בהורדת חירום ובמנשא. אלה הדברים שהורגים כשהם
 * לא נבדקו, ולכן ההדגשה נשמרת עד המסך ואינה "עיצוב".
 */

export interface ChecklistItem {
  id: string;
  text: string;
  /** מסומן באדום בטופס המקורי: פריט בטיחות קריטי. */
  critical?: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export const CRANE_CHECKLIST_TITLE = 'רשימת בדיקה לטכנאי, מנוף SUNLIFT (175/150)';
export const CRANE_CHECKLIST_SUBTITLE = 'מבוסס על מדריך למשתמש של חברת SUNRISE';

/** גרסת הטופס. 🔴 נשמרת עם כל מילוי, כדי שטופס ישן יישאר קריא כפי שנחתם. */
export const CRANE_CHECKLIST_VERSION = 1;

export const CRANE_CHECKLIST: ChecklistSection[] = [
  {
    id: 'structure',
    title: 'מבנה, גלגלים ורגליים',
    items: [
      { id: 's1', text: 'שלדה, תורן וזרוע: ללא כפיפה / סדק / קורוזיה' },
      { id: 's2', text: '4 גלגלי כיוונון נעים חופשי; בלמים אחוריים אוחזים היטב' },
      { id: 's3', text: 'רגליים נפתחות/נסגרות חלק, ללא רופפות בצירים' },
      { id: 's4', text: 'ידית נעילת התורן מאבטחת כראוי' },
    ],
  },
  {
    id: 'electric',
    title: 'מערכת חשמלית',
    items: [
      { id: 'e1', text: 'בוכנה נעה חלק בשני הכיוונים ונעצרת בסוף המהלך' },
      { id: 'e2', text: 'שלט ידני: לחצנים מגיבים, תקע מחובר היטב' },
      { id: 'e3', text: 'סוללות טעונות (נורית ירוקה); כבל טעינה שלם' },
      { id: 'e4', text: 'לחצן עצירת חירום מנתק חשמל ומתאפס כראוי', critical: true },
      { id: 'e5', text: 'הורדת חירום ידנית + חשמלית פועלות', critical: true },
    ],
  },
  {
    id: 'sling',
    title: 'מתלה, מוט הפרדה ומנשא',
    items: [
      { id: 'm1', text: 'מוט הפרדה מסתובב חופשי ומאובטח לתורן' },
      { id: 'm2', text: 'הווים שלמים, ללא בלאי' },
      { id: 'm3', text: 'מנשא: ללא קרעים / פרימת תפרים; מתאים למטופל', critical: true },
    ],
  },
  {
    id: 'functional',
    title: 'בדיקה תפקודית',
    items: [{ id: 'f1', text: 'בוצעה הרמה מלאה והורדה ללא רעשים חריגים' }],
  },
  {
    id: 'safety',
    title: 'העברת דגשי בטיחות למשתמש / מטפל/ת',
    items: [
      { id: 'b1', text: 'הוסבר השימוש בלחצן עצירת החירום ואיפוסו', critical: true },
      { id: 'b2', text: 'הוסברה הורדת חירום ידנית וחשמלית', critical: true },
      {
        id: 'b3',
        text: 'הוסברה התאמת המנשא הנכונה (רצועות ארוכות לרגליים, קצרות לכתפיים) והתאמתו למטופל',
        critical: true,
      },
      {
        id: 'b4',
        text: 'הועברו דגשים לשימוש בערסל בדגש על בדיקת אי היתפרות קרעים, שפשופים ברצועות הערסל',
        critical: true,
      },
      { id: 'b5', text: 'הוסבר לפנות ידיים ומהמפעיל החשמלי ומהחלקים הנעים בעת הרמה/הורדה' },
      { id: 'b6', text: 'הוסבר לכוון ולנעול את רגלי המנוף לפני הזזה/העברה' },
      { id: 'b7', text: 'הוסבר כי אין להשתמש במנוף או להטעין באמבטיה / חדר אמבטיה' },
      { id: 'b8', text: 'הוסברה טעינת הסוללות התקינה (חיבור למנוף לפני החשמל)' },
    ],
  },
];

export type CraneVerdict = 'ok' | 'out_of_service';

export const VERDICT_LABELS: Record<CraneVerdict, string> = {
  ok: 'תקין להפעלה',
  out_of_service: 'הוצא משימוש, לא תקין',
};

/** כל מזהי הפריטים, בסדר הטופס. */
export function allItemIds(): string[] {
  return CRANE_CHECKLIST.flatMap((s) => s.items.map((i) => i.id));
}

export interface ChecklistProgress {
  checked: number;
  total: number;
  /** פריטי בטיחות קריטיים שטרם סומנו. */
  missingCritical: ChecklistItem[];
  /** כל הפריטים שטרם סומנו. */
  missing: ChecklistItem[];
}

export function progressOf(answers: Record<string, boolean>): ChecklistProgress {
  const all = CRANE_CHECKLIST.flatMap((s) => s.items);
  const missing = all.filter((i) => !answers[i.id]);
  return {
    checked: all.length - missing.length,
    total: all.length,
    missingCritical: missing.filter((i) => i.critical),
    missing,
  };
}

export interface SubmitCheck {
  ok: boolean;
  /** מה חוסם, בעברית, מוכן להצגה. */
  reason?: string;
}

/**
 * האם מותר להגיש.
 *
 * 🔴🔴 **טכנאי רשאי להגיש טופס עם פריטים לא מסומנים, אבל רק אם הוא
 * הכריז שהמנוף לא תקין.** זו לא קפדנות: מנוף שנמצא פגום הוא בדיוק המקרה
 * שבו חלק מהבדיקות לא בוצעו, וחסימה מוחלטת הייתה מכריחה אותו לסמן וי
 * על דברים שלא בדק כדי שהמערכת תיתן לו לדווח על התקלה.
 *
 * ⭐ ובכיוון ההפוך: **"תקין להפעלה" מחייב שהכל סומן.** הצהרה שמנוף תקין
 * כשלא נבדקה עצירת חירום היא בדיוק מה שהטופס נועד למנוע.
 */
export function canSubmit(
  answers: Record<string, boolean>,
  verdict: CraneVerdict | null,
  recipientName: string,
): SubmitCheck {
  if (!verdict) return { ok: false, reason: 'צריך לקבוע אם המנוף תקין להפעלה' };
  if (!recipientName.trim()) return { ok: false, reason: 'צריך את שם מקבל/ת ההדרכה' };

  if (verdict === 'ok') {
    const p = progressOf(answers);
    if (p.missing.length > 0) {
      const c = p.missingCritical.length;
      return {
        ok: false,
        reason: c
          ? `נותרו ${p.missing.length} פריטים לא מסומנים, ומהם ${c} פריטי בטיחות`
          : `נותרו ${p.missing.length} פריטים לא מסומנים`,
      };
    }
  }
  return { ok: true };
}
