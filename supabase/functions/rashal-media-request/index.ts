// rashal-media-request — מנוע "תמונה לפני טכנאי".
// רץ כל 15 דקות מ-pg_cron (job `rashal-media-requests`).
//
// שלושה שלבים בריצה אחת:
//   1. תור    — media_request_enqueue() מכניס קריאות שהגיעו ל"לביצוע".
//   2. שליחה  — media_claim_due() תופס ראשונות ותזכורות שהגיע זמנן,
//               וההודעה יוצאת דרך /api/heyy-send הקיים (מושתקים, 429, לוג).
//   3. תחזוקה — ביטולים, פגי תוקף ו"אין מענה" נעשים בתוך ה-claim במסד.
//
// ⚠ המתג במסד (media_request_settings.enabled / dry_run), לא כאן ולא ב-env.
// 🔴 מצב יבש מחשב את אותו דבר בדיוק ולא שולח, מאותן שאילתות.
// 🔴 בלי מזהי תבניות (עד אישור מטא) שום דבר לא נתפס מהתור: תפיסה בלי
//    יכולת שליחה הייתה משאירה שורות claimed תקועות.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  device_name: string | null;
}

Deno.serve(async (req: Request) => {
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
      const res = await sendOne(row, cfg);
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

  const runId = await logRun({
    trigger, dry, enqueued: enqueuedRows.length, due: due.length, sent, failed, detail,
  });

  return json({
    ok: true, run_id: runId, dry, window_open: windowOpen, templates_ready: templatesReady,
    enqueued: enqueuedRows.length, due: due.length, sent, failed, requeued, detail,
  });
});

async function sendOne(
  row: DueRow,
  cfg: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  const product = (row.device_name ?? "").trim() || String(cfg.product_fallback ?? "המוצר שברשותך");
  const templateId = row.stage === "first"
    ? String(cfg.template_first_id)
    : String(cfg.template_reminder_id);
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
        triggeredBy: `media-request-${row.stage}`,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      return {
        ok: false,
        error: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
        retryable: body?.retryable === true,
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
