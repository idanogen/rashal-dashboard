/**
 * רשימת הבדיקה לטכנאי בכיסא גלגלים ממונע.
 *
 * ⭐ **הועתקה מהטופס של ר.שעל** ("רשימת בדיקה לטכנאי, כיסא גלגלים ממונע",
 * מבוסס על מדריך המשתמש של SUNRISE / PRIDE), ששלומי שלח ב-<bdi>03/11/2026</bdi>
 * (`~/Idan-HQ/meetings/rashal/2026-11-03-רשימת-בידוק-כג-ממונע/`).
 * 🔴 **לא נוסח מחדש ולא קוצר.** השינוי היחיד: שתי שורות המשנה של "מצברים"
 * נושאות את המילה בעצמן, כי במסך אין הזחה.
 *
 * שלומי, 03/11: "להכניס את הרשימה לאפליקציית הטכנאים בזהה לתהליך שבוצע
 * בעולם המנופים", "חתימות חובה". לכן אותו מבנה, אותה טבלה (`crane_forms`,
 * `form_type = 'chair_inspection'`) ואותו מסך, ובשונה מהמנוף גם החתימה חובה.
 *
 * ⭐ הכלל "זו קריאה על כיסא ממונע" חי במסד (`stop_checklist_kind`,
 * `20261110_chair_checklist.sql`), לא כאן.
 */
import { progressOf, type ChecklistSection, type CraneVerdict, type SubmitCheck } from './crane-checklist.ts';

export const CHAIR_CHECKLIST_TITLE = 'רשימת בדיקה לטכנאי, כיסא גלגלים ממונע';
export const CHAIR_CHECKLIST_SUBTITLE = 'מבוסס על מדריך למשתמש של חברת SUNRISE / PRIDE';

/** הערך של `crane_forms.form_type`, וגם של `checklist_kind` שהמסד מחזיר לעצירה. */
export const CHAIR_FORM_TYPE = 'chair_inspection';

/** גרסת הטופס. נשמרת עם כל מילוי, כדי שטופס ישן יישאר קריא כפי שנחתם. */
export const CHAIR_CHECKLIST_VERSION = 1;

export const CHAIR_CHECKLIST: ChecklistSection[] = [
  {
    id: 'structure',
    title: 'מבנה',
    items: [
      { id: 's1', text: 'שלדה: היעדר סדקים / קורוזיה' },
      { id: 's2', text: 'תקינות ושלמות: ידיות הובלה, מסעדי ידיים ומשענת ראש (במידה וקיימת), גב ומושב' },
      {
        id: 's3',
        text: 'רגליות: רגליים נפתחות/נסגרות חלק ללא רופפות בצירים ובמשטחי כפות הרגליים (רלוונטי גם עבור רגלית מרכזית)',
      },
      { id: 's4', text: 'חגורת אגן / בטיחות: בדיקת הימצאות ותקינות' },
    ],
  },
  {
    id: 'electric',
    title: 'מערכת חשמלית ומערכת ניהוג',
    items: [
      {
        id: 'e1',
        text: 'מצברים: בדוק התקנה נאותה כולל תקינות חיווט, וודא היעדר ירקת ו/או קורוזיה והידוק הקטבים',
      },
      { id: 'e2', text: 'מצברים: בדוק מתח מצברים' },
      {
        id: 'e3',
        text: "ג'ויסטיק: התקנה נאותה כולל פרזול ומערכת הסטה, תפקוד לחצנים ומתגים (בכיסא בו מותקנת מערכת מתגים)",
      },
      { id: 'e4', text: 'מערכת תאורה: בדיקה חשמלית והתקנה נאותה' },
    ],
  },
  {
    id: 'wheels',
    title: 'צמיגים / גלגלים',
    items: [{ id: 'w1', text: 'בדוק לתקינות והיעדר בלאי לגלגלים וצמיגים (הנעה / סבסוב) ובדיקת המסבים' }],
  },
  {
    id: 'functional',
    title: 'בדיקה תפקודית',
    items: [{ id: 'f1', text: 'בצע בדיקת תקינות כללית לכיסא כולל בדיקת נסיעה' }],
  },
  {
    id: 'safety',
    title: 'העברת דגשי בטיחות למשתמש / מטפל/ת',
    items: [
      {
        id: 'b1',
        text: 'הועברו דגשים לשימוש בכיסא גלגלים כולל דגשי טעינה ותפעול בחרום (מעבר ממצב נסיעה למצב הובלה ידנית)',
        critical: true,
      },
    ],
  },
];

/**
 * האם מותר להגיש. אותו כלל כמו במנוף ("תקין להפעלה" מחייב שהכל סומן, "הוצא
 * משימוש" מותר גם עם פריטים פתוחים), ועוד תנאי אחד.
 *
 * 🔴 **החתימה חובה** (שלומי, 03/11/2026: "חתימות חובה"). בלי חתימה אין טופס.
 */
export function canSubmitChair(
  answers: Record<string, boolean>,
  verdict: CraneVerdict | null,
  recipientName: string,
  signature: string | null,
): SubmitCheck {
  if (!verdict) return { ok: false, reason: 'צריך לקבוע אם הכיסא תקין להפעלה' };
  if (verdict === 'ok') {
    const p = progressOf(answers, CHAIR_CHECKLIST);
    if (p.missing.length > 0) return { ok: false, reason: `נותרו ${p.missing.length} פריטים לא מסומנים` };
  }
  if (!recipientName.trim()) return { ok: false, reason: 'צריך את שם מקבל/ת השירות או ההדרכה' };
  if (!signature) return { ok: false, reason: 'צריך חתימה של מקבל/ת השירות או ההדרכה' };
  return { ok: true };
}
