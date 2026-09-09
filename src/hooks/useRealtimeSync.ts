import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, uniqueChannelName } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { probeFreshness, setChannelState } from '@/lib/sync-freshness';

// A sync run touches many rows at once, so postgres_changes arrives as a burst.
// Invalidating per event refetched whole tables repeatedly; coalesce the burst
// into one invalidation per query key.
const COALESCE_MS = 1500;

/** בדיקת שינויים תקופתית (שכבה 1). ראה sync-freshness.ts. */
const PROBE_EVERY_MS = 60_000;

/** השהיות בין ניסיונות חיבור מחדש של הערוץ (שכבה 2). */
const RECONNECT_DELAYS_MS = [3_000, 8_000, 20_000, 45_000];

/**
 * טבלה → מפתחות ה-query שהיא מפילה. טבלה אחת יכולה להזיז כמה מסכים.
 *
 * ⭐⭐ **תיבת הוואטסאפ הצטרפה ב-08/09/2026.** עד אז היא הייתה המסך היחיד
 * שנשען על טיימר בלבד מול Vercel, והיא לבדה ייצרה 14,077 בקשות ביממה כדי
 * לתפוס בערך 60 הודעות. `whatsapp_inbound` ו-`whatsapp_outbound` כבר היו
 * בפרסום החי ואיש לא האזין להן, ו-`wa_conversations` נוספה במיגרציה
 * `20260908_wa_realtime_freshness`.
 *
 * 🔴 **ההודעות מפילות גם את הרשימה וגם את השרשור,** כי הודעה חדשה משנה
 * את שתיהן: השרשור מקבל שורה, והרשימה מקבלת סדר ומונה חדשים.
 *
 * 🔴 **הרשאות: אין כאן חשיפה חדשה.** הערוץ החי מכבד RLS, ולכן סדרן ומנהל
 * מקבלים אירוע על כל הודעה, נהג רק על מה שקשור להזמנה שלו, וזה בדיוק מה
 * שכל אחד מהם כבר רשאי לראות במסך.
 */
const TABLE_KEYS: Array<[table: string, keys: string[]]> = [
  ['orders', ['orders']],
  ['routes', ['routes']],
  ['service_calls', ['serviceCalls']],
  ['calendar_stops', ['calendarStops']],
  ['pickups', ['pickups']],
  ['whatsapp_inbound', ['wa-thread', 'wa-inbox']],
  ['whatsapp_outbound', ['wa-thread', 'wa-inbox']],
  ['wa_conversations', ['wa-inbox']],
];

/**
 * 🔴🔴 **07/09/2026: הערוץ החי הוא נוחות, לא ערבות.** עד היום הוא היה
 * מסלול הרענון היחיד, בלי טיפול בנפילה ובלי גיבוי, ומסך שנשאר פתוח קפא עד
 * F5 ברגע שהערוץ נפל (שינה, רשת, טאב שהוקפא, חידוש טוקן). יומן השרת הראה
 * "אין משתמשים מחוברים" 6 עד 8 פעמים ביום עבודה.
 *
 * מהיום שלוש שכבות: הערוץ (מיידי), בדיקת שינויים כל דקה ובחזרה לחלון
 * (זולה: קריאה אחת שמחזירה `max(updated_at)` לכל טבלה), וחיבור מחדש של
 * הערוץ עם המתנה גדלה. כשהערוץ חוזר, בודקים שינויים מיד כדי להשלים מה
 * שפוספס בזמן שהיה למטה.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { loading } = useAuth();

  useEffect(() => {
    // Wait until the auth session has resolved before opening the socket.
    // Subscribing earlier connects with the anon apikey, then supabase-js swaps
    // in the user JWT once the session loads and reconnects — closing the
    // still-connecting socket ("WebSocket is closed before the connection is
    // established"). Gating on `loading` lets the socket connect once, already
    // authenticated.
    if (loading) return;

    const pendingKeys = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let wasDown = false;
    let disposed = false;

    const scheduleInvalidate = (key: string) => {
      pendingKeys.add(key);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const keys = [...pendingKeys];
        pendingKeys.clear();
        for (const k of keys) queryClient.invalidateQueries({ queryKey: [k] });
      }, COALESCE_MS);
    };

    const probe = () => { void probeFreshness(queryClient); };

    const open = () => {
      if (disposed) return;
      if (channel) { void supabase.removeChannel(channel); channel = null; }
      let ch = supabase.channel(uniqueChannelName('db-changes'));
      for (const [table, keys] of TABLE_KEYS) {
        ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          for (const key of keys) scheduleInvalidate(key);
        });
      }
      channel = ch.subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          setChannelState('live');
          // חזרנו אחרי נפילה: מה שקרה בינתיים לא הגיע דרך הערוץ.
          if (wasDown) { wasDown = false; void probeFreshness(queryClient, 0); }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDown = true;
          setChannelState('down');
          if (reconnectTimer) return;
          const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
          attempt += 1;
          reconnectTimer = setTimeout(() => { reconnectTimer = undefined; open(); }, delay);
        }
      });
    };

    open();

    // שכבה 1: בדיקת שינויים כל דקה, ובכל חזרה לחלון / לרשת.
    probe();
    const interval = setInterval(() => { if (document.visibilityState !== 'hidden') probe(); }, PROBE_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') probe(); };
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', probe);
    window.addEventListener('online', probe);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', probe);
      window.removeEventListener('online', probe);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient, loading]);
}
