import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CustomerCardButton } from '@/components/customer/CustomerCardSheet';
import type { Survey } from '@/lib/surveys';
import { surveyWhen } from '@/lib/survey-when';
import { waInboxPath } from '@/lib/wa-chat-link';
import { useSetSurveyHandled } from '@/hooks/useSurveys';

const NAVY = '#14223a';

/**
 * חוות הדעת עצמה, במגירה (בקשת עידן, <bdi>02/09/2026</bdi>).
 *
 * 🔴🔴 **הגרסה הראשונה של הלחיצה פתחה וואטסאפ, ועידן פסל.** "הקישור
 * מוביל לשליחת הודעה ישירות מהמסך, זה לא מתאים." הוא צדק: המסך זרק
 * אותך לשורת כתיבה ריקה מול לקוח לא מרוצה, **לפני** שראית מה הוא דירג
 * ומה הוא כתב. קודם רואים, ורק אחר כך מחליטים אם לפנות.
 *
 * ⭐ **הכל כאן כבר יושב בשורת הסקר**, ולכן המגירה אינה מריצה אף שאילתה
 * ונפתחת מיד. כרטיס הלקוח נטען רק אם לוחצים עליו.
 *
 * 🔴 **"בלי מלל" נאמר במפורש.** שניים משלושת הלקוחות שעל המסך דירגו
 * בלי לכתוב מילה, ומגירה שמציגה שטח ריק במקום מה שכתבו נראית שבורה.
 * [[empty_state_must_speak]]
 */
export function SurveyDetailSheet({
  survey,
  open,
  onOpenChange,
}: {
  survey: Survey | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const handle = useSetSurveyHandled();
  if (!survey) return null;

  const done = survey.handledAt !== null;
  const inbox = waInboxPath(survey.phoneE164);
  const comment = survey.comment?.trim() ?? '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-start">חוות הדעת של {survey.customerName ?? 'הלקוח'}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {survey.customerNumber && (
              <bdi className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{survey.customerNumber}</bdi>
            )}
            {survey.healthFund && <span>{survey.healthFund}</span>}
            {survey.driver && <span>· סיפק: {survey.driver}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ScoreBox label="שביעות רצון" value={survey.satisfaction} />
            <ScoreBox label="ממליץ לחבר" value={survey.recommend} />
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: '#eef1f6' }}>
            <div className="mb-1 text-[11px] font-semibold text-slate-400">מה הוא כתב</div>
            {comment ? (
              <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
                {comment}
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                דירג בלי להוסיף מילים. ההערה החופשית אינה שדה חובה בסקר.
              </p>
            )}
          </div>

          {/* ⭐ שלוש התחנות של הסקר. "לא נפתח" הוא נתון ולא חסר: הוא אומר
              שהלקוח ענה מהקישור בלי לפתוח קודם, או שהמעקב לא נרשם. */}
          <div className="rounded-xl border p-3 text-xs" style={{ borderColor: '#eef1f6' }}>
            <div className="mb-1.5 text-[11px] font-semibold text-slate-400">ציר הזמן</div>
            <Line label="האספקה נסגרה" iso={survey.deliveredAt} />
            <Line label="הסקר יצא" iso={survey.sentAt} />
            <Line label="נפתח" iso={survey.openedAt} missing="לא נרשמה פתיחה" />
            <Line label="נענה" iso={survey.answeredAt} />
          </div>

          {done && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              ✓ טופל{survey.handledBy ? ` · ${survey.handledBy}` : ''} · <bdi>{surveyWhen(survey.handledAt)}</bdi>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={handle.isPending}
              onClick={() => handle.mutate({ id: survey.id, handled: !done })}
              className={
                done
                  ? 'rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50'
                  : 'rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
              }
            >
              {done ? 'ביטול הסימון' : 'סמן כטופל'}
            </button>

            <CustomerCardButton
              customerNumber={survey.customerNumber}
              phone={survey.phoneE164}
              name={survey.customerName}
            />

            {/* 🔴🔴 **היעד הוא תיבת השיחות של המערכת ולא `wa.me`.** עידן,
                <bdi>02/09/2026</bdi>: "אנחנו עובדים בוואטסאפ על המערכת
                שלנו". הודעה שיוצאת מוואטסאפ ווב של העובד יוצאת מהמספר
                הפרטי שלו, אינה נרשמת בתיבה, ואף אחד אחר לא יראה שדיברנו.
                🔴 והכפתור נשאר כפתור נפרד ומסומן ולא תוצאה של לחיצה על
                שם: פנייה ללקוח היא החלטה. */}
            {inbox ? (
              <Link
                to={inbox}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                השיחה בתיבה
              </Link>
            ) : (
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-400">אין נייד</span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** 🔴 הסולם קבוע 1 עד 5, ואינו נמתח לפי מה שנצפה. */
function ScoreBox({ label, value }: { label: string; value: number | null }) {
  const low = value !== null && value <= 3;
  return (
    <div
      className="rounded-xl border p-3 text-center"
      style={{ borderColor: '#eef1f6', background: value === null ? '#fff' : low ? '#fef2f2' : '#f0fdf4' }}
    >
      {/* 🔴 `dir="ltr"` על השבר. בלעדיו "2 / 5" מוצג בעברית כ-"5 / 2",
          כלומר הציון והסולם מתחלפים, וזה בדיוק המקום שבו קוראים מספר
          הפוך ומסיקים מסקנה הפוכה. [[svg_hebrew_label_needs_direction_ltr]] */}
      <div
        dir="ltr"
        className="text-2xl font-extrabold leading-none"
        style={{ color: value === null ? '#94a3b8' : low ? '#b91c1c' : '#166534' }}
      >
        {value === null ? '·' : value}
        {value !== null && <span className="text-sm font-normal text-slate-400"> / 5</span>}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function Line({ label, iso, missing = 'לא נרשם' }: { label: string; iso: string | null; missing?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className={iso ? 'text-slate-700' : 'text-slate-300'}>
        {iso ? <bdi>{surveyWhen(iso)}</bdi> : missing}
      </span>
    </div>
  );
}
