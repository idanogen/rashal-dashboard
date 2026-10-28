/**
 * מייל על שינוי טלפון/כתובת מהשטח (28/10/2026).
 *
 * נקרא בשתי דרכים: מיד מ-`stop_details_change` (pg_net, גוף `{id}`), וכל 10
 * דקות מהקרון `rashal-field-change-mail-sweep` (גוף `{sweep:true}`) לכל מה
 * שלא יצא. הנמענים ב-`field_change_settings.recipients`, לא בקוד.
 *
 * 🔴 `emailed_at` נכתב רק אחרי ש-Resend החזיר 200. כשל נרשם ב-`email_error`
 * עם ספירת ניסיונות (עד 5), והקרון מנסה שוב. בלי מפתח Resend = כשל רשום, לא שקט.
 *
 * בנוסף: כתובת שזזה מקבלת מיקום חדש על המפה מכאן (שירות המיפוי המרכזי),
 * כדי שהסיכה בדשבורד לא תחכה למי שיפתח את היומן.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { buildFieldChangeEmail, recipientEmails, type FieldChangeRow } from "./mail.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("FIELD_CHANGE_FROM") ?? Deno.env.get("FORM_COPY_FROM") ?? '"ר.שעל ציוד רפואי" <system@ogensolutions.biz>';
const EXTRA_TO = (Deno.env.get("FIELD_CHANGE_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") ?? "https://rashal-dashboard.vercel.app/dispatch";
const GEO_URL = Deno.env.get("GEO_SERVICE_URL") ?? "https://ogen-geo-service.vercel.app";
const MAX_ATTEMPTS = 5;

type Settings = { enabled: boolean; recipients: unknown };

async function loadSettings(): Promise<Settings> {
  const { data } = await sb.from("field_change_settings").select("enabled, recipients").eq("id", true).maybeSingle();
  return { enabled: data?.enabled !== false, recipients: data?.recipients ?? [] };
}

async function sendOne(row: FieldChangeRow, to: string[]): Promise<{ ok: boolean; detail: string }> {
  if (!RESEND_KEY) return { ok: false, detail: "אין מפתח Resend" };
  if (!to.length) return { ok: false, detail: "אין נמענים" };
  const mail = buildFieldChangeEmail(row, { dashboardUrl: DASHBOARD_URL });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  return res.ok ? { ok: true, detail: String(body.id ?? "") } : { ok: false, detail: String(body.message ?? `HTTP ${res.status}`).slice(0, 300) };
}

/** מיקום מחדש של עצירה שכתובתה זזה, רק אם עדיין אין לה קואורדינטות. */
async function geocodeStop(stopId: string): Promise<void> {
  const { data: s } = await sb.from("calendar_stops").select("id, address, city, geocoded_lat, geocoded_at").eq("id", stopId).maybeSingle();
  if (!s || s.geocoded_lat != null || s.geocoded_at != null || !s.address) return;
  try {
    const u = new URL(`${GEO_URL}/api/geocode`);
    // כמו `geocodeQuery` בדשבורד: העיר בתוך הכתובת, אחרת הנקודה נופלת למרכז העיר.
    const addr = String(s.address);
    u.searchParams.set("address", s.city && !addr.includes(s.city) ? `${addr}, ${s.city}` : addr);
    if (s.city) u.searchParams.set("city", s.city);
    const r = await fetch(u.toString());
    if (!r.ok) return;
    const j = await r.json().catch((e: unknown) => { console.warn("geocode json:", String(e)); return null; }) as
      { result?: { lat?: number; lng?: number; displayName?: string } } | null;
    const lat = Number(j?.result?.lat), lng = Number(j?.result?.lng);
    const patch: Record<string, unknown> = { geocoded_at: new Date().toISOString() };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      Object.assign(patch, { geocoded_lat: lat, geocoded_lng: lng, geocoded_address: j?.result?.displayName ?? null });
    }
    await sb.from("calendar_stops").update(patch).eq("id", stopId);
  } catch (e) {
    // הדשבורד ישלים בפתיחה הבאה (useGeocodeBackfill); המייל יוצא בכל מקרה.
    console.warn("geocode failed:", stopId, e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(async (req) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as { id?: string; sweep?: boolean };

  let q = sb.from("stop_detail_changes").select("*").is("emailed_at", null).lt("email_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true }).limit(20);
  if (body.id) q = q.eq("id", body.id);
  const { data: rows, error } = await q;
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  const settings = await loadSettings();
  const to = [...new Set([...recipientEmails(settings.recipients), ...EXTRA_TO])];
  let sent = 0, failed = 0;
  for (const row of (rows ?? []) as (FieldChangeRow & { stop_id: string; relocate: boolean })[]) {
    if (row.relocate) await geocodeStop(row.stop_id);
    if (!settings.enabled) continue;
    const r = await sendOne(row, to);
    if (r.ok) {
      sent++;
      await sb.from("stop_detail_changes").update({ emailed_at: new Date().toISOString(), email_to: to, email_error: null }).eq("id", row.id);
    } else {
      failed++;
      const attempts = (row as unknown as { email_attempts: number }).email_attempts + 1;
      await sb.from("stop_detail_changes").update({ email_error: r.detail, email_attempts: attempts }).eq("id", row.id);
    }
  }
  await sb.from("field_change_settings").update({ last_result: { at: new Date().toISOString(), sent, failed, to } }).eq("id", true);
  return new Response(JSON.stringify({ ok: true, sent, failed, to, enabled: settings.enabled }), { headers: { "Content-Type": "application/json" } });
});
