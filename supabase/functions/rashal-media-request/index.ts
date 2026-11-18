// rashal-media-request — מנוע "תמונה לפני טכנאי".
// רץ כל 15 דקות מ-pg_cron (job `rashal-media-requests`).
//
// שלושה שלבים בריצה אחת:
//   1. תור    — media_request_enqueue() מכניס קריאות שהגיעו ל"לביצוע".
//   2. שליחה  — media_claim_due() תופס ראשונות ותזכורות שהגיע זמנן,
//               וההודעה יוצאת דרך /api/heyy-send הקיים (מושתקים, 429, לוג).
//   3. תחזוקה — ביטולים, פגי תוקף ו"אין מענה" נעשים בתוך ה-claim במסד.
//
// 4. רצף "שלח תזכורת לתמונה" (18/11/2026): media_nudge_claim() תופס את מה שהמשרד
//    התחיל מכרטיס אדום. trigger "nudge" (קרון כל 2 דקות) מריץ רק את השלב הזה.
//
// ⚠ המתג במסד (media_request_settings.enabled / dry_run), לא כאן ולא ב-env.
// 🔴 מצב יבש מחשב את אותו דבר בדיוק ולא שולח, מאותן שאילתות.
// 🔴 בלי מזהי תבניות (עד אישור מטא) שום דבר לא נתפס מהתור: תפיסה בלי
//    יכולת שליחה הייתה משאירה שורות claimed תקועות.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { isPausedResponse, sendWithExtras, type SendResult } from "../_shared/send-with-extras.ts";

const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface DueRow {
  id: string;
  stage: "first" | "reminder";
  customer_name: string | null;
  phone_e164: string;
  /** בני משפחה שקישרנו ללקוח (customer_contacts). החלטת עידן 06/09: גם אליהם. */
  extra_phones?: string[] | null;
  device_name: string | null;
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  let trigger = "manual";
  let forceDry: boolean | null = null;
  let max = 20;
  try {
    const b = await req.json();
    if (b?.trigger) trigger = String(b.trigger);
    if (typeof b?.dry === "boolean") forceDry = b.dry;
    if (b?.max != null && Number.isFinite(Number(b.max))) max = Math.max(0, Number(b.max));
  } catch { /* ברירות מחדל */ }

  const { data: cfg, error: cfgErr } = await sb
    .from("media_request_settings").select("*").eq("id", true).single();
  if (cfgErr || !cfg) {
    return json({ ok: false, error: `settings unavailable: ${cfgErr?.message}` }, 500);
  }

  const dry = forceDry ?? cfg.dry_run;

  const { data: winData } = await sb.rpc("media_window_open");
  const windowOpen = winData === true;

  // כבוי = לא נוגעים בתור בכלל, כדי שהדלקה לא תמצא תור שהצטבר בשקט.
  if (!cfg.enabled) {
    await logRun({ trigger, dry, detail: { skipped: "engine disabled" } });
    return json({ ok: true, enabled: false, note: "engine disabled" });
  }

  // ── 4. רצף תזכורות מהכפתור: לבד בקרון הקצר, ובסוף כל ריצה רגילה ──
  if (trigger === "nudge") {
    const nudges = dry ? { skipped: "dry run" } : await runNudges(cfg, max);
    return json({ ok: true, trigger, nudges });
  }

  // ── 1. תור ─────────────────────────────────────────────────────────────
  const { data: enqueued, error: enqErr } = await sb.rpc("media_request_enqueue", { p_commit: !dry });
  if (enqErr) {
    await logRun({ trigger, dry, detail: { enqueue_error: enqErr.message } });
    return json({ ok: false, error: enqErr.message }, 500);
  }
  const enqueuedRows = (enqueued ?? []) as Array<Record<string, unknown>>;

  // ── 2. שליחה ───────────────────────────────────────────────────────────
  let due: DueRow[] = [];
  let sent = 0, failed = 0, requeued = 0;
  const detail: Record<string, unknown> = {
    enqueued: enqueuedRows.map((r) => ({ name: r.customer_name, at: r.scheduled_send_at })),
  };

  const templatesReady = Boolean(cfg.template_first_id && cfg.template_reminder_id);

  if (dry || !templatesReady) {
    // קריאה בלבד: מה שיושב בתור וזמנו עבר + מה שהריצה הזו הייתה מכניסה.
    const nowIso = new Date().toISOString();
    const { data: firsts } = await sb
      .from("media_requests")
      .select("id, customer_name, phone_e164, scheduled_send_at")
      .eq("state", "pending")
      .lte("scheduled_send_at", nowIso)
      .order("scheduled_send_at")
      .limit(max);
    const { data: reminders } = await sb
      .from("media_requests")
      .select("id, customer_name, phone_e164, reminder_due_at")
      .eq("state", "first_sent")
      .lte("reminder_due_at", nowIso)
      .order("reminder_due_at")
      .limit(max);
    const fromThisRun = enqueuedRows.filter((r) => String(r.scheduled_send_at ?? "") <= nowIso);
    detail.would_send = [
      ...(firsts ?? []).map((d) => ({ name: d.customer_name, phone: d.phone_e164, stage: "first", src: "queue" })),
      ...(reminders ?? []).map((d) => ({ name: d.customer_name, phone: d.phone_e164, stage: "reminder", src: "queue" })),
      ...fromThisRun.map((r) => ({ name: r.customer_name, phone: r.phone_e164, stage: "first", src: "new" })),
    ].slice(0, max * 2);
    detail.would_send_count = (firsts?.length ?? 0) + (reminders?.length ?? 0) + fromThisRun.length;
    if (!windowOpen) detail.blocked = "מחוץ לחלון השליחה, שום דבר לא היה יוצא עכשיו";
    if (!templatesReady && !dry) detail.blocked_templates = "מזהי תבניות חסרים בהגדרות, ממתין לאישור מטא";
  } else {
    const { data, error } = await sb.rpc("media_claim_due", { p_limit: max });
    if (error) {
      await logRun({ trigger, dry, enqueued: enqueuedRows.length, detail: { claim_error: error.message } });
      return json({ ok: false, error: error.message }, 500);
    }
    due = (data ?? []) as DueRow[];

    for (const row of due) {
      // ⭐ גם אל בני המשפחה שקישרנו ללקוח, וגם כשהלקוח עצמו אינו בוואטסאפ (13/11).
      const res = await sendWithExtras(row.phone_e164, row.extra_phones, (phone) => sendOne({ ...row, phone_e164: phone }, cfg),
        (extra, err) => console.error("[media-request] extra recipient failed", extra, err));
      const nowIso = new Date().toISOString();
      if (res.ok) {
        sent++;
        if (row.stage === "first") {
          const dueAt = new Date(Date.now() + cfg.reminder_delay_hours * 3_600_000).toISOString();
          await sb.from("media_requests").update({
            state: "first_sent",
            first_sent_at: nowIso,
            reminder_due_at: dueAt,
            send_error: null,
            send_claimed_at: null,
          }).eq("id", row.id);
        } else {
          const dueAt = new Date(Date.now() + cfg.no_response_after_hours * 3_600_000).toISOString();
          await sb.from("media_requests").update({
            state: "reminder_sent",
            reminder_sent_at: nowIso,
            no_response_due_at: dueAt,
            send_error: null,
            send_claimed_at: null,
          }).eq("id", row.id);
        }
      } else if (res.retryable) {
        // 🔴 מכסת קצב אינה דחייה. השורה חוזרת למצב הקודם והריצה הבאה
        // (רבע שעה) לוקחת אותה. אותו לקח בדיוק ממנוע הסקרים.
        requeued++;
        await sb.from("media_requests").update({
          state: row.stage === "first" ? "pending" : "first_sent",
          send_error: res.error.slice(0, 500),
          send_claimed_at: null,
        }).eq("id", row.id);
      } else {
        failed++;
        await sb.from("media_requests").update({
          state: "failed",
          send_error: res.error.slice(0, 500),
          send_claimed_at: null,
        }).eq("id", row.id);
      }
    }
    if (requeued) detail.requeued_rate_limited = requeued;
  }

  if (!dry) detail.nudges = await runNudges(cfg, max);

  const runId = await logRun({
    trigger, dry, enqueued: enqueuedRows.length, due: due.length, sent, failed, detail,
  });

  return json({
    ok: true, run_id: runId, dry, window_open: windowOpen, templates_ready: templatesReady,
    enqueued: enqueuedRows.length, due: due.length, sent, failed, requeued, detail,
  });
});


