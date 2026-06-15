import { createClient } from '@supabase/supabase-js';

// Strip trailing junk from env values: real whitespace AND a literal `\n`
// (backslash+n) that got baked into the Vercel env var. A stray newline on the
// anon key ends up as `%0A` on the realtime WebSocket apikey param and the
// socket is rejected ("WebSocket connection failed"); the literal `\n` variant
// breaks it the same way. REST tolerates it, so only realtime surfaces it.
const cleanEnv = (s?: string): string | undefined => s?.replace(/(?:\\n|\s)+$/g, '');
const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const anonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Builds a unique realtime channel name.
 *
 * `supabase.channel(topic)` returns an *existing* channel when one with the
 * same topic is still registered. During React StrictMode re-mounts (or any
 * re-mount before the async `removeChannel` teardown finishes) this hands back
 * an already-subscribed channel, and calling `.on('postgres_changes', …)` on it
 * throws "cannot add postgres_changes callbacks … after subscribe()".
 *
 * Giving every subscription its own name guarantees a fresh, unsubscribed
 * channel each time, so `.on()` always succeeds. Pair with
 * `supabase.removeChannel(channel)` on cleanup to tear down that exact instance.
 */
let channelSeq = 0;
export function uniqueChannelName(base: string): string {
  channelSeq += 1;
  return `${base}-${channelSeq}`;
}
