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
import { buildAlertMail, shouldAlert, type SurveyAnswer } from "./low-rating.ts";

const SEND_URL = "https://rashal-dashboard.vercel.app/api/heyy-send";

// 🔴 `api/heyy-send` נפרס בזמנו **בלי אימות בכלל**, וכל מי שהחזיק את הכתובת
// יכול היה לשלוח וואטסאפ מהמספר הרשמי של הלקוח על חשבון עוגן. נסגר 22/08/2026.
// מנוע הסקרים הוא קורא מכונתי ואין לו משתמש מחובר, ולכן הוא מזדהה בסוד משותף,
// באותו דפוס בדיוק של `PRIORITY_SYNC_SECRET`.
// ⭐ הסוד יושב בסודות של הפונקציה ולעולם לא בקוד.
const SEND_SECRET = Deno.env.get("RASHAL_SEND_SECRET") ?? "";

// ⭐ אותו ערוץ התרעה בדיוק שהשומר משתמש בו, ולכן אין כאן סוד חדש ולא
// הגדרה חדשה. הוא נבדק חי ב-26/08 והוציא מייל אמיתי.
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// 🔴 **אותה ברירת מחדל בדיוק של השומר**, ולא כתובת "יפה" יותר.
// הניסיון הראשון יצא מ-alerts@ogensolutions.biz ו-Resend החזירה
// `403 The ogensolutions.biz domain is not verified`. השולח היחיד
// שמותר בלי אימות דומיין הוא זה, והוא מגיע לבעל החשבון בלבד.
// ⭐ להוספת עמי או שלומי כנמענים צריך לאמת את הדומיין ב-Resend.
const ALERT_FROM = Deno.env.get("ALERT_FROM") ?? "Ogen Sync <onboarding@resend.dev>";
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL") ?? "idan@ogensolutions.biz";
// התראת דירוג נמוך היא אות ללקוח-פנים (שלומי/עמי/רונן ברשעל) ולא התראת
// תפעול, ולכן רשימת נמענים נפרדת: SURVEY_ALERT_EMAIL. בלעדיה נופלים
// ל-ALERT_EMAIL, כדי שההתראה לעולם לא תישאר בלי נמען.
const SURVEY_ALERT_EMAIL = Deno.env.get("SURVEY_ALERT_EMAIL") ?? ALERT_EMAIL;
const SURVEYS_URL = "https://rashal-dashboard.vercel.app/surveys";

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
  let sent = 0, failed = 0, requeued = 0;
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
      } else if (res.retryable) {
        // 🔴🔴 **מכסת קצב אינה דחייה, וסימונה ככישלון מאבד את הסקר לתמיד.**
        // heyy מגבילה ל-100 בקשות לדקה לכל החשבון, ולכן דווקא בשעה עמוסה,
        // כשיש הרבה מה לשלוח, ההודעות מעבר לגבול היו נמחקות מהתור ואיש לא
        // היה מנסה אותן שוב. כאן הן חוזרות ל-pending, והריצה הבאה
        // (כל רבע שעה) לוקחת אותן. ⭐ `sent_at` נשאר ריק, ולכן שום הגנה
        // אחרת לא חושבת שההודעה כבר יצאה.
        requeued++;
        await sb.from("customer_surveys").update({
          status: "pending",
          send_error: res.error.slice(0, 500),
          send_claimed_at: null,
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
    if (requeued) detail.requeued_rate_limited = requeued;
  }

  // ─── שלב 3: התרעה על ציון נמוך ──────────────────────────────────────
  //
  // ⭐ **פנימית בלבד.** שלומי ביקש הודעה ללקוח, ומדידה לפני הבנייה הראתה
  // ששלושה מתוך שלושה שנתנו ציון נמוך **כבר כתבו הערה**, ושהלקוחה
  // האמיתית היחידה נתנה 1 וכתבה מחמאה. לכן קודם אדם, ורק אחר כך הודעה.
  //
  // 🔴 **רץ גם במצב יבש.** מצב יבש נועד לא לשלוח ללקוח; התרעה פנימית
  // לצוות היא בדיוק מה שצריך לצאת גם כשהמנוע כבוי, אחרת ציון נמוך
  // בתקופת ההרצה לא יגיע לאיש.
  const alerted = await alertOnLowRatings();
  if (alerted.length) detail.low_rating_alerts = alerted;

  const runId = await logRun({
    trigger, dry, enqueued: enqueuedRows.length, due: due.length, sent, failed, detail,
  });

  return json({
    ok: true, run_id: runId, dry, window_open: windowOpen,
    enqueued: enqueuedRows.length, due: due.length, sent, failed, requeued,
    low_rating_alerts: alerted.length,
    detail,
  });
});