/**
 * שלב ב של ההודעות בארבע שפות (08/09/2026): לנמען עם שפה שמורה, התבנית
 * בשפה שלו כשהיא מאושרת, אחרת ברירת המחדל (עברית עם כפתורי השפה).
 * ערכים מרשימה סגורה מתורגמים רק כשבאמת נשלחת תבנית בשפה אחרת.
 */
async function pickTemplate(key: string, phone: string, fallback: string): Promise<{ lang: string; templateId: string; translated: boolean }> {
  try {
    const { data } = await sb.rpc("wa_pick_template", { p_key: key, p_phone: phone, p_customer: null, p_default: fallback });
    const row = (Array.isArray(data) ? data[0] : data) as { lang?: string; template_id?: string } | null;
    const templateId = row?.template_id || fallback;
    const lang = row?.lang || "he";
    return { lang, templateId, translated: lang !== "he" && templateId !== fallback };
  } catch (e) {
    console.error("[lang] pick failed, falling back to hebrew", String(e).slice(0, 200));
    return { lang: "he", templateId: fallback, translated: false };
  }
}
async function translateValue(value: string, lang: string): Promise<string> {
  try {
    const { data } = await sb.rpc("wa_translate_value", { p_value: value, p_lang: lang });
    return typeof data === "string" && data ? data : value;
  } catch { return value; }
}

async function sendOne(
  row: DueRow,
  cfg: Record<string, unknown>,
): Promise<SendResult> {
  const fallbackId = row.stage === "first"
    ? String(cfg.template_first_id)
    : String(cfg.template_reminder_id);
  const pick = await pickTemplate(row.stage === "first" ? "media_first" : "media_reminder", row.phone_e164, fallbackId);
  const templateId = pick.templateId;
  const rawProduct = (row.device_name ?? "").trim() || String(cfg.product_fallback ?? "המוצר שברשותך");
  // שם מוצר אמיתי (RUBIX52) אינו מתורגם; רק "המוצר שברשותך" ברירת המחדל.
  const product = pick.translated ? await translateValue(rawProduct, pick.lang) : rawProduct;
  // 🔴 משתנים לפי שם, כמו שהוגדרו בעורך של heyy. לתזכורת אין משתנה שם.
  const variables = row.stage === "first"
    ? [
      { name: "name", value: row.customer_name ?? "" },
      { name: "product", value: product },
    ]
    : [{ name: "product", value: product }];

  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-send-secret": SEND_SECRET,
      },
      body: JSON.stringify({
        kind: "template",
        phoneE164: row.phone_e164,
        templateId,
        variables,
        triggeredBy: pick.translated ? `media-request-${row.stage}:${pick.lang}` : `media-request-${row.stage}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      return {
        ok: false,
        error: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
        retryable: body?.retryable === true,
        paused: isPausedResponse(res.status, body),
      };
    }
    return { ok: true };
  } catch (e) {
    // 🔴 נפילת רשת אינה ניסיון חוזר: ייתכן שההודעה יצאה ורק התשובה אבדה.
    return { ok: false, error: String(e).slice(0, 300), retryable: false };
  }
}

interface NudgeRow {
  id: string;
  step: number;
  customer_name: string | null;
  phone_e164: string;
  extra_phones?: string[] | null;
  device_name: string | null;
}

/**
 * הודעות 1-2 הן תבנית התזכורת הקיימת, הודעה 3 היא "לצערנו לא נוכל לטפל בבקשה עד
 * לקבלת תמונה" (template_nudge_final_id). העצירה (תמונה, ירוק, שיבוץ) בתוך ה-claim במסד.
 * 🔴 triggeredBy מתחיל ב-media-request-, ולכן מספר מושהה (לא בוואטסאפ) מדולג ב-heyy-send.
 */
async function runNudges(cfg: Record<string, unknown>, max: number): Promise<Record<string, unknown>> {
  const { data, error } = await sb.rpc("media_nudge_claim", { p_limit: max });
  if (error) return { claim_error: error.message };
  const rows = (data ?? []) as NudgeRow[];
  let sent = 0, failed = 0, requeued = 0;
  for (const row of rows) {
    const res = await sendWithExtras(row.phone_e164, row.extra_phones, (phone) => sendNudge({ ...row, phone_e164: phone }, cfg),
      (extra, err) => console.error("[media-nudge] extra recipient failed", extra, err));
    if (res.ok) {
      sent++;
      await sb.rpc("media_nudge_mark", { p_id: row.id, p_step: row.step, p_result: "sent" });
    } else if (res.retryable) {
      requeued++;
      await sb.rpc("media_nudge_mark", { p_id: row.id, p_step: row.step, p_result: "retry", p_error: res.error });
    } else {
      failed++;
      await sb.rpc("media_nudge_mark", { p_id: row.id, p_step: row.step, p_result: "failed", p_error: res.error });
    }
  }
  return { due: rows.length, sent, failed, requeued };
}

async function sendNudge(row: NudgeRow, cfg: Record<string, unknown>): Promise<SendResult> {
  const final = row.step >= 3;
  const fallbackId = String(final ? cfg.template_nudge_final_id : cfg.template_reminder_id);
  const pick = await pickTemplate(final ? "media_nudge_final" : "media_reminder", row.phone_e164, fallbackId);
  const rawProduct = (row.device_name ?? "").trim() || String(cfg.product_fallback ?? "המוצר שברשותך");
  const product = pick.translated ? await translateValue(rawProduct, pick.lang) : rawProduct;
  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-send-secret": SEND_SECRET },
      body: JSON.stringify({
        kind: "template",
        phoneE164: row.phone_e164,
        templateId: pick.templateId,
        variables: [{ name: "product", value: product }],
        triggeredBy: `media-request-nudge-${row.step}${pick.translated ? `:${pick.lang}` : ""}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      return {
        ok: false,
        error: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
        retryable: body?.retryable === true,
        paused: isPausedResponse(res.status, body),
      };
    }
    return { ok: true };
  } catch (e) {
    // 🔴 נפילת רשת אינה ניסיון חוזר: ייתכן שההודעה יצאה ורק התשובה אבדה.
    return { ok: false, error: String(e).slice(0, 300), retryable: false };
  }
}

async function logRun(r: Record<string, unknown>): Promise<number | null> {
  const { data, error } = await sb.from("media_request_runs").insert({
    trigger: r.trigger ?? null,
    dry_run: r.dry ?? false,
    enqueued: r.enqueued ?? 0,
    due: r.due ?? 0,
    sent: r.sent ?? 0,
    failed: r.failed ?? 0,
    detail: r.detail ?? null,
  }).select("id").single();
  if (error) console.error("media_request_runs insert failed:", error.message);
  return data?.id ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
