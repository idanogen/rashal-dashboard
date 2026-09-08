import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  SURVEY_LANGS,
  SURVEY_TEXT,
  isSurveyLang,
  surveyDir,
  type SurveyLang,
  type SurveyStrings,
} from '@/lib/i18n/survey';

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
 *
 * חמש שפות (08/09/2026). כל המחרוזות ב-`src/lib/i18n/survey.ts`, והשפה
 * נקבעת בסדר הזה: `?lang=` בכתובת, אחרת מה שהשרת יודע על הלקוח, אחרת עברית.
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

function buildQuestions(t: SurveyStrings): Question[] {
  return [
    { key: 'q1', text: t.q1, low: t.q1Low, high: t.q1High },
    { key: 'q2', text: t.q2, low: t.q2Low, high: t.q2High },
  ];
}

/** השפה מהכתובת, אם יש כזו והיא מוכרת. */
function langFromUrl(): SurveyLang | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('lang');
  return isSurveyLang(raw) ? raw : null;
}

/** מעדכן את `?lang=` בכתובת בלי טעינה מחדש, כדי ששיתוף של הקישור ישמור את השפה. */
function writeLangToUrl(lang: SurveyLang) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.history.replaceState(window.history.state, '', url.toString());
}

/**
 * שורת כוכבים.
 *
 * תמיד משמאל לימין, בכל שפה: כוכב 1 בקצה השמאלי והמילוי מתקדם ימינה. ככה
 * הסקאלה זהה לזו שמכירים מכל אפליקציה, ולא מתהפכת בין עברית לאנגלית.
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
    <div role="radiogroup" aria-label={label} dir="ltr" className="flex justify-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}/5`}
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

/** בורר השפה: שורת גלולות מעל הלוגו. הנוכחית מלאה בנייבי, השאר עם מסגרת. */
function LangSwitcher({ lang, onChange }: { lang: SurveyLang; onChange: (l: SurveyLang) => void }) {
  return (
    <div className="mb-4 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Language">
      {SURVEY_LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            dir={l.dir}
            aria-pressed={active}
            onClick={() => onChange(l.code)}
            className="rounded-full border px-3 py-1 text-[12px] font-semibold leading-tight transition-colors"
            style={
              active
                ? { background: NAVY, borderColor: NAVY, color: '#ffffff' }
                : { background: 'transparent', borderColor: '#cfd6df', color: NAVY }
            }
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

/** נייר המכתבים: לוגו, שם החברה, וקו מפריד. חוזר בכל מצבי העמוד. */
function Letterhead({ t }: { t: SurveyStrings }) {
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
      <div className="mt-0.5 text-[12px] tracking-wide text-slate-500">{t.brand}</div>
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
 *
 * החתימה עצמה נשארת בעברית בכל שפה, כמו חתימה על נייר. השם המודפס והתפקיד
 * שמתחתיה מתורגמים.
 */
function Signature({ t }: { t: SurveyStrings }) {
  return (
    <div className="mt-7 border-t pt-5" style={{ borderColor: '#e8edf3' }}>
      <p className="text-[13.5px] leading-relaxed text-slate-600">{t.regards}</p>
      <div
        className="mt-1 text-[34px] leading-none"
        style={{ fontFamily: "'Gveret Levin', 'Assistant', cursive", color: BRAND }}
      >
        {/* bdi ולא dir: הכתב נשאר עברי ומבודד, אבל הבלוק יושב בצד ההתחלה של
            השפה, כמו שאר החתימה, ולא בורח לקצה השני באנגלית וברוסית. */}
        <bdi lang="he">שלומי קורן</bdi>
      </div>
      <p className="mt-2 text-[13px] font-semibold" style={{ color: NAVY }}>
        {t.signerName}
      </p>
      <p className="text-[12.5px] text-slate-500">{t.signerRole}</p>
    </div>
  );
}

/** מסגרת המסמך: אותה מעטפת לכל המצבים, כדי שגם הודעת שגיאה תיראה כמו ר.שעל. */
function Sheet({
  children,
  signed = false,
  lang,
  t,
  onLangChange,
}: {
  children: React.ReactNode;
  signed?: boolean;
  lang: SurveyLang;
  t: SurveyStrings;
  onLangChange: (l: SurveyLang) => void;
}) {
  const footer = lang === 'he' ? 'ר.שעל שירותי עזר לנכים' : `${t.brand} · ר.שעל`;
  return (
    <div
      dir={surveyDir(lang)}
      lang={lang}
      className="min-h-screen px-4 py-6"
      style={{ background: '#eef2f6', fontFamily: 'Assistant, sans-serif' }}
    >
      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_8px_34px_rgba(20,34,58,0.13)]"
        style={{ borderTop: `5px solid ${BRAND}` }}
      >
        <div className="p-6">
          <LangSwitcher lang={lang} onChange={onLangChange} />
          <Letterhead t={t} />
          {children}
          {signed && <Signature t={t} />}
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-400">
        <bdi>{footer}</bdi>
      </p>
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

  // השפה: הכתובת קודמת לכל דבר. אם אין בה שפה, השרת משלים ממה שנשמר ללקוח.
  const [urlLang] = useState<SurveyLang | null>(langFromUrl);
  const [lang, setLang] = useState<SurveyLang>(urlLang ?? 'he');
  const t = SURVEY_TEXT[lang];

  function changeLang(next: SurveyLang) {
    setLang(next);
    writeLangToUrl(next);
  }

  // noindex: הכתובת מכילה טוקן אישי, ואין שום סיבה שהיא תיכנס למנוע חיפוש.
  // ופונט כתב היד לחתימה, שנטען רק כאן ולא בכל המערכת.
  useEffect(() => {
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

  // כותרת הטאב ושפת המסמך עוקבות אחרי השפה שנבחרה. ברירת המחדל של הטאב
  // היא "דשבורד הזמנות", וזה מה שהלקוח היה רואה בלשונית ובכל שיתוף של הקישור.
  useEffect(() => {
    document.title = t.title;
    const root = document.documentElement;
    const prevLang = root.lang;
    root.lang = lang;
    return () => {
      root.lang = prevLang;
    };
  }, [lang, t.title]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/survey?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json.ok) return setPhase('notfound');
        setName(json.customerName ?? '');
        // הכתובת מנצחת. רק כשאין בה שפה לוקחים את מה שהשרת יודע על הלקוח.
        if (!urlLang && isSurveyLang(json.lang)) setLang(json.lang);
        setPhase(json.alreadyAnswered ? 'already' : 'form');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, urlLang]);

  async function submit() {
    setPhase('sending');
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, q1, q2, comment, lang }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) return setPhase('error');
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }

  const sheetProps = { lang, t, onLangChange: changeLang };

  if (phase === 'loading') {
    return (
      <Sheet {...sheetProps}>
        <div className="py-14 text-center text-[14px] text-slate-400">{t.loading}</div>
      </Sheet>
    );
  }

  if (phase === 'notfound') {
    return (
      <Sheet {...sheetProps}>
        <Message title={t.invalidTitle} body={t.invalidBody} />
      </Sheet>
    );
  }

  if (phase === 'already') {
    return (
      <Sheet {...sheetProps} signed>
        <Message title={t.answeredTitle} body={t.answeredBody} />
      </Sheet>
    );
  }

  if (phase === 'done') {
    return (
      <Sheet {...sheetProps} signed>
        <Message title={t.thanksTitle} body={t.thanksBody} />
      </Sheet>
    );
  }

  if (phase === 'error') {
    return (
      <Sheet {...sheetProps}>
        <Message title={t.errorTitle} body={t.errorBody} />
      </Sheet>
    );
  }

  const answered = q1 !== null || q2 !== null || comment.trim().length > 0;
  const sending = phase === 'sending';
  const questions = buildQuestions(t);

  return (
    <Sheet {...sheetProps} signed>
      {/* פתיח אישי. הפנייה בגוף ראשון היא מה שהופך את זה ממשוב אוטומטי
          לפנייה של אדם, וזו הסיבה שהוא נכתב בשמו של סמנכ"ל החברה. */}
      <div className="mt-5 rounded-xl px-4 py-3" style={{ background: '#f4f8fb' }}>
        <p className="text-[15px] font-bold" style={{ color: NAVY }}>
          {t.greeting(name)}
        </p>
        {/* 🔴 המשפט הראשון בעברית זהה מילה במילה לתבנית `survey_invite_service`
            שאושרה במטא. הלקוח קורא את שניהם בתוך דקה, ופער ביניהם קורא
            כמו שתי מערכות שונות. אם משנים כאן, משנים גם שם, וזו הגשה
            מחדש של 48 שעות. */}
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{t.intro}</p>
      </div>

      {questions.map((question, i) => {
        const value = question.key === 'q1' ? q1 : q2;
        const setValue = question.key === 'q1' ? setQ1 : setQ2;
        return (
          <div key={question.key} className="mt-6">
            <p className="text-[14.5px] font-semibold leading-snug" style={{ color: NAVY }}>
              <bdi>{i + 1}</bdi>. {question.text}
            </p>
            <div className="mt-2">
              <StarRow value={value} onChange={setValue} label={question.text} />
              {/* התוויות רוכבות על אותו כיוון של הכוכבים: "נמוך" מתחת לכוכב
                  הראשון (שמאל) ו"גבוה" מתחת לחמישי (ימין), בכל שפה. */}
              <div dir="ltr" className="mt-1 flex justify-between px-1 text-[11px] text-slate-400">
                <span dir={surveyDir(lang)}>{question.low}</span>
                <span dir={surveyDir(lang)}>{question.high}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-6">
        <label htmlFor="survey-comment" className="text-[14.5px] font-semibold leading-snug" style={{ color: NAVY }}>
          {t.commentLabel}
        </label>
        <textarea
          id="survey-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={t.commentPlaceholder}
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
        {sending ? t.sending : t.send}
      </button>

      {!answered && <p className="mt-2 text-center text-[11.5px] text-slate-400">{t.hint}</p>}
    </Sheet>
  );
}