/**
 * מוצא חוות דעת עם ציון נמוך שטרם התריעו עליהן, ושולח מייל אחד לכל אחת.
 *
 * 🔴 **הסימון נכתב רק אחרי שהמייל יצא**, ולכן כשל בשליחה מחזיר את השורה
 * לניסיון הבא במקום לבלוע אותה. [[silent_failure_needs_a_watchdog]]
 *
 * 🔴 **ומסונן ב-`is_test`**: שתיים משלוש התוצאות הנמוכות שהיו עד היום הן
 * בדיקות פנימיות, וההתרעה הראשונה שהצוות היה מקבל הייתה על עצמו.
 */
async function alertOnLowRatings(): Promise<string[]> {
  const { data, error } = await sb
    .from("customer_surveys")
    .select("id, customer_name, driver, q1_satisfaction, q2_recommend, comment, answered_at, is_test, alerted_at")
    .not("answered_at", "is", null)
    .is("alerted_at", null)
    .lte("q1_satisfaction", 2)
    .order("answered_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("low-rating lookup failed:", error.message);
    return [];
  }

  const done: string[] = [];
  for (const r of data ?? []) {
    const answer: SurveyAnswer = {
      id: r.id,
      customerName: r.customer_name,
      driver: r.driver,
      q1: r.q1_satisfaction,
      q2: r.q2_recommend,
      comment: r.comment,
      answeredAt: r.answered_at,
      isTest: r.is_test,
      alertedAt: r.alerted_at,
    };
    const decision = shouldAlert(answer);
    if (!decision.alert) {
      // ⭐ רשומת בדיקה מסומנת כמטופלת, אחרת היא נבדקת מחדש בכל ריצה לנצח.
      if (decision.reason === "test_row") {
        await sb.from("customer_surveys")
          .update({ alerted_at: new Date().toISOString() }).eq("id", r.id);
      }
      continue;
    }

    const mail = buildAlertMail(answer, SURVEYS_URL);
    if (!(await sendAlertMail(mail.subject, mail.html))) continue;

    await sb.from("customer_surveys")
      .update({ alerted_at: new Date().toISOString() }).eq("id", r.id);
    done.push(r.id);
  }
  return done;
}

async function sendAlertMail(subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) {
    console.error("no RESEND_API_KEY, low-rating alert not sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ALERT_FROM,
        // ⭐ רשימה מופרדת בפסיקים, כדי שהוספת עמי או שלומי היא שינוי
        // משתנה סביבה ולא שינוי קוד.
        to: SURVEY_ALERT_EMAIL.split(",").map((x) => x.trim()).filter(Boolean),
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("resend failed:", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("resend threw:", String(e).slice(0, 200));
    return false;
  }
}

async function sendOne(
  row: DueRow,
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
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
      return {
        ok: false,
        error: `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
        // ⭐ הדגל מהשרת, לא ניחוש מקוד הסטטוס: `/api/heyy-send` מחזיר 429
        // גם על צינון פנימי שלנו, וזה מצב אחר לגמרי מחריגה ממכסת heyy.
        retryable: body?.retryable === true,
      };
    }
    return { ok: true };
  } catch (e) {
    // 🔴 נפילת רשת אינה ניסיון חוזר אוטומטי: ייתכן שההודעה כן יצאה
    // ורק התשובה אבדה, וסקר כפול ללקוח גרוע מסקר חסר.
    return { ok: false, error: String(e).slice(0, 300), retryable: false };
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
