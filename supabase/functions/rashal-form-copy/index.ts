// rashal-form-copy — העתק של טופס חתום ללקוח, בוואטסאפ או במייל (27/10/2026).
//
// עמי ביקש שהלקוח יקבל העתק של מה שחתם באיסוף ובאספקה, לפי בקשתו. עידן הכריע:
// וואטסאפ ומייל, רק כשהלקוח מבקש, בלי אישור ההדרכה למנוף, ומה שהנהג מקליד
// נשמר אצלנו בלבד (לא נכתב לפריוריטי).
//
// שתי פעולות, שתיהן עם ה-JWT של המשתמש (נהג או משרד):
//   options — מה אפשר לבחור: הטלפון בעצירה, טלפונים מהטופס, והמייל והניידים
//             מכרטיס הלקוח ומאנשי הקשר בפריוריטי, במשיכה חיה לקריאה בלבד.
//   send    — שליחה לעד שלושה נמענים. כל נמען = שורה ב-form_copy_sends.
//
// 🔴 ההרשאה נבדקת במסד (`form_copy_context` עם ה-JWT של הקורא), לא כאן.
// 🔴 וואטסאפ יוצא רק דרך /api/heyy-send: רשימת המושתקים, 429 והיומן שם.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  copyFileName, docTypeLabel, emailOptions, MAX_SENDS_PER_FORM, parseRecipients, phoneOptions,
  type PriorityContact, type RequestedRecipient,
} from "./recipients.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const PRIORITY = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const priorityAuth = () => "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);
const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// ⭐ שולח מאומת ב-Resend. כתובת לא מאומתת נדחית, והדחייה נרשמת ליד הנמען.
const MAIL_FROM = Deno.env.get("FORM_COPY_FROM") ?? '"ר.שעל ציוד רפואי" <system@ogensolutions.biz>';
const MAIL_REPLY_TO = Deno.env.get("FORM_COPY_REPLY_TO") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

interface FormContext {
  form_id: string;
  form_key: string;
  form_kind: string;
  pdf_path: string;
  customer_number: string | null;
  customer_name: string;
  doc_number: string | null;
  stop_phone: string | null;
  form_phones: string[];
  signed_at: string | null;
  sends: unknown[];
}

