/**
 * בריאות ערוץ הוואטסאפ: הוובהוק והערוץ עצמו, כפי ש-heyy מדווחת עליהם.
 *
 * 🔴🔴 **למה זה קיים בכלל.** heyy **משביתה אוטומטית** כתובת וובהוק
 * שנכשלת ברצף ("temporary disablement" בתיעוד שלהם). מאותו רגע תשובות
 * הלקוחות פשוט מפסיקות להגיע אלינו: אין שגיאה, אין 500, אין שורה ביומן,
 * והמסך פשוט נראה שקט. ההפעלה מחדש היא ידנית בממשק שלהם, ולכן בלי
 * הבדיקה הזאת אין שום דבר שיגיד לנו שזה קרה. [[silence_alarm_needs_arming]]
 *
 * ⭐ **וזו בדיקה חיובית ולא בדיקת שקט:** אנחנו שואלים את heyy מה מצב
 * הוובהוק, ולא מסיקים מהיעדר תנועה. שקט בוואטסאפ הוא מצב תקין לגמרי
 * ביום רגיל, ולכן "לא נכנסו הודעות" לעולם לא יכול לשמש כאן כאות.
 *
 * הפונקציה טהורה בכוונה: מקבלת את הגופים שכבר נקראו, ולא נוגעת ברשת.
 * ככה אפשר להריץ עליה את כל מצבי הכשל בבדיקה, במקום להתפלל שהם לא יקרו.
 */

export type HeyyVerdict = 'ok' | 'warn' | 'down' | 'unknown';

export interface HeyyHealthInput {
  /** גוף התשובה של `POST /v3/api_webhooks/search`, או null אם הקריאה נכשלה. */
  webhooks: unknown;
  /** גוף התשובה של `POST /v3/channels/search`, או null אם הקריאה נכשלה. */
  channels: unknown;
  /** הודעת שגיאה מהקריאה עצמה (רשת, 401, 429). null כשהכל נקרא. */
  probeError?: string | null;
  /** הכתובת שאמורה להיות רשומה, בלי פרמטרים. */
  expectedWebhookUrl: string;
  /** מזהה הערוץ שלנו. */
  expectedChannelId: string;
}

export interface HeyyHealth {
  verdict: HeyyVerdict;
  /** מה שבור, בעברית, מוכן למייל. ריק כשהכל תקין. */
  problems: string[];
  /** מה שנצפה בפועל, לגוף המייל ולתשובת ה-JSON. */
  facts: Record<string, string>;
}

/** שלושת האירועים שהמערכת שלנו תלויה בהם. */
export const REQUIRED_EVENTS = ['message.received', 'message.sent', 'message.updated'] as const;

function rows(body: unknown): Record<string, any>[] {
  const data = (body as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Record<string, any>[]) : [];
}

/** משווה כתובות בלי הפרמטרים ובלי לוכסן מסיים, כדי ששינוי `?k=` לא ייחשב לכתובת אחרת. */
function sameUrl(a: string, b: string): boolean {
  const strip = (u: string) => u.split('?')[0].replace(/\/+$/, '').toLowerCase();
  return strip(a) === strip(b);
}

