import { supabase } from './supabase';

/**
 * הקריאות של תיבת השיחות.
 *
 * ⭐ **אותן נקודות קצה בדיוק שהחלונית בפריוריטי קוראת להן.** התיבה אינה
 * מערכת שנייה לצד מה שנבנה, אלא אותה מערכת בלי המסנן של השורה. שרת אחד,
 * מודל אחד, שתי חזיתות.
 */

export interface WaWindow {
  open: boolean;
  expiresAt: string | null;
  minutesLeft: number;
  reason: string | null;
}

export interface SuggestedCustomer {
  customer_number: string;
  customer_name: string | null;
  city?: string | null;
  /** id = לפי ת.ז. שנכתבה · name = לפי שם · phone = הטלפון שייך לכמה לקוחות */
  by?: 'id' | 'name' | 'phone' | string;
  label?: string | null;
}

export interface InboxItem {
  id: string;
  phone: string | null;
  title: string;
  customerNumber: string | null;
  unidentified: boolean;
  /** מי מדבר איתנו כשזה לא הלקוח עצמו: "הבת, מיכל". */
  contactLabel?: string | null;
  /** מועמדים לשיוך שהשרת הכין (ת.ז. בתשובה, או טלפון של שני לקוחות). */
  suggested?: SuggestedCustomer[] | null;
  /** כל ההודעות בשיחה אוטומטיות; יורדת מ"כל השיחות" מאחורי מתג. */
  autoOnly?: boolean;
  lastHumanAt?: string | null;
  preview: string;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  unansweredSince: string | null;
  waitingMinutes: number | null;
  read: boolean;
  messageCount: number;
  window: WaWindow;
  /**
   * תשובת הסקר האחרונה של הלקוח, כשיש. מגיעה מהנתונים שלנו
   * (`customer_surveys`) ולא מוואטסאפ, ולכן היא נושאת גם את הציון.
   */
  survey?: { score: number | null; answeredAt: string | null; comment: string | null };
}

export interface InboxResponse {
  ok: true;
  tab: 'waiting' | 'all';
  counts: { waiting: number; all: number; autoOnly?: number };
  matched: number;
  truncated: boolean;
  items: InboxItem[];
  /**
   * 🔴 **כל הטלפונים שיש להם שיחה, כולל כאלה שסוננו מהתצוגה.**
   * "לקוח בלי שיחה" נגזר מכאן ולא מ-`items`, אחרת לשונית או חיפוש
   * שמסתירים את השיחה הופכים את הלקוח ל"בלי שיחה".
   */
  phones?: string[];
}

/**
 * קובץ שעבר בשיחה, כפי שהשרת מתאר אותו.
 *
 * 🔴 **המבנה נקבע בשרת ב-`api/_lib/attachments.ts`, לא כאן.** הדפדפן
 * לא מקבל את המטען הגולמי של heyy (כתובת S3 ציבורית לכל קובץ, ונתיב
 * פנימי בדלי), ולא מכריע בעצמו מה נחשב קובץ. אותה רשימה בדיוק מגיעה גם
 * לחלונית שבתוך פריוריטי.
 */
export interface WaAttachment {
  index: number;
  name: string;
  kind: 'image' | 'pdf' | 'video' | 'audio' | 'file';
  ready: boolean;
  sizeBytes: number | null;
}

/**
 * כפתור שנשלח ללקוח מתוך תבנית, ואיתו הקישור עצמו.
 *
 * ⭐ `url` הוא **היעד** ולא כתובת המעקב של heyy. מי שמסתכל על השרשור
 * רוצה לדעת לאן הלקוח נשלח.
 */
export interface WaButton {
  index: number;
  text: string;
  url: string | null;
}

export interface WaMessage {
  id: string;
  direction: 'in' | 'out';
  body: string | null;
  attachments: WaAttachment[];
  buttons: WaButton[];
  status: string | null;
  template_id: string | null;
  entity_type: string | null;
  entity_key: string | null;
  author: string | null;
  sent_at: string;
  /**
   * תשובת הסקר **שנשלח בהודעה הזאת**, כשהלקוח ענה.
   * ⭐ ההצמדה לפי הטוקן שבכתובת הכפתור, ולכן היא חד-חד-ערכית.
   */
  survey?: { score: number | null; answeredAt: string | null; comment: string | null };
  /**
   * ⭐ הסיווג מהשרת ("להרזות את ההתכתבות", 06/09/2026): אדם מקבל בועה,
   * אוטומט מקבל שורת מערכת. המצב אומר אם הבקשה עדיין רלוונטית.
   */
  kind?: 'human' | 'auto';
  autoKind?: 'survey' | 'photo_request' | 'photo_reminder' | 'on_way' | 'coordination' | 'other' | string | null;
  autoState?: 'pending' | 'answered' | 'expired' | null;
  /** הטקסט שמחליף את הבקשה כשנענתה: "סקר: 5 מתוך 5", "תמונה התקבלה". */
  autoResult?: string | null;
}

