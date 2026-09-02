// ─── יעד האספקות השבועי ───────────────────────────────────────────────────
//
// **הבקשה (שלומי, 02/09/2026):** להציג בכרטיס האספקות עמידה ביעד שבועי של
// <bdi>147</bdi> תעודות משלוח.
//
// 🔴🔴 **ולמה זה לא סרגל אחוזים.** נמדד לפני הבנייה, 13 שבועות של תעודות
// משלוח לא מבוטלות: החציון **99** והשיא **127**, כלומר **היעד לא הושג
// מעולם**. סרגל שמראה "58% מהיעד" יהיה אדום בכל יום ראשון בבוקר, ותוך
// שבועיים אף אחד לא יסתכל עליו. מדד שתמיד אדום שווה למדד שאינו קיים.
//
// ⭐ **לכן המדד הוא קצב ולא אחוז.** השאלה שמנהל שואל ביום רביעי אינה "כמה
// מהיעד עשינו" אלא "האם אנחנו בקצב שסוגר את השבוע", ואלה שתי שאלות שונות:
// 85 מתוך 147 ביום רביעי הוא קצב מצוין, ואותם 85 ביום חמישי בערב הם פיגור.
//
// ⭐ **עקומת השבוע נמדדה מהנתונים האמיתיים** (מאי עד אוגוסט 2026), ולא
// הונחה: העבודה אינה מתפזרת שווה בין הימים, ויום שלישי לבדו הוא רבע
// מהשבוע. בלי העקומה, "צפוי עד עכשיו" ביום שלישי היה שגוי ב-20%.
//
// 🔴 **והעקומה היא קבוע מדוד ולא חישוב מתגלגל, בכוונה.** עקומה שמחשבת את
// עצמה מחדש כל שבוע מזיזה את קו ה"צפוי" מתחת לרגליים של מי שמסתכל, ומנהל
// שרואה מספר שמשתנה בלי שהעבודה השתנתה מפסיק להאמין למסך. לרענון: לספור
// תעודות לפי יום בשבוע על פני רבעון ולעדכן כאן.
//
// 🔴 **והשבוע מתחיל ביום ראשון.** `date_trunc('week')` של פוסטגרס מתחיל
// ביום שני, וזו בדיוק המלכודת שנפלתי בה במדידה: יום ראשון, שהוא 17%
// מהשבוע, היה נספר לשבוע הקודם.

/** תעודות משלוח בשבוע. הבקשה של שלומי, 02/09/2026. */
export const WEEKLY_TARGET = 147;

/**
 * חלק מצטבר של השבוע **בסוף** כל יום, לפי אינדקס ‎0=ראשון‎ עד ‎6=שבת‎.
 * נמדד: ראשון 17.2% · שני 17.1% · שלישי 25.3% · רביעי 21.4% · חמישי 17.4% ·
 * שישי 1.6%. שבת אפס.
 */
export const WEEK_CURVE = [0.172, 0.343, 0.596, 0.810, 0.984, 1, 1] as const;

/** שעות שבהן העבודה נצברת. מחוץ להן ה"צפוי" לא זז. */
const DAY_START_H = 8;
const DAY_END_H = 18;

/** תחילת השבוע הישראלי (ראשון) של תאריך נתון, בחצות מקומית. */
export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

/**
 * איזה חלק מהשבוע אמור להיות מאחורינו ברגע נתון.
 * בתוך היום מתקדם ליניארית בין סוף אתמול לסוף היום, כדי שהמספר יזוז
 * במהלך היום ולא יקפוץ בחצות.
 */
export function expectedShare(now: Date): number {
  const dow = now.getDay();
  const prev = dow === 0 ? 0 : WEEK_CURVE[dow - 1];
  const todayEnd = WEEK_CURVE[dow];
  const hours = now.getHours() + now.getMinutes() / 60;
  const progress =
    hours <= DAY_START_H ? 0
    : hours >= DAY_END_H ? 1
    : (hours - DAY_START_H) / (DAY_END_H - DAY_START_H);
  return prev + (todayEnd - prev) * progress;
}

export type TargetVerdict = 'ahead' | 'on_track' | 'behind';

export interface TargetStatus {
  target: number;
  actual: number;
  /** כמה אמורות להיות עד עכשיו לפי הקצב */
  expected: number;
  /** בפועל פחות צפוי. שלילי = פיגור */
  gap: number;
  /** היכן ייסגר השבוע בקצב הזה. null כשמוקדם מדי מכדי לחזות */
  projected: number | null;
  /** אחוז מהיעד, לרוחב הסרגל */
  pct: number;
  verdict: TargetVerdict;
}

/**
 * 🔴 מתחת לסף הזה אין תחזית. בבוקר יום ראשון תעודה בודדת הייתה מתורגמת
 * ל"תחזית 300", וזה מספר שנראה כמו מידע ואינו.
 */
const MIN_SHARE_FOR_PROJECTION = 0.15;

export function deliveryTargetStatus(
  actual: number,
  now: Date,
  target: number = WEEKLY_TARGET,
): TargetStatus {
  const share = expectedShare(now);
  const expected = Math.round(target * share);
  const projected =
    share >= MIN_SHARE_FOR_PROJECTION ? Math.round(actual / share) : null;

  // ⭐ **הפסיקה נגזרת מהקצב ולא מהמספר הגולמי**, כלומר מהפער מול הצפוי
  // עד עכשיו. 🔴 הגרסה הראשונה נשענה על התחזית ונפלה בדיוק במקום שבו אין
  // תחזית: בבוקר יום ראשון 4 תעודות מול 3 צפויות הן **הקדמה**, והמסך אמר
  // "מתחת לקצב" כי 4 קטן מ-147. נתפס בצילום, לא בעין.
  // (מתמטית זה זהה לתחזית מול היעד כשיש תחזית, ולכן אין כאן שתי הגדרות.)
  const gap = actual - expected;
  const verdict: TargetVerdict =
    gap >= 0 ? 'ahead' : gap >= -target * 0.05 ? 'on_track' : 'behind';

  return {
    target,
    actual,
    expected,
    gap,
    projected,
    pct: target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0,
    verdict,
  };
}

/** תעודה נספרת ליעד: לא מבוטלת, ויש לה תאריך. */
export function countsTowardTarget(status?: string | null, docDate?: string | null): boolean {
  return Boolean(docDate) && status !== 'מבוטלת';
}
