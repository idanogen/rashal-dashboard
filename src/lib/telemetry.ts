import { supabase } from './supabase';

/**
 * לוגים של תקופת ההרצה בדשבורד (01/11/2026, תוכנית הלוגים). אותה טבלה של
 * האפליקציה (`app_events` דרך `log_app_events`), עם app='dashboard'.
 * נרשמים מעברי מסכים עם הזמן בכל מסך, כל console.error (כולל גבול השגיאות)
 * ושגיאות שלא נתפסו. בלי תוכן: נתיב, שם, הודעת שגיאה.
 * מסך הסקר (/s/) פתוח ללקוחות בלי משתמש, ולכן לא נרשם בכלל.
 */
type Kind = 'session' | 'screen' | 'action' | 'error' | 'stuck' | 'form';

interface AppEvent {
  id: string;
  at: string;
  app: 'dashboard';
  version: string;
  device: string;
  screen: string | null;
  kind: Kind;
  name: string;
  stopId: string | null;
  detail: Record<string, unknown>;
}

const KEY = 'rashal:telemetry:v1';
const CAP = 500;
const BATCH = 100;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

let buffer: AppEvent[] = [];
let started = false;
let flushing = false;
let screen: string | null = null;
let screenSince = Date.now();

function isPublicPath(path: string): boolean {
  return path.startsWith('/s/') || path.startsWith('/reset');
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(buffer));
  } catch {
    // מצב פרטי או אחסון מלא: האירועים נשארים בזיכרון עד השליחה.
    buffer = buffer.slice(-100);
  }
}

function text(args: unknown[]): string {
  const s = args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : safeJson(a)))
    .join(' ');
  return s.length > 500 ? s.slice(0, 500) + '…' : s;
}

function safeJson(a: unknown): string {
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

export function track(kind: Kind, name: string, detail: Record<string, unknown> = {}): void {
  if (!started) return;
  buffer.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    app: 'dashboard',
    version: __BUILD_ID__,
    device: navigator.userAgent.slice(0, 40),
    screen,
    kind,
    name,
    stopId: null,
    detail,
  });
  if (buffer.length > CAP) buffer = buffer.slice(-CAP);
  save();
}

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  flushing = true;
  const batch = buffer.slice(0, BATCH);
  try {
    const { error } = await supabase.rpc('log_app_events', { p_events: batch });
    if (!error) {
      const sent = new Set(batch.map((e) => e.id));
      buffer = buffer.filter((e) => !sent.has(e.id));
      save();
    }
  } catch {
    // בלי רשת: הצרור נשאר בחוצץ לניסיון הבא. לא נרשם כשגיאה, אחרת הוא מזין את עצמו.
  } finally {
    flushing = false;
  }
}

/** מעבר מסך. מזהים בנתיב מוחלפים ב-[id] כדי שהמסך ייספר כאחד. */
export function trackScreen(path: string): void {
  if (!started) return;
  const next = path.replace(UUID, '[id]');
  if (next === screen) return;
  if (screen) track('screen', 'leave', { ms: Date.now() - screenSince });
  screen = next;
  screenSince = Date.now();
  track('screen', 'enter');
}

export function startTelemetry(): void {
  if (started || isPublicPath(window.location.pathname)) return;
  started = true;
  try {
    buffer = JSON.parse(localStorage.getItem(KEY) || '[]') as AppEvent[];
  } catch {
    buffer = [];
  }

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    const message = text(args);
    const tag = message.match(/^\[([^\]]{1,40})\]/);
    track('error', tag ? tag[1] : message.split(/[:\n]/)[0].slice(0, 60) || 'error', { message });
  };
  window.addEventListener('error', (e) => track('error', 'uncaught', { message: text([e.error ?? e.message]) }));
  window.addEventListener('unhandledrejection', (e) => track('error', 'unhandled_rejection', { message: text([e.reason]) }));

  track('session', 'app_open');
  window.setInterval(() => void flush(), 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (screen) track('screen', 'leave', { ms: Date.now() - screenSince, hidden: true });
      void flush();
    } else {
      screenSince = Date.now();
    }
  });
}