/**
 * תבנית שאפשר לשלוח מהתיבה.
 *
 * 🔴🔴 **מגיעה מהשרת, ולא נבחרת שוב בדפדפן.** עד 24/08/2026 הקובץ
 * `lib/wa-templates.ts` שאל את Supabase ישירות וסינן כאן
 * `heyy_status === 'active' && !media_per_message`, בזמן שהשרת הצהיר את
 * אותו כלל בעצמו. שני מימושים של החלטה אחת, ואחד מהם כבר נפרד: החלונית
 * בפריוריטי לא הציעה תבנית כלל כשהחלון היה סגור. הכלל היחיד יושב עכשיו
 * ב-`api/_lib/templates-store.ts`, ב-`toPanelTemplates`.
 * [[screen_and_sender_must_share_one_module]]
 */
export interface SendableTemplate {
  key: string;
  label: string;
  variables: string[];
  preview: string;
  category: string;
  attachmentKind: string | null;
  available: boolean;
  needsDocument: boolean;
  unavailableReason: string | null;
}

export interface ThreadResponse {
  ok: true;
  conversation: {
    id: string;
    phone: string | null;
    phoneE164: string | null;
    contactName: string | null;
    customerNumber: string | null;
    customerName: string | null;
    contactLabel?: string | null;
    suggested?: SuggestedCustomer[] | null;
    identityAskedAt?: string | null;
    messageCount: number | null;
    lastMessageAt: string | null;
    unansweredSince: string | null;
    /** ⭐ אותה הכרעה בדיוק של הרשימה (`isWaiting`), ולא חישוב שני. */
    waiting?: boolean;
    readAt?: string | null;
  } | null;
  window: WaWindow;
  messages: WaMessage[];
  /** ריק כשהשרת לא הצליח לטעון את המחסנית. אין תבניות אינו שגיאה. */
  templates?: SendableTemplate[];
}

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  // 🔴 **200 אינו אימות.** תשובה שאינה JSON מגיעה כשהבקשה נענתה על ידי
  // משהו אחר: שרת הפיתוח שמחזיר את ה-HTML של האפליקציה, פרוקסי, או דף
  // התחברות. הקוד הקודם בלע את זה (`catch` שהחזיר אובייקט ריק), החזיר
  // הצלחה, והמסך קרס אחר כך על שדה חסר. אותה משפחה כמו כתובת המסמך של
  // פריוריטי שהחזירה 200 עם דף התחברות.
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new Error(`התשובה מהשרת אינה JSON (HTTP ${res.status}). ייתכן שהסשן פג.`);
  }
  const json = await res.json().catch(() => null);
  if (json === null) throw new Error(`תשובה פגומה מהשרת (HTTP ${res.status})`);

  // ההודעה מהשרת עדיפה על "HTTP 409". השרת יודע **למה** נדחתה השליחה
  // (חלון סגור, שדה חסר), והמסך צריך להגיד את זה ולא קוד מספרי.
  if (!res.ok || json.ok === false) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json;
}

export async function fetchInbox(
  tab: 'waiting' | 'all',
  q: string,
  includeAuto = false,
): Promise<InboxResponse> {
  const params = new URLSearchParams({ tab });
  if (q.trim()) params.set('q', q.trim());
  if (includeAuto) params.set('includeAuto', '1');
  // 🔴 הרשימה יושבת ב-`api/conversation` בלי פרמטר לקוח, כי תוכנית
  // Hobby של Vercel חוסמת ב-12 פונקציות לפריסה והקובץ ה-13 נפל.
  return authFetch(`/api/conversation?${params.toString()}`);
}

export async function fetchThread(phone: string): Promise<ThreadResponse> {
  return authFetch(`/api/conversation?phone=${encodeURIComponent(phone)}`);
}