export function assessHeyy(input: HeyyHealthInput): HeyyHealth {
  const facts: Record<string, string> = {};

  // ── לא הצלחנו לשאול ─────────────────────────────────────
  //
  // 🔴 **"לא ידוע" אינו "תקין", אבל הוא גם אינו "תקלה".** תקלת רשת
  // אחת מול heyy אינה סיבה להעיר את עידן, ולכן המצב הזה מוחזר בנפרד,
  // והמתקשר הוא שמחליט להתריע רק אחרי שתי בדיקות רצופות שנכשלו.
  if (input.probeError || input.webhooks == null || input.channels == null) {
    return {
      verdict: 'unknown',
      problems: [`לא ניתן לקרוא את מצב הערוץ מ-heyy: ${input.probeError ?? 'תשובה ריקה'}`],
      facts: { probe: input.probeError ?? 'empty response' },
    };
  }

  const problems: string[] = [];
  let worst: HeyyVerdict = 'ok';
  const fail = (msg: string) => { problems.push(msg); worst = 'down'; };
  const warn = (msg: string) => { problems.push(msg); if (worst !== 'down') worst = 'warn'; };

  // ── הוובהוק ─────────────────────────────────────────────
  const hooks = rows(input.webhooks);
  facts.webhooks_registered = String(hooks.length);

  const ours = hooks.find((h) => typeof h.url === 'string' && sameUrl(h.url, input.expectedWebhookUrl));

  if (!ours) {
    // 🔴 נמחק, או שמישהו הצביע אותו למקום אחר. בשני המקרים אנחנו חירשים.
    fail('אין ב-heyy שום וובהוק שמצביע על המערכת. תשובות לקוחות לא מגיעות אלינו בכלל.');
    facts.webhook_urls = hooks.map((h) => String(h.url ?? '?')).join(' | ') || '(אין אף אחד)';
  } else {
    facts.webhook_status = String(ours.status ?? '?');

    // 🔴 זה הכשל שבגללו הפונקציה נכתבה.
    if (String(ours.status ?? '').toLowerCase() !== 'active') {
      fail(`heyy השביתה את הוובהוק (סטטוס ${ours.status}). תשובות לקוחות לא מגיעות. יש להפעיל מחדש בהגדרות של heyy.`);
    }

    // 🔴 **וובהוק בלי הסוד בכתובת נדון להשבתה.** האנדפוינט שלנו מחזיר
    // 401 על כל קריאה בלי `?k=`, כלומר heyy תיכשל ברצף ותשבית אותו
    // בעצמה. עדיף לתפוס את זה בשנייה שמישהו יוצר את הוובהוק מחדש בממשק
    // ושוכח את הפרמטר, ולא יומיים אחר כך כשהתשובות כבר אבדו.
    const q = String(ours.url ?? '').split('?')[1] ?? '';
    const hasSecret = new URLSearchParams(q).get('k');
    if (!hasSecret) {
      fail('הוובהוק רשום בלי הסוד בכתובת. האנדפוינט דוחה אותו, ולכן heyy תשבית אותו בעצמה תוך זמן קצר.');
    }

    const events = Array.isArray(ours.events) ? ours.events : [];
    const covered = new Set<string>();
    for (const e of events) {
      const scopes = Array.isArray(e?.scopes) ? e.scopes : [];
      const onOurChannel = scopes.some((s: any) => Array.isArray(s?.ids) && s.ids.includes(input.expectedChannelId));
      if (onOurChannel && typeof e?.type === 'string') covered.add(e.type);
    }
    facts.webhook_events = [...covered].sort().join(', ') || '(אין)';

    const missing = REQUIRED_EVENTS.filter((t) => !covered.has(t));
    if (missing.length) {
      // הודעה נכנסת היא תשובת הלקוח, והשתיים האחרות הן סטטוס המסירה.
      fail(`חסרים אירועים בוובהוק עבור הערוץ שלנו: ${missing.join(', ')}`);
    }
  }

  // ── הערוץ עצמו ──────────────────────────────────────────
  const chans = rows(input.channels);
  const chan = chans.find((c) => c.id === input.expectedChannelId);

  if (!chan) {
    fail('הערוץ של ר.שעל לא קיים בחשבון heyy. שום הודעה לא תצא.');
  } else {
    const status = String(chan.status ?? '?').toLowerCase();
    const v = (chan.vendorDetails ?? {}) as Record<string, unknown>;
    facts.channel_status = status;
    facts.phone = String(v.phoneNumber ?? '?');
    facts.quality = String(v.qualityRating ?? '?');
    facts.daily_limit = String(v.dailyLimit ?? '?');
    facts.verified = String(v.isVerified ?? '?');

    if (status !== 'active') fail(`הערוץ אינו פעיל (סטטוס ${status}). שום הודעה לא תצא.`);

    // 🔴 דירוג האיכות הוא מה שמטא מורידה לפי תלונות וחסימות של נמענים.
    // ירידה שלו היא האזהרה המוקדמת לפני שמטא מצמצמת את המכסה היומית,
    // וזה בדיוק הרגע שבו כדאי לדעת, לא אחרי.
    const q = String(v.qualityRating ?? '').toLowerCase();
    if (q === 'low' || q === 'red') {
      fail('דירוג האיכות של המספר במטא ירד לנמוך. מטא מצמצמת את המכסה היומית ועלולה לחסום את המספר.');
    } else if (q === 'medium' || q === 'yellow') {
      warn('דירוג האיכות של המספר במטא ירד לבינוני. שווה לבדוק מה נשלח לאחרונה.');
    }
  }

  return { verdict: worst, problems, facts };
}
