// rashal-on-way — "הנהג בדרך אליך".
// מוקפץ מהטריגר על סגירת עצירה (מיידי) ומקרון מטאטא כל 5 דקות.
//
// כל ההיגיון יושב במסד (on_way_claim): העצירה הבאה של הנהג, הודעה אחת
// לעצירה, התיישנות 20 דקות, מוקדם-מדי מול חלון התיאום, ושעות העבודה.
// כאן רק השליחה, דרך /api/heyy-send הקיים (מושתקים, 429, לוג).
//
// ⚠ המתג במסד (on_way_settings.enabled / dry_run). כיבוי = UPDATE אחד.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Candidate {
  event_id: number;
  next_stop_id: string;
  customer_name: string | null;
  phone_e164: string;
  worker: string;
  resolved_stop_id: string;
  /** שם העובד והטלפון שלו מטבלת הצוות (בקשת שלומי, 31/08/2026). */
  worker_name: string | null;
  worker_phone: string | null;
}

Deno.serve(async (req: Request) => {
  let trigger = "manual";
  try {
    const b = await req.json();
    if (b?.trigger) trigger = String(b.trigger);
  } catch { /* ברירת מחדל */ }

  const { data: cfg, error: cfgErr } = await sb
    .from("on_way_settings").select("*").eq("id", true).single();
  if (cfgErr || !cfg) {
    return json({ ok: false, error: `settings unavailable: ${cfgErr?.message}` }, 500);
  }

  if (!cfg.enabled) {
    // כבוי = האירועים נשארים ומתיישנים מעצמם (20 דקות). אין תור נסתר.
    return json({ ok: true, enabled: false });
  }

  const dry = Boolean(cfg.dry_run);
  const { data, error } = await sb.rpc("on_way_claim", { p_dry: dry, p_limit: 20 });
  if (error) {
    await logRun({ trigger, dry, detail: { claim_error: error.message } });
    return json({ ok: false, error: error.message }, 500);
  }
  const candidates = (data ?? []) as Candidate[];

  let sent = 0, failed = 0;
  const detail: Record<string, unknown> = {};

  if (dry) {
    detail.would_send = candidates.map((c) => ({
      name: c.customer_name, phone: c.phone_e164, worker: c.worker,
      worker_name: c.worker_name, worker_phone: c.worker_phone,
      template: cfg.template_v2_id && c.worker_phone ? "v2" : "v1",
    }));
  } else {
    for (const c of candidates) {
      const res = await sendOne(c, String(cfg.template_id ?? ""), String(cfg.template_v2_id ?? ""));
      if (res.ok) {
        sent++;
        await sb.rpc("on_way_mark_sent", {
          p_event: c.event_id,
          p_stop: c.next_stop_id,
          p_phone: c.phone_e164,
          p_name: c.customer_name,
          p_resolved: c.resolved_stop_id,
        });
      } else if (res.retryable) {
        // מכסת קצב: האירוע חוזר לתור, וההתיישנות (20 דקות) היא הגבול.
        await sb.from("on_way_events")
          .update({ processed_at: null, result: null })
          .eq("id", c.event_id);
      } else {
        failed++;
        await sb.from("on_way_events")
          .update({ result: "failed: " + res.error.slice(0, 200) })
          .eq("id", c.event_id);
      }
    }
  }

  const runId = await logRun({
    trigger, dry, events: candidates.length, sent, failed, detail,
  });
  return json({ ok: true, run_id: runId, dry, candidates: candidates.length, sent, failed, detail });
});

async function sendOne(
  c: Candidate,
  templateId: string,
  templateV2Id: string,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  // התבנית עם שם וטלפון של העובד, רק כשהיא מחווטת (=אושרה במטא) ויש
  // לעובד טלפון בטבלת הצוות. אחרת נסיגה שקטה לנוסח הישן, בלי הודעת חור.
  const useV2 = Boolean(templateV2Id && c.worker_phone && c.worker_name);
  const chosen = useV2 ? templateV2Id : templateId;
  if (!chosen) return { ok: false, error: "no template id", retryable: false };
  const variables = [
    { name: "name", value: c.customer_name ?? "" },
    { name: "worker", value: c.worker },
    ...(useV2
      ? [
          { name: "worker_name", value: c.worker_name ?? "" },
          { name: "worker_phone", value: c.worker_phone ?? "" },
        ]
      : []),
  ];
  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-send-secret": SEND_SECRET },
      body: JSON.stringify({
        kind: "template",
        phoneE164: c.phone_e164,
        templateId: chosen,
        variables,
        triggeredBy: "on-way-engine",
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
    // נפילת רשת אינה ניסיון חוזר: ייתכן שההודעה יצאה. כפילות גרועה מחוסר.
    return { ok: false, error: String(e).slice(0, 300), retryable: false };
  }
}

async function logRun(r: Record<string, unknown>): Promise<number | null> {
  const { data, error } = await sb.from("on_way_runs").insert({
    trigger: r.trigger ?? null,
    dry_run: r.dry ?? false,
    events: r.events ?? 0,
    sent: r.sent ?? 0,
    failed: r.failed ?? 0,
    detail: r.detail ?? null,
  }).select("id").single();
  if (error) console.error("on_way_runs insert failed:", error.message);
  return data?.id ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
