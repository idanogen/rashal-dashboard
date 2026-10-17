import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * החיבור שבו עמוד החתימה עובד.
 *
 * הטכנאי עובד באפליקציה (rashal-driver), והטופס נפתח בדפדפן של הטלפון
 * (`expo-web-browser`, שכבר בבנייה, כך שזה יוצא ב-OTA ולא דורש APK חדש).
 * לדפדפן אין את ההתחברות של האפליקציה, ולכן האפליקציה מעבירה את אסימון
 * הגישה בקטע ה-`#t=` של הכתובת.
 *
 * 🔴🔴 **רק אסימון הגישה, לעולם לא אסימון הרענון.** Supabase מסובב את
 * אסימון הרענון בכל שימוש, ושימוש חוזר אחרי חלון קצר מבטל את כל ההתחברות.
 * אם הדפדפן היה מקבל אותו ומרענן לבד, הטכנאי היה מנותק מהאפליקציה בשטח.
 * אסימון גישה חי כשעה ולא מרענן, וזה בדיוק אורך החיים שטופס צריך.
 * 🔴 המפתח הוא `t` ולא `access_token`: הלקוח הרגיל (`detectSessionInUrl`)
 * מנסה לבלוע `#access_token=` כהתחברות מלאה.
 * ⭐ הקטע (`#`) לא נשלח לשרת, ומוסר מההיסטוריה מיד בקריאה.
 */

let tokenClient: SupabaseClient | null = null;
let consumed = false;

function readHashToken(): string | null {
  if (consumed || typeof window === 'undefined') return null;
  consumed = true;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const t = params.get('t');
  if (t) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return t;
}

export function formsClient(): SupabaseClient {
  if (tokenClient) return tokenClient;
  const token = readHashToken();
  if (!token) return supabase;
  tokenClient = createClient(
    import.meta.env.VITE_SUPABASE_URL.replace(/(?:\\n|\s)+$/g, ''),
    import.meta.env.VITE_SUPABASE_ANON_KEY.replace(/(?:\\n|\s)+$/g, ''),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  return tokenClient;
}

/** האם העמוד נפתח מהאפליקציה (ולכן אין בו תפריט ואין לאן לחזור בדפדפן). */
export function openedFromApp(): boolean {
  return tokenClient !== null;
}
