import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * טריות הנתונים במסך, ומי אחראי לה.
 *
 * 🔴🔴 **הרקע (07/09/2026):** הרשימות במסך התרעננו רק דרך הערוץ החי של
 * Supabase. יומן השרת הראה "אין משתמשים מחוברים" 6 עד 8 פעמים ביום עבודה,
 * כלומר רוב היום אף מסך במשרד לא החזיק ערוץ. מסך שנשאר פתוח קפא עד F5,
 * וזה נראה בדיוק כמו "הסנכרון עם פריוריטי לא עובד", למרות שהמסד היה מלא.
 *
 * ⭐ **שלוש השכבות שעידן בחר:**
 *   1. בדיקת שינויים פעם בדקה, ובחזרה לחלון: קריאה אחת קטנה (`sync_freshness`)
 *      שמחזירה את `max(updated_at)` של כל טבלה. רק טבלה שזזה נטענת מחדש.
 *      זה מה שמאפשר "רענון בחזרה לחלון" בלי לטעון אלפי שורות בכל מעבר טאב.
 *   2. חיבור מחדש של הערוץ החי כשהוא נופל (ב-useRealtimeSync).
 *   3. חיווי בכותרת: מתי המשיכה האחרונה מפריוריטי הצליחה, וכפתור "משוך עכשיו".
 *
 * המפתחות ב-`marks` הם מפתחות ה-query של הדשבורד, והם נקבעים במסד
 * (`sync_freshness`). שינוי שם באחד הצדדים משתיק את הרענון בלי שגיאה.
 */
export interface Freshness {
  /** מתי משיכת הליבה האחרונה מפריוריטי הצליחה */
  pullAt: string | null;
  pullStatus: string | null;
  /** מתי הבדיקה האחרונה שלנו רצה בהצלחה */
  probedAt: number;
  channel: 'connecting' | 'live' | 'down';
  /** משיכה יזומה רצה עכשיו */
  pulling: boolean;
  error: string | null;
}

type Marks = Record<string, string | null>;

let state: Freshness = { pullAt: null, pullStatus: null, probedAt: 0, channel: 'connecting', pulling: false, error: null };
let marks: Marks | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<Freshness>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function setChannelState(channel: Freshness['channel']) {
  if (state.channel !== channel) set({ channel });
}

export function useFreshness(): Freshness {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
    () => state,
  );
}

let inflight: Promise<void> | null = null;
let lastProbe = 0;

/**
 * בדיקת שינויים אחת. מרעננת רק מפתחות שה-`updated_at` שלהם התקדם.
 * `minGapMs` מונע הצפה כשכמה אירועים (חזרה לחלון, רשת חזרה, טיימר) נופלים יחד.
 */
export function probeFreshness(qc: QueryClient, minGapMs = 4_000): Promise<void> {
  if (inflight) return inflight;
  if (Date.now() - lastProbe < minGapMs) return Promise.resolve();
  inflight = (async () => {
    try {
      const { data, error } = await supabase.rpc('sync_freshness');
      if (error) throw new Error(error.message);
      const d = (data ?? {}) as { pull_at?: string | null; pull_status?: string | null; marks?: Marks };
      const next: Marks = d.marks ?? {};
      if (marks) {
        for (const [key, mark] of Object.entries(next)) {
          if ((mark ?? '') !== (marks[key] ?? '')) qc.invalidateQueries({ queryKey: [key] });
        }
      }
      marks = next;
      lastProbe = Date.now();
      set({ pullAt: d.pull_at ?? null, pullStatus: d.pull_status ?? null, probedAt: lastProbe, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** "משוך עכשיו": משיכה מיידית מפריוריטי דרך השרת, ואז בדיקת שינויים. */
export async function pullNow(qc: QueryClient): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (state.pulling) return { ok: false, skipped: 'busy' };
  set({ pulling: true, error: null });
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const r = await fetch('/api/priority-sync?action=pull-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; skipped?: string; error?: string };
    if (!r.ok) {
      set({ error: j.error ?? `HTTP ${r.status}` });
      return { ok: false, error: j.error ?? `HTTP ${r.status}` };
    }
    lastProbe = 0;
    await probeFreshness(qc, 0);
    return { ok: true, skipped: j.skipped };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    set({ error: msg });
    return { ok: false, error: msg };
  } finally {
    set({ pulling: false });
  }
}

/**
 * האם עכשיו שעות עבודה בשעון ישראל (א-ה 07:00 עד 19:00, שישי 07:00 עד 13:00).
 * מחוץ להן משיכה ישנה אינה תקלה, ולכן החיווי לא מכתים.
 */
export function isWorkHoursIL(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23', weekday: 'short', hour: '2-digit',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  if (wd === 'Sat') return false;
  if (wd === 'Fri') return hr >= 7 && hr < 13;
  return hr >= 7 && hr < 19;
}

/** ניסוח עברי תקין. "לפני 1 דקות" ו-"לפני 2822 דקות" שניהם לא תקינים. */
export function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'עכשיו';
  if (minutes === 1) return 'לפני דקה';
  if (minutes === 2) return 'לפני שתי דקות';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'לפני שעה';
  if (hours === 2) return 'לפני שעתיים';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'לפני יום';
  if (days === 2) return 'לפני יומיים';
  return `לפני ${days} ימים`;
}
