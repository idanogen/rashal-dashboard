import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * עמוד הסקר של הלקוח.
 *
 * זה המסך היחיד במערכת שרואה מי שאינו מחובר, והוא נפתח מקישור בוואטסאפ
 * אצל מטופלים שרובם מבוגרים. לכן הוא נבנה אחרת מכל שאר המסכים:
 *
 * · מסמך אחד, בלי תפריט ובלי ניווט. נראה כמו מכתב רשמי של ר.שעל.
 * · אין הרשמה, אין סיסמה, ואין שדה שבו הלקוח ממלא מי הוא. הטוקן שבכתובת
 *   הוא שקושר את התשובה לעצירה, לנהג ולקופה.
 * · שתי הקשות מסיימות. המלל החופשי אופציונלי ולא חוסם שליחה.
 *
 * הניסוח של שתי השאלות נלקח מילה במילה מטופס שביעות הרצון של ר.שעל.
 * המכתב יוצא בשמו של שלומי קורן, סמנכ"ל החברה, כדי שהפנייה תרגיש אישית
 * ולא כמו טופס אוטומטי (החלטת עידן, 17/08/2026).
 */

const NAVY = '#14223a';
const BRAND = '#1f8fc4'; // הכחול מהלוגו

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
          style={{ color: n <= shown ? '#f0a500' : '#dde3ea' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** נייר המכתבים: לוגו, שם החברה, וקו מפריד. חוזר בכל מצבי העמוד. */
function Letterhead() {
  return (
    <div className="text-center">
      <img
        src="/rashal-logo.png"
        alt="ר.שעל"
        width={156}
        height={158}
        className="mx-auto h-[158px] w-[156px] object-contain"
      />
      <div className="mt-2 text-[22px] font-extrabold tracking-wide" style={{ color: NAVY }}>
        ר.שעל
      </div>
      <div className="mt-0.5 text-[12px] tracking-wide text-slate-500">שירותי עזר לנכים</div>
      <div className="mx-auto mt-4 h-[2px] w-full rounded" style={{ background: BRAND }} />
    </div>
  );
}

/**
 * בלוק החתימה.
 *
 * הכתב הוא Gveret Levin, פונט כתב-יד עברי אמיתי מ-Google Fonts. זו חתימה
 * טיפוגרפית ולא סריקה של החתימה של שלומי. אם תגיע סריקה אמיתית, מחליפים
 * את ה-<span> בתמונה ותו לא.
 */
function Signature() {
  return (
    <div className="mt-7 border-t pt-5" style={{ borderColor: '#e8edf3' }}>
      <p className="text-[13.5px] leading-relaxed text-slate-600">בברכה,</p>
      <div
        className="mt-1 text-[34px] leading-none"
        style={{ fontFamily: "'Gveret Levin', 'Assistant', cursive", color: BRAND }}
      >
        שלומי קורן
      </div>
      <p className="mt-2 text-[13px] font-semibold" style={{ color: NAVY }}>
        שלומי קורן
      </p>
      <p className="text-[12.5px] text-slate-500">סמנכ"ל · ר.שעל שירותי עזר לנכים</p>
    </div>
  );
}

/** מסגרת המסמך: אותה מעטפת לכל המצבים, כדי שגם הודעת שגיאה תיראה כמו ר.שעל. */
function Sheet({ children, signed = false }: { children: React.ReactNode; signed?: boolean }) {
  return (
    <div
      dir="rtl"
      className="min-h-screen px-4 py-6"
      style={{ background: '#eef2f6', fontFamily: 'Assistant, sans-serif' }}
    >
      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_34px_rgba(20,34,58,0.13)]"
        style={{ borderTop: `5px solid ${BRAND}` }}
      >
        <div className="p-6">
          <Letterhead />
          {children}
          {signed && <Signature />}
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-400">ר.שעל שירותי עזר לנכים</p>
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
  // ופונט כתב היד לחתימה, שנטען רק כאן ולא בכל המערכת.
  useEffect(() => {
    document.title = 'סקר שביעות רצון · ר.שעל';

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Gveret+Levin&display=swap';
    document.head.appendChild(font);

    return () => {
      meta.remove();
      font.remove();
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
      <Sheet signed>
        <Message title="כבר קיבלנו את התשובה שלך" body="תודה רבה, זה עוזר לנו להשתפר." />
      </Sheet>
    );
  }

  if (phase === 'done') {
    return (
      <Sheet signed>
        <Message
          title="תודה על שיתוף הפעולה"
          body="התשובה שלך התקבלה ותגיע אליי אישית. אנחנו קוראים כל מילה."
        />
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
    <Sheet signed>
      {/* פתיח אישי. הפנייה בגוף ראשון היא מה שהופך את זה ממשוב אוטומטי
          לפנייה של אדם, וזו הסיבה שהוא נכתב בשמו של סמנכ"ל החברה. */}
      <div className="mt-5 rounded-xl px-4 py-3" style={{ background: '#f4f8fb' }}>
        <p className="text-[15px] font-bold" style={{ color: NAVY }}>
          {name ? `${name} שלום,` : 'שלום,'}
        </p>
        {/* 🔴 המשפט הראשון זהה מילה במילה לתבנית `survey_invite_service`
            שאושרה במטא. הלקוח קורא את שניהם בתוך דקה, ופער ביניהם קורא
            כמו שתי מערכות שונות. אם משנים כאן, משנים גם שם, וזו הגשה
            מחדש של 48 שעות. */}
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
          קיבלת לאחרונה שירות מחברת ר.שעל בע״מ. חשוב לי לדעת איך הרגשת עם השירות
          שקיבלת, ולכן אשמח אם תקדיש לנו פחות מדקה ותענה על שתי שאלות קצרות.
        </p>
      </div>

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
