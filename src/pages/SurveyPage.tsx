import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * עמוד הסקר של הלקוח.
 *
 * זה המסך היחיד במערכת שרואה מי שאינו מחובר, והוא נפתח מקישור בוואטסאפ
 * אצל מטופלים שרובם מבוגרים. לכן הוא נבנה אחרת מכל שאר המסכים:
 *
 * · מסך אחד בלי גלילה, בלי תפריט, בלי כלום מלבד השאלות.
 * · אין הרשמה, אין סיסמה, ואין שדה שבו הלקוח ממלא מי הוא. הטוקן שבכתובת
 *   הוא שקושר את התשובה לעצירה, לנהג ולקופה.
 * · שתי הקשות מסיימות. המלל החופשי אופציונלי ולא חוסם שליחה.
 *
 * הניסוח של שתי השאלות נלקח מילה במילה מטופס שביעות הרצון של ראש״ל.
 */

const NAVY = '#14223a';

type Phase = 'loading' | 'form' | 'sending' | 'done' | 'already' | 'notfound' | 'error';

interface Question {
  key: 'q1' | 'q2';
  text: string;
  low: string;
  high: string;
}

const QUESTIONS: Question[] = [
  {
    key: 'q1',
    text: 'באיזו מידה היית שבע רצון מהשירות שקיבלת?',
    low: 'לא מרוצה כלל',
    high: 'מרוצה מאוד',
  },
  {
    key: 'q2',
    text: 'באיזו מידה היית ממליץ עלינו לחבר או קולגה?',
    low: 'בכלל לא',
    high: 'בהחלט',
  },
];

/**
 * שורת כוכבים.
 *
 * ב-RTL הילד הראשון ב-flex יושב בימין, ולכן כוכב מספר 1 הוא הימני והמילוי
 * מתקדם ימינה לשמאלה. זה מה שמצופה, ולכן אין כאן שום היפוך ידני.
 * גודל הכוכב נבחר כך שאזור ההקשה יעבור בנוחות 44 פיקסל.
 */
function StarRow({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (n: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div role="radiogroup" aria-label={label} className="flex justify-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} מתוך 5`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className="flex h-14 w-14 items-center justify-center rounded-xl text-[38px] leading-none transition-transform active:scale-90"
          style={{ color: n <= shown ? '#f0a500' : '#dbe1ea' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** מסגרת המסמך: אותה מעטפת לכל המצבים, כדי שגם הודעת שגיאה תיראה כמו ראש״ל. */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-[#eef1f6] px-4 py-6" style={{ fontFamily: 'Assistant, sans-serif' }}>
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_6px_30px_rgba(20,34,58,0.13)]">
        <div className="text-center">
          <div className="text-[26px] font-extrabold tracking-wide" style={{ color: NAVY }}>
            ראש״ל
          </div>
          <div className="mx-auto mt-2 h-[3px] w-full rounded" style={{ background: NAVY }} />
          <div className="mt-2 text-[13px] text-slate-500">סקר שביעות רצון לקוחות</div>
        </div>
        {children}
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-400">ראש״ל ציוד רפואי</p>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <div className="text-[19px] font-bold" style={{ color: NAVY }}>
        {title}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

export function SurveyPage() {
  const { token = '' } = useParams<{ token: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [q1, setQ1] = useState<number | null>(null);
  const [q2, setQ2] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  // כותרת הטאב. ברירת המחדל היא "דשבורד הזמנות", וזה מה שהלקוח היה רואה
  // בלשונית ובכל שיתוף של הקישור.
  // ובנוסף noindex: הכתובת מכילה טוקן אישי, ואין שום סיבה שהיא תיכנס למנוע חיפוש.
  useEffect(() => {
    document.title = 'סקר שביעות רצון · ראש״ל';

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/survey?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json.ok) return setPhase('notfound');
        setName(json.customerName ?? '');
        setPhase(json.alreadyAnswered ? 'already' : 'form');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit() {
    setPhase('sending');
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, q1, q2, comment }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) return setPhase('error');
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }

  if (phase === 'loading') {
    return (
      <Sheet>
        <div className="py-14 text-center text-[14px] text-slate-400">רגע אחד</div>
      </Sheet>
    );
  }

  if (phase === 'notfound') {
    return (
      <Sheet>
        <Message
          title="הקישור אינו בתוקף"
          body="ייתכן שהקישור הועתק חלקית. אפשר לפתוח אותו שוב מתוך ההודעה שקיבלת בוואטסאפ."
        />
      </Sheet>
    );
  }

  if (phase === 'already') {
    return (
      <Sheet>
        <Message title="כבר קיבלנו את התשובה שלך" body="תודה רבה, זה עוזר לנו להשתפר." />
      </Sheet>
    );
  }

  if (phase === 'done') {
    return (
      <Sheet>
        <Message title="תודה על שיתוף הפעולה" body="התשובה שלך התקבלה, וזה עוזר לנו להשתפר." />
      </Sheet>
    );
  }

  if (phase === 'error') {
    return (
      <Sheet>
        <Message title="משהו השתבש" body="אפשר לנסות שוב בעוד רגע. אם זה חוזר, נשמח שתעדכנו אותנו." />
      </Sheet>
    );
  }

  const answered = q1 !== null || q2 !== null || comment.trim().length > 0;
  const sending = phase === 'sending';

  return (
    <Sheet>
      {name && (
        <p className="mt-5 text-center text-[15px] font-semibold" style={{ color: NAVY }}>
          שלום {name},
        </p>
      )}
      <p className="mt-1 text-center text-[13.5px] leading-relaxed text-slate-500">
        נשמח לשתי שאלות קצרות על האספקה שקיבלת.
      </p>

      {QUESTIONS.map((question, i) => {
        const value = question.key === 'q1' ? q1 : q2;
        const setValue = question.key === 'q1' ? setQ1 : setQ2;
        return (
          <div key={question.key} className="mt-6">
            <p className="text-[14.5px] font-semibold leading-snug" style={{ color: NAVY }}>
              {i + 1}. {question.text}
            </p>
            <div className="mt-2">
              <StarRow value={value} onChange={setValue} label={question.text} />
              <div className="mt-1 flex justify-between px-1 text-[11px] text-slate-400">
                <span>{question.low}</span>
                <span>{question.high}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-6">
        <label htmlFor="survey-comment" className="text-[14.5px] font-semibold leading-snug" style={{ color: NAVY }}>
          משהו נוסף שתרצו לומר לנו? (לא חובה)
        </label>
        <textarea
          id="survey-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="כתבו כאן"
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-[14px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!answered || sending}
        className="mt-5 w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-opacity disabled:opacity-40"
        style={{ background: NAVY }}
      >
        {sending ? 'שולח' : 'שליחה'}
      </button>

      {!answered && (
        <p className="mt-2 text-center text-[11.5px] text-slate-400">סמנו לפחות שאלה אחת כדי לשלוח</p>
      )}
    </Sheet>
  );
}
