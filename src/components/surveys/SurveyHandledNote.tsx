import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Survey } from '@/lib/surveys';
import { useSetSurveyHandled } from '@/hooks/useSurveys';

/** תקרה זהה לזו שבשרת, כדי שהמשתמש ייעצר כאן ולא יקבל שגיאה מהמסד. */
const MAX = 2000;

/**
 * "מה הייתה התקלה ואיך היא טופלה", מלל חופשי על חוות דעת בדירוג נמוך.
 *
 * ⭐ **הבקשה (עידן, <bdi>10/09/2026</bdi>).** עד היום הווי הירוק אמר
 * שמישהו טיפל, ולא **מה קרה**. אחרי שבוע הרשימה לא לימדה כלום: שמות
 * מטופלים בלי שום ידע מאחוריהם. הסימון סגר את המשימה ואיבד את הלקח.
 *
 * 🔴🔴 **התיאור נכתב עם הסימון ולא אחריו.** "סמן כטופל" פותח את התיבה
 * במקום לסמן מיד, כי בקשה לכתוב שמגיעה **אחרי** שהשורה כבר ירדה מהרשימה
 * לא נענית לעולם. הרגע היחיד שבו זוכרים מה קרה בשיחה הוא הרגע שאחריה.
 * לכן מצב העריכה נשלט מבחוץ, על ידי אותו כפתור.
 *
 * 🔴 **ואפשר לשמור גם בלי לכתוב.** שדה חובה כאן היה גורם לעמי לכתוב
 * נקודה כדי לעבור הלאה, וזה גרוע מריק: זה ריק שנראה מלא. במקום זה
 * שורה מטופלת בלי תיאור **אומרת את זה במפורש** ומזמינה להשלים.
 * [[empty_state_must_speak]]
 */
export function SurveyHandledNote({
  survey,
  editing,
  onEditingChange,
}: {
  survey: Survey;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
}) {
  const done = survey.handledAt !== null;
  const note = survey.handledNote?.trim() ?? '';

  /**
   * 🔴 **העורך הוא רכיב נפרד שנטען מחדש בכל פתיחה, ולא `useEffect` שמסנכרן
   * טקסט.** אפקט שכותב state גורר רינדור נוסף, ומה שגרוע ממנו: רענון רקע
   * של הסקרים היה דורס באמצע משפט את מה שמקלידים. רכיב שנולד בפתיחה מקבל
   * את הערך ההתחלתי פעם אחת, וזה בדיוק ההתנהגות הרצויה.
   */
  if (editing) {
    return (
      <NoteEditor
        survey={survey}
        initial={survey.handledNote ?? ''}
        done={done}
        onClose={() => onEditingChange(false)}
      />
    );
  }

  if (!done) return null;

  return note ? (
    <div className="mt-1 flex items-start gap-1.5">
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-slate-600">
        {note}
      </p>
      <button
        type="button"
        onClick={() => onEditingChange(true)}
        title="עריכת התיאור"
        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => onEditingChange(true)}
      className="mt-0.5 text-[11px] text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-900"
    >
      לא נרשם מה הייתה התקלה. להוסיף תיאור
    </button>
  );
}

function NoteEditor({
  survey,
  initial,
  done,
  onClose,
}: {
  survey: Survey;
  initial: string;
  done: boolean;
  onClose: () => void;
}) {
  const handle = useSetSurveyHandled();
  const [text, setText] = useState(initial);
  const busy = handle.isPending;

  return (
    <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
        מה הייתה התקלה, ואיך היא טופלה
      </label>
      <textarea
        autoFocus
        rows={3}
        value={text}
        maxLength={MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder="לדוגמה: המיטה הגיעה בלי השלט. תואם ביקור חוזר למחר, והשלט נשלח עם הנהג."
        className="w-full resize-y rounded-md border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-800 outline-none focus:border-slate-400"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            handle.mutate({ id: survey.id, handled: true, note: text }, { onSuccess: onClose })
          }
          className="rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {done ? 'שמור' : 'שמור וסמן כטופל'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          ביטול
        </button>
        {/* ⭐ המונה מופיע רק כשמתקרבים לתקרה, ולא מלווה כל הקלדה. */}
        {text.length > MAX - 200 && (
          <span className="text-[10.5px] text-slate-400">
            <bdi>
              {text.length} / {MAX}
            </bdi>
          </span>
        )}
      </div>
    </div>
  );
}