/** כרטיס הלקוח ואנשי הקשר, לקריאה בלבד. כשל לא חוסם: יש תמיד הקלדה. */
async function priorityContacts(cust: string | null): Promise<{ email: string | null; contacts: PriorityContact[]; error?: string }> {
  if (!cust || !/^[A-Za-z0-9_-]{1,20}$/.test(cust)) return { email: null, contacts: [] };
  const expand = "CUSTPERSONNEL_SUBFORM($select=NAME,POSITIONDES,EMAIL,CELLPHONE,STATDES)";
  const url = `${PRIORITY}/CUSTOMERS('${cust}')?$select=CUSTNAME,EMAIL&$expand=${encodeURIComponent(expand)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: priorityAuth(), Accept: "application/json", "User-Agent": "OgenFormCopy/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { email: null, contacts: [], error: `priority ${res.status}` };
    const row = await res.json() as { EMAIL?: string | null; CUSTPERSONNEL_SUBFORM?: PriorityContact[] };
    return { email: row.EMAIL ?? null, contacts: row.CUSTPERSONNEL_SUBFORM ?? [] };
  } catch (e) {
    return { email: null, contacts: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function normalizer(raws: string[]): Promise<(raw: string) => string | null> {
  const map = new Map<string, string | null>();
  for (const raw of new Set(raws.filter(Boolean))) {
    const { data, error } = await sb.rpc("wa_normalize_phone", { raw });
    map.set(raw, error ? null : (data as string | null));
  }
  return (raw) => map.get(raw) ?? null;
}

async function buildOptions(ctx: FormContext) {
  const pri = await priorityContacts(ctx.customer_number);
  const raws = [ctx.stop_phone ?? "", ...ctx.form_phones, ...pri.contacts.map((c) => c.CELLPHONE ?? "")];
  const normalize = await normalizer(raws);
  return {
    customer_name: ctx.customer_name,
    doc_number: ctx.doc_number,
    doc_type: docTypeLabel(ctx.form_key, ctx.form_kind),
    phones: phoneOptions(ctx.stop_phone, ctx.form_phones, pri.contacts, normalize),
    emails: emailOptions(pri.email, pri.contacts),
    sends: ctx.sends,
    priority_error: pri.error ?? null,
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function sendWhatsapp(ctx: FormContext, to: string): Promise<{ ok: boolean; detail: string; id?: string }> {
  const { data: tpl } = await sb.from("wa_templates").select("heyy_template_id").eq("key", "send_document").maybeSingle();
  if (!tpl?.heyy_template_id) return { ok: false, detail: "תבנית send_document לא נמצאה" };
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-send-secret": SEND_SECRET },
    body: JSON.stringify({
      kind: "template",
      phoneE164: to,
      templateId: tpl.heyy_template_id,
      variables: [
        { name: "customer_name", value: ctx.customer_name || "לקוח יקר" },
        { name: "doc_type", value: docTypeLabel(ctx.form_key, ctx.form_kind) },
        { name: "doc_number", value: ctx.doc_number ?? ctx.customer_number ?? "" },
      ],
      documentPath: ctx.pdf_path,
      documentName: copyFileName(ctx.doc_number, ctx.signed_at),
      triggeredBy: "form-copy",
    }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  const ok = res.ok && body.ok !== false;
  const detail = String(body.message ?? body.statusDetail ?? body.error ?? (ok ? "" : `HTTP ${res.status}`)).slice(0, 300);
  return { ok, detail, id: body.waMessageId ? String(body.waMessageId) : undefined };
}

async function sendEmail(ctx: FormContext, to: string): Promise<{ ok: boolean; detail: string; id?: string }> {
  if (!RESEND_KEY) return { ok: false, detail: "אין מפתח Resend" };
  const { data: blob, error } = await sb.storage.from("signed-forms").download(ctx.pdf_path);
  if (error || !blob) return { ok: false, detail: `הורדת הקובץ נכשלה: ${error?.message ?? "ריק"}` };
  const docType = docTypeLabel(ctx.form_key, ctx.form_kind);
  const num = ctx.doc_number ? ` מספר ${ctx.doc_number}` : "";
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a2332">` +
    `<p>שלום ${escapeHtml(ctx.customer_name || "")},</p>` +
    `<p>מצורפת ${docType}${escapeHtml(num)}, כפי שנחתמה בביקור של ר.שעל.</p>` +
    `<p>בברכה,<br/>ר.שעל ציוד רפואי</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      ...(MAIL_REPLY_TO ? { reply_to: MAIL_REPLY_TO } : {}),
      subject: `${docType}${num} · ר.שעל`,
      html,
      attachments: [{ filename: copyFileName(ctx.doc_number, ctx.signed_at), content: toBase64(new Uint8Array(await blob.arrayBuffer())) }],
    }),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  return res.ok
    ? { ok: true, detail: "", id: body.id ? String(body.id) : undefined }
    : { ok: false, detail: String(body.message ?? `HTTP ${res.status}`).slice(0, 300) };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendAll(ctx: FormContext, recipients: RequestedRecipient[], user: { id: string | null; name: string | null }) {
  const results = [];
  for (const r of recipients) {
    const { data: row, error } = await sb.from("form_copy_sends").insert({
      signed_form_id: ctx.form_id, channel: r.channel, recipient: r.value, recipient_source: r.source,
      recipient_label: r.label, requested_by: user.id, requested_name: user.name,
    }).select("id").single();
    if (error) {
      results.push({ channel: r.channel, to: r.value, ok: false, detail: `רישום נכשל: ${error.message}` });
      continue;
    }
    let out: { ok: boolean; detail: string; id?: string };
    try {
      out = r.channel === "whatsapp" ? await sendWhatsapp(ctx, r.value) : await sendEmail(ctx, r.value);
    } catch (e) {
      out = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
    // 🔴 "נשלח" נכתב רק אחרי שהספק קיבל. כשל נשאר גלוי ביומן ובתשובה.
    await sb.from("form_copy_sends").update({
      status: out.ok ? "sent" : "failed", detail: out.detail || null, provider_id: out.id ?? null,
      sent_at: out.ok ? new Date().toISOString() : null,
    }).eq("id", row.id);
    results.push({ channel: r.channel, to: r.value, ok: out.ok, detail: out.detail });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authorization } } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const formId = String(body.formId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(formId)) return json({ ok: false, error: "bad formId" }, 400);

  const { data: ctxData, error: ctxErr } = await asUser.rpc("form_copy_context", { p_form_id: formId });
  if (ctxErr || !ctxData) return json({ ok: false, error: "forbidden", message: ctxErr?.message ?? "no form" }, 403);
  const ctx = ctxData as FormContext;

  if (body.action === "options") return json({ ok: true, ...(await buildOptions(ctx)) });

  if (body.action === "send") {
    const recipients = parseRecipients(body.recipients);
    if (!recipients) return json({ ok: false, error: "bad recipients", message: "נמען לא תקין, או יותר משלושה" }, 400);
    if (ctx.sends.length + recipients.length > MAX_SENDS_PER_FORM) {
      return json({ ok: false, error: "too many", message: "לטופס הזה כבר נשלחו העתקים רבים. פנה למשרד." }, 429);
    }
    const meta = (who.user.user_metadata ?? {}) as Record<string, unknown>;
    const name = String(meta.full_name ?? meta.name ?? who.user.email ?? "").slice(0, 80) || null;
    const results = await sendAll(ctx, recipients, { id: who.user.id, name });
    return json({ ok: results.every((r) => r.ok), results });
  }

  return json({ ok: false, error: "bad action" }, 400);
});
