/**
 * החיווי שהלקוח ענה על הסקר, ומה הוא ענה.
 *
 * ⭐ **עידן, 25/08/2026: "אנחנו לא חייבים להסתמך רק על נתוני הווצאפ."**
 * נכון, ויותר מזה: אצלנו יושב **הציון עצמו** (`q1_satisfaction`),
 * ההמלצה, וההערה החופשית. וואטסאפ יודעת רק שנשלחה הודעה.
 *
 * 🔴🔴 **ולכן לא סמיילי אחיד לכולם.** נמדד על 23 התשובות הראשונות:
 * **20 נתנו 5, ואחד נתן 2.** חיווי זהה לכולם היה קובר בדיוק את היחיד
 * שצריך לקפוץ לעיניים, והופך את הסימן לרעש. [[color_on_everything_is_not_color]]
 *
 * ⭐ בלי ייבוא, ולכן נבדק ביחידה, ומשמש גם את התיבה וגם את כרטיס הלקוח.
 */

export interface SurveyMark {
  /** האימוג'י שמוצג בשורה. */
  emoji: string;
  /** תווית קצרה לצד האימוג'י, או ריק כשהאימוג'י מספיק. */
  label: string;
  /** 'good' | 'ok' | 'bad' — קובע צבע. */
  tone: 'good' | 'ok' | 'bad';
  /** מה שמופיע ב-title בריחוף. */
  title: string;
}

export interface SurveyAnswer {
  /** 1 עד 5. null כשהלקוח פתח וענה בלי לדרג. */
  score: number | null;
  answeredAt: string | null;
  comment?: string | null;
}

/** "25.8.2026" — עם שנה, כמו בכל מקום אחר במערכת. */
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

/**
 * 🔴 **הסף הוא 3 ומטה, ולא "פחות מ-5".** לקוח שנתן 4 מרוצה, וסימון
 * שלו כבעיה היה מייצר התראות שווא שמלמדות להתעלם מהסימן.
 */
export function surveyMark(a: SurveyAnswer | null | undefined): SurveyMark | null {
  if (!a || !a.answeredAt) return null;

  const when = shortDate(a.answeredAt);
  const note = a.comment?.trim() ? ' · השאיר הערה' : '';
  const s = a.score;

  if (s == null) {
    return {
      emoji: '📝', label: '', tone: 'ok',
      title: `ענה על הסקר ב-${when}, בלי דירוג${note}`,
    };
  }
  if (s >= 5) {
    return {
      emoji: '😍', label: '5', tone: 'good',
      title: `ענה על הסקר ב-${when} ונתן 5 מתוך 5${note}`,
    };
  }
  if (s === 4) {
    return {
      emoji: '🙂', label: '4', tone: 'good',
      title: `ענה על הסקר ב-${when} ונתן 4 מתוך 5${note}`,
    };
  }
  if (s === 3) {
    return {
      emoji: '😐', label: '3', tone: 'ok',
      title: `ענה על הסקר ב-${when} ונתן 3 מתוך 5${note}`,
    };
  }
  return {
    emoji: '😞', label: String(s), tone: 'bad',
    title: `ענה על הסקר ב-${when} ונתן ${s} מתוך 5${note}`,
  };
}

/** מחלקות הצבע, במקום אחד, כדי ששלושת המסכים לא ייפרדו. */
export const SURVEY_TONE: Record<SurveyMark['tone'], string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ok: 'border-slate-200 bg-slate-50 text-slate-700',
  bad: 'border-red-200 bg-red-50 text-red-700',
};
