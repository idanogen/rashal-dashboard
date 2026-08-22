// rashal-surveys — מנוע הסקרים. רץ כל 15 דקות מ-pg_cron (job `rashal-surveys`).
//
// שני שלבים בריצה אחת:
//   1. תור   — `survey_enqueue()` מכניס עצירות שנסגרו לתור, אחרי ההגנות.
//   2. שליחה — `survey_claim_due()` תופס את מה שהגיע זמנו, וההודעה יוצאת
//              דרך /api/heyy-send הקיים. אין צינור חדש ואין סוד חדש כאן.
//
// ⚠ המתג יושב במסד (`survey_settings.enabled` / `dry_run`), לא כאן ולא ב-env.
//   כיבוי הוא UPDATE אחד, בלי פריסה ובלי לגעת ב-pg_cron.
//
// 🔴 מצב יבש מחשב בדיוק את אותו דבר ולא שולח. זו אותה שאילתה ואותו קוד,
//    כדי ששתי האמיתות לא יתפצלו (הלקח מ-11/08: מסך שהצהיר "דמו" בזמן
//    שהשרת שלח באמת).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";

// 🔴 `api/heyy-send` נפרס בזמנו **בלי אימות בכלל**, וכל מי שהחזיק את הכתובת
// יכול היה לשלוח וואטסאפ מהמספר הרשמי של הלקוח על חשבון עוגן. נסגר 22/08/2026.
// מנוע הסקרים הוא קורא מכונתי ואין לו משתמש מחובר, ולכן הוא מזדהה בסוד משותף,
// באותו דפוס בדיוק של `PRIORITY_SYNC_SECRET`.
// ⭐ הסוד יושב בסודות של הפונקציה ולעולם לא בקוד.
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface DueRow {
  id: string;
  token: string;
  customer_name: string | null;
  phone_e164: string;
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
    .from("survey_settings").select("*").eq("id", true).single();

  if (cfgErr || !cfg) {
    return json({ ok: false, error: `settings unavailable: ${cfgErr?.message}` }, 500);
  }

  const dry = forceDry ?? cfg.dry_run;

  // אותו שער בדיוק שהשליחה האמיתית עוברת בו, כדי שהדוח היבש לא יבטיח
  // משהו שהשליחה תחסום.
  const { data: winData } = await sb.rpc("survey_window_open");
  const windowOpen = winData === true;

  // כבוי = לא נוגעים בתור בכלל. גם לא בונים אותו, כדי שהדלקה לא תמצא
  // תור שהצטבר בשקט ותשלח אותו בבת אחת.
  if (!cfg.enabled) {
    await logRun({ trigger, dry, detail: { skipped: "engine disabled" } });
    return json({ ok: true, enabled: false, note: "engine disabled" });
  }

  // ── 1. תור ─────────────────────────────────────────────────────────────
  const { data: enqueued, error: enqErr } = await sb.rpc("survey_enqueue", { p_commit: !dry });
  if (enqErr) {
    await logRun({ trigger, dry, detail: { enqueue_error: enqErr.message } });
    return json({ ok: false, error: enqErr.message }, 500);
  }
  const enqueuedRows = (enqueued ?? []) as Array<Record<string, unknown>>;

  // ── 2. שליחה ───────────────────────────────────────────────────────────
  let due: DueRow[] = [];
  let sent = 0, failed = 0;
  const detail: Record<string, unknown> = {
    enqueued: enqueuedRows.map((r) => ({ name: r.customer_name, at: r.scheduled_send_at })),
  };

  if (dry) {
    // קריאה בלבד: לא תופסים, לא מסמנים, ולא שולחים.
    // 🔴 התור לא נכתב במצב יבש, ולכן "מה היה יוצא עכשיו" חייב לאחד שניים:
    //    מה שכבר יושב בתור, ומה שהריצה הזו היתה מכניסה וזמנו כבר עבר.
    //    בלי האיחוד הזה דוח יבש על מנוע שעוד לא רץ מחזיר תמיד אפס, וזו
    //    התשובה שנראית הכי כמו "הכל בסדר".
    const nowIso = new Date().toISOString();
    const { data } = await sb
      .from("customer_surveys")
      .select("id, token, customer_name, phone_e164, scheduled_send_at")
      .eq("status", "pending")
      .lte("scheduled_send_at", nowIso)
      .order("scheduled_send_at")
      .limit(max);
    const inQueue = (data ?? []) as DueRow[];
    const fromThisRun = enqueuedRows.filter((r) => String(r.scheduled_send_at ?? "") <= nowIso);
    due = inQueue;
    detail.would_send = [
      ...inQueue.map((d) => ({ name: d.customer_name, phone: d.phone_e164, src: "queue" })),
      ...fromThisRun.map((r) => ({ name: r.customer_name, phone: r.phone_e164, src: "new" })),
    ].slice(0, max);
    detail.would_send_count = inQueue.length + fromThisRun.length;
    if (!windowOpen) detail.blocked = "מחוץ לחלון השליחה, שום דבר לא היה יוצא עכשיו";
  } else {
    const { data, error } = await sb.rpc("survey_claim_due", { p_limit: max });
    if (error) {
      await logRun({ trigger, dry, enqueued: enqueuedRows.length, detail: { claim_error: error.message } });
      return json({ ok: false, error: error.message }, 500);
    }
    due = (data ?? []) as DueRow[];

    for (const row of due) {
      const res = await sendOne(row, cfg.template_id);
      if (res.ok) {
        sent++;
        await sb.from("customer_surveys").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          send_channel: "template",
          send_error: null,
        }).eq("id", row.id);
      } else {
        failed++;
        await sb.from("customer_surveys").update({
          status: "failed",
          send_error: res.error.slice(0, 500),
          send_claimed_at: null,   // משוחרר לניסיון הבא רק אחרי בדיקה ידנית
        }).eq("id", row.id);
      }
    }
  }

  const runId = await logRun({
    trigger, dry, enqueued: enqueuedRows.length, due: due.length, sent, failed, detail,
  });

  return json({
    ok: true, run_id: runId, dry, window_open: windowOpen,
    enqueued: enqueuedRows.length, due: due.length, sent, failed,
    detail,
  });
});

async function sendOne(row: DueRow, templateId: string): Promise<{ ok: true } | { ok: false; error: string }> {
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
        // 🔴 משתנים **לפי שם**, כמו שהוגדרו בעורך של heyy. `token` נכנס כסיומת
        //    בכתובת של כפתור ה-URL, ולכן הוא הקישור האישי של הלקוח.
        variables: [
          { name: "name", value: row.customer_name ?? "" },
          { name: "token", value: row.token },
        ],
        triggeredBy: "survey-engine",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}

async function logRun(r: Record<string, unknown>): Promise<number | null> {
  const { data, error } = await sb.from("survey_engine_runs").insert({
    trigger: r.trigger ?? null,
    dry_run: r.dry ?? false,
    enqueued: r.enqueued ?? 0,
    due: r.due ?? 0,
    sent: r.sent ?? 0,
    failed: r.failed ?? 0,
    detail: r.detail ?? null,
  }).select("id").single();
  if (error) console.error("survey_engine_runs insert failed:", error.message);
  return data?.id ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
