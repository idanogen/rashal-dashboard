/**
 * שער הסוד לכל Edge Function (23/09/2026).
 *
 * 🔴🔴 המפתח הציבורי של Supabase נמצא בחבילה של הדפדפן, ולכן `verify_jwt`
 * לבדו לא מגן על כלום: כל אחד יכול היה להפעיל שליחת סקרים ללקוחות, לעקוף
 * את מתג ה-dry_run ולקבל בחזרה שמות וטלפונים. כל קורא אמיתי (pg_cron,
 * טריגרים, השרת ב-Vercel) שולח `x-sync-secret` = `PRIORITY_SYNC_SECRET`
 * (אותו ערך של `public.sync_secret()` במסד).
 *
 * השוואה בזמן קבוע, וסוד חסר בסביבה = סגור ולא פתוח.
 */
export function requireSecret(req: Request): Response | null {
  const expected = Deno.env.get("PRIORITY_SYNC_SECRET") ?? "";
  const got = req.headers.get("x-sync-secret") ?? "";
  if (!expected || !timingSafeEqual(got, expected)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < eb.length; i++) diff |= (ea[i] ?? 0) ^ eb[i];
  return diff === 0;
}