/**
 * מסמן שהעובד פתח את השיחה במפורש.
 *
 * 🔴🔴 **רק מלחיצה של אדם, אף פעם לא מטעינה.** השרשור נטען גם בבחירה
 * אוטומטית של השורה הראשונה, וגם ברענון כל כמה שניות. אם אלה היו
 * מסמנים קריאה, שיחה שאיש לא ראה הייתה יורדת מרשימת הממתינים בשקט,
 * וזה בדיוק הכשל שהרשימה נועדה למנוע. [[render_is_not_a_user_event]]
 *
 * ⭐ ונכשל בשקט. סימון שלא נרשם אינו סיבה להפריע לעובד באמצע עבודה,
 * והשיחה פשוט תישאר ברשימה.
 */
export async function markThreadRead(phone: string): Promise<void> {
  try {
    await authFetch(`/api/conversation?phone=${encodeURIComponent(phone)}&markRead=1`);
  } catch {
    /* לא מפריעים */
  }
}

export async function sendText(phone: string, bodyText: string): Promise<void> {
  await authFetch('/api/wa-send', {
    method: 'POST',
    body: JSON.stringify({ phone, kind: 'text', bodyText }),
  });
}

/**
 * שליחת תבנית מאושרת.
 *
 * ⭐ **זו הדרך היחידה לפנות ללקוח שחלון 24 השעות שלו נסגר.** השרת כבר
 * תמך בזה מהיום הראשון (מנוע הסקרים משתמש בו), ורק המסך לא הציע את זה.
 */
export async function sendTemplate(
  phone: string,
  templateKey: string,
  values: Record<string, string>,
): Promise<void> {
  await authFetch('/api/wa-send', {
    method: 'POST',
    body: JSON.stringify({ phone, kind: 'template', templateKey, values }),
  });
}

/**
 * כתובת חתומה לקובץ ששמור אצלנו.
 *
 * 🔴 לא הכתובת של heyy: היא פגה אחרי 24 שעות, והודעה מלפני יומיים הייתה
 * מובילה לקישור מת.
 */
export async function attachmentUrl(messageId: string, index = 0): Promise<string> {
  const json = await authFetch(
    `/api/wa-media?message=${encodeURIComponent(messageId)}&i=${index}`,
  );
  return json.url as string;
}

/**
 * כתובת חתומה שמורידה את הקובץ למחשב (content-disposition של הורדה),
 * במקום להציג אותו. משמשת את כפתור השמירה שעל תמונות בשיחה.
 */
export async function attachmentDownloadUrl(messageId: string, index = 0): Promise<string> {
  const json = await authFetch(
    `/api/wa-media?message=${encodeURIComponent(messageId)}&i=${index}&download=1`,
  );
  return json.url as string;
}

/** מי שלח, בשם שאפשר לקרוא. זהה במכוון ל-`authorLabel` שבחלונית. */
export function authorLabel(raw: string | null): string {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  if (!v.startsWith('user:')) return v === 'cron' ? 'אוטומטי' : v;
  const handle = v.slice(5).split('@')[0];
  // מייל סינתטי של שם משתמש בעברית: אין ממנו שום מידע קריא.
  return /^u[0-9a-f]{40}$/.test(handle) ? 'עובד' : handle;
}

/** כמה זמן מחכים, בעברית. זהה ל-`waitLabel` שבשרת. */
export function waitLabel(minutes: number | null): string {
  if (minutes == null) return '';
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'יום' : days === 2 ? 'יומיים' : `${days} ימים`;
}

// ─── שיוך מספר לא מזוהה ללקוח (06/09/2026) ──────────────────────────────
// ההחלטה מי הלקוח היא של העובד; השרת מבצע, זוכר את המספר, ומעביר את
// התמונות שכבר נשלחו לכרטיס הלקוח ולפריוריטי.
export interface LinkResult {
  ok: true;
  customerNumber: string;
  customerName: string;
  /** כמה תמונות עברו ללקוח רטרואקטיבית */
  photos: number;
  serviceCallId: string | null;
}

export async function linkConversation(opts: {
  conversationId: string;
  customerNumber: string;
  label?: string | null;
  remember?: boolean;
}): Promise<LinkResult> {
  return authFetch('/api/conversation', {
    method: 'POST',
    body: JSON.stringify({ action: 'link', ...opts }),
  });
}

export async function rememberContact(opts: {
  customerNumber: string;
  phone: string;
  label?: string | null;
}): Promise<void> {
  await authFetch('/api/conversation', {
    method: 'POST',
    body: JSON.stringify({ action: 'remember', ...opts }),
  });
}
