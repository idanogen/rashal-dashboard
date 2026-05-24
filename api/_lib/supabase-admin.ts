import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the SERVICE ROLE key. Bypasses RLS.
// Set in Vercel ENV (Production + Preview + Development):
//   SUPABASE_URL=https://kukstfxtznymfkirdmty.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← KEEP SECRET, never expose to browser

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in serverless env');
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
