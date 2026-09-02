import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { Survey } from '@/lib/surveys';
import { surveyMark, SURVEY_TONE } from '@/lib/survey-badge';
import { surveyWhen } from '@/lib/survey-when';
import { waChatUrl } from '@/lib/wa-chat-link';
import { useSetSurveyHandled } from '@/hooks/useSurveys';
import { SurveyDetailSheet } from '@/components/surveys/SurveyDetailSheet';

/**
 * "לקוחות בדירוג נמוך" כרשימת עבודה (בקשת עידן, <bdi>02/09/2026</bdi>).
 *
 * 🔴🔴 **הפאנל הזה היה רשימה בלי אף פעולה.** אותם שלושה שמות הופיעו בכל
 * פתיחה של המסך, ולא היה שום מקום לרשום בו שדיברנו איתם, ולכן אי אפשר
 * היה לדעת אם מישהו כבר טיפל. רשימה שלא מתרוקנת מפסיקים להסתכל עליה.
 *
 * ⭐ **לחיצה על השם פותחת את חוות הדעת עצמה**: שני הדירוגים, המלל,
 * הנהג וציר הזמן, ומשם גם וואטסאפ וגם כרטיס הלקוח.
 * 🔴🔴 **בגרסה הראשונה הלחיצה פתחה וואטסאפ ישירות, ועידן פסל.** המסך
 * זרק את המשתמש לשורת כתיבה ריקה מול לקוח לא מרוצה **לפני** שראה מה
 * הוא דירג ומה כתב. פנייה ללקוח היא החלטה, לא תוצאה של לחיצה על שם.
 * ⭐ ו**כפתור "סמן כטופל"** מוריד אותו מהרשימה עם שם ותאריך.
 *
 * 🔴🔴 **הכפתור אומר "סמן כטופל" ולא "טופל", והוא אינו ירוק.** בגרסה
 * הראשונה הוא היה תג ירוק עם וי והמילה "טופל", ובצילום נראה בדיוק כמו
 * **חיווי מצב**: שתי השורות הפתוחות נראו מטופלות, והמטופלת האמיתית, שעליה
 * כתוב "בטל", נראתה פתוחה. פעולה וסטטוס לא נראים אותו דבר.
 *
 * 🔴 **מי שטופל לא נמחק, אלא יורד למטה ומעומעם**, ורשום עליו מי סימן
 * ומתי. מחיקה הייתה מוחקת גם את התשובה לשאלה "מי דיבר איתו".
 * 🔴 **ולקוח בלי נייד תקין מקבל תווית "אין נייד"** כבר בשורה, כדי
 * שיהיה ברור לפני הפתיחה שאי אפשר יהיה לכתוב לו. היעדר חייב לדבר.
 */
export function LowRatedList({ rows }: { rows: Survey[] }) {
  const handle = useSetSurveyHandled();
  const [openId, setOpenId] = useState<string | null>(null);
  // 🔴 השורה נשלפת מהרשימה הטרייה ולא נשמרת ב-state, אחרת סימון "טופל"
  // מתוך המגירה לא היה מתעדכן במגירה עצמה.
  const openRow = rows.find((r) => r.id === openId) ?? null;

  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">אף לקוח לא נתן ציון נמוך</p>;
  }

  return (
    <div className="divide-y" style={{ borderColor: '#eef1f6' }}>
      {rows.map((s) => {
        const mark = surveyMark({ score: s.satisfaction, answeredAt: s.answeredAt, comment: s.comment });
        const hasPhone = waChatUrl(s.phoneE164) !== null;
        const done = s.handledAt !== null;
        const busy = handle.isPending && handle.variables?.id === s.id;

        return (
          <div
            key={s.id}
            className={`flex items-start gap-2 py-2.5 text-xs first:pt-1 last:pb-1 ${done ? 'opacity-60' : ''}`}
          >
            {mark && (
              <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${SURVEY_TONE[mark.tone]}`}
                title={mark.title}
              >
                {mark.emoji} {mark.label}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setOpenId(s.id)}
                className="text-start font-semibold text-slate-800 hover:text-slate-950 hover:underline"
                title="פתיחת חוות הדעת המלאה"
              >
                {s.customerName ?? 'לקוח'}
              </button>
              {!hasPhone && (
                <span className="ms-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-400">
                  אין נייד
                </span>
              )}

              {s.comment && <span className="block text-slate-500">{s.comment}</span>}

              {done && (
                <span className="mt-0.5 block text-[11px] font-semibold text-emerald-700">
                  ✓ טופל{s.handledBy ? ` · ${s.handledBy}` : ''} · <bdi>{surveyWhen(s.handledAt)}</bdi>
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => handle.mutate({ id: s.id, handled: !done })}
              className={
                done
                  ? 'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50'
                  : 'inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50'
              }
              title={done ? 'ביטול הסימון' : 'סימון שדיברנו עם הלקוח או שנשלחה לו הודעה'}
            >
              {done ? (
                <>
                  <RotateCcw className="h-3 w-3" />
                  בטל
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  סמן כטופל
                </>
              )}
            </button>
          </div>
        );
      })}

      <SurveyDetailSheet
        survey={openRow}
        open={openRow !== null}
        onOpenChange={(v) => !v && setOpenId(null)}
      />
    </div>
  );
}