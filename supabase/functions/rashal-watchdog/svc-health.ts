// דיווח בריאות הסנכרון מול פריוריטי למרכז השירות בדנה (חוזה הדופק, 11/11/2026).
// הרקע: בבי ספורט ובעוגן הזהר השגיאה נכתבה ליומן של המערכת ואף אחד לא קרא אותה.
// החוזה המלא: ~/Idan-HQ/company/service-center/README.md, פרק "חוזה הדופק".
// הדיווח יוצא מהוואצ'דוג השעתי (sweepSyncRuns), לא מסוף כל ריצה: rashal-sync הוא 1,686 שורות ושער הקוד
// אוסר להוסיף לו לפני פיצול. sync_runs הוא היומן המשותף לכל הזרמים, ולכן סריקה אחת מכסה את כולם.
// המחיר: חסימה נשמעת עד שעה אחרי הריצה הראשונה שנכשלה, ולא מיד.
// החלק הטהור (סיווג, כותרת, דוח, הכרעה מתוך הריצות) נבדק ב-test/svc-health.test.mjs.

export const SVC_SYSTEM = "rashal-dashboard";
// תקלה חולפת מדווחת רק אחרי שלוש ריצות כושלות ברצף (נספר מ-sync_runs).
export const TRANSIENT_THRESHOLD = 3;

type Stream = { check: string; label: string; expectedEveryMinutes: number | null };

// מפתח = שם ה-job ב-sync_runs. job שלא כאן (backfill, probe, ריצות ידניות) לא מדווח.
// expectedEveryMinutes = הפער הגדול בין דיווחים כולל לילה וסופ"ש (כלל 2), לפי cron.job של 11/11, ולא פחות
// משעה כי הסריקה שעתית:
// הליבה: שבת 07:00 עד ראשון 04:00 UTC. איסופים: שישי 10:45 עד ראשון 04:15. מסמכים ורענון: שישי 03:40 עד ראשון.
// כתיבת סטטוס קריאה רצה רק כשיש ממתינים, ולכן בלי ציפייה לקצב (רק כשלים נמדדים).
export const STREAMS: Record<string, Stream> = {
  "pull-core": { check: "sync:priority-core", label: "משיכת הליבה מפריוריטי (הזמנות, קריאות, לקוחות)", expectedEveryMinutes: 1260 },
  "pull-pickups": { check: "sync:priority-pickups", label: "משיכת האיסופים מפריוריטי", expectedEveryMinutes: 2490 },
  "pull-pickup-addresses": { check: "sync:priority-pickup-addresses", label: "משיכת כתובות האיסוף מפריוריטי", expectedEveryMinutes: 2490 },
  "pull-docs": { check: "sync:priority-docs", label: "משיכת החשבוניות והמסמכים מפריוריטי", expectedEveryMinutes: 2880 },
  "refresh-recent": { check: "sync:priority-refresh", label: "הרענון הלילי מפריוריטי", expectedEveryMinutes: 2880 },
  "push-chat": { check: "sync:priority-push", label: "הכתיבה לפריוריטי (צ'אט, הערות, תמונות, טפסים)", expectedEveryMinutes: 60 },
  "call-status-live": { check: "sync:priority-call-status", label: "כתיבת סטטוס הקריאה לפריוריטי", expectedEveryMinutes: null },
};

export type FailureKind = "blocked" | "transient";

// חסימה = הכדור אצל ר.שעל או אצל פריוריטי (סיסמה, טוקן, רישיון, הרשאה). כל השאר חולף עד שיוכח אחרת.
export function classifyFailure(message: string): FailureKind {
  if (/\b401\b|\b403\b|unauthori[sz]ed|not authorized|forbidden|licen[sc]e|password|רישיון|הרשא|סיסמ/i.test(message)) return "blocked";
  return "transient";
}

export type Report = {
  system: string;
  check: string;
  verdict: "ok" | "fail";
  kind: "guard";
  source: "guard";
  expected_every_minutes?: number;
  title?: string;
  detail?: string;
  severity?: "S2";
};

// מה לשלוח על ריצה שהסתיימה. null = לא לשלוח (job לא מנוטר, או תקלה חולפת שעוד לא עברה את הסף).
// הכותרת קבועה לכל זרם וסוג תקלה, כי מרכז השירות מאחד כרטיסים לפי כותרת; הפרטים המשתנים ב-detail.
export function buildReport(job: string, error: string | null, consecutiveFailures: number): Report | null {
  const s = STREAMS[job];
  if (!s) return null;
  const base: Report = { system: SVC_SYSTEM, check: s.check, verdict: "ok", kind: "guard", source: "guard" };
  if (s.expectedEveryMinutes) base.expected_every_minutes = s.expectedEveryMinutes;
  if (!error) return base;
  const kind = classifyFailure(error);
  if (kind === "transient" && consecutiveFailures < TRANSIENT_THRESHOLD) return null;
  const title = kind === "blocked"
    ? `פריוריטי חוסמת את ${s.label} (הרשאה או סיסמה)`
    : `${s.label} נכשלת שוב ושוב`;
  const who = kind === "blocked"
    ? "הכדור אצל ר.שעל או אצל פריוריטי: לא תקלה בקוד. לא לנסות להתחבר שוב ושוב, ניסיונות אימות נועלים את המשתמש."
    : `${consecutiveFailures} ריצות כושלות ברצף. לבדוק אם פריוריטי למטה או שמשהו השתנה אצלנו (sync_runs, sync_events).`;
  return { ...base, verdict: "fail", severity: "S2", title, detail: `${who}\nההודעה המלאה: ${error}` };
}

// לא מפיל את הסנכרון לעולם: בלי טוקן או בכשל רשת, רק נרשם בלוג.
export async function sendReport(report: Report | null): Promise<void> {
  if (!report) return;
  const token = Deno.env.get("SVC_INGEST_TOKEN") || "";
  const url = Deno.env.get("SVC_INGEST_URL") || "https://dana-v3.vercel.app/api/svc/ingest";
  if (!token) {
    console.warn("[svc] SVC_INGEST_TOKEN missing, health report skipped");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn(`[svc] ingest ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.warn("[svc] ingest failed:", e instanceof Error ? e.message : String(e));
  }
}

export type Run = { job: string; status: string; started_at: string; finished_at: string | null; error_summary: string | null };

// הכרעה לזרם אחד מתוך הריצות הגמורות שלו, מהחדשה לישנה. null = אין ריצה חדשה מאז הסריקה הקודמת,
// ואז לא שולחים כלום (ריצה שלא קרתה נתפסת בדנה לפי expected_every_minutes).
export function decideStream(runs: Run[], since: Date): { error: string | null; consecutive: number } | null {
  const done = runs.filter((r) => r.finished_at);
  const latest = done[0];
  if (!latest || new Date(latest.finished_at!).getTime() < since.getTime()) return null;
  if (latest.status === "success") return { error: null, consecutive: 0 };
  let consecutive = 0;
  for (const r of done) { if (r.status === "success") break; consecutive++; }
  return { error: latest.error_summary || `ריצה אחרונה: ${latest.status}, בלי פירוט`, consecutive };
}

type SweepClient = {
  from(t: string): {
    select(c: string): {
      in(k: string, v: string[]): {
        gte(k: string, v: string): { order(k: string, o: { ascending: boolean }): PromiseLike<{ data: Run[] | null; error: { message: string } | null }> };
      };
    };
  };
};

// סריקה אחת לכל הזרמים. החלון 65 דקות (הוואצ'דוג רץ כל שעה), וההיסטוריה יומיים אחורה כדי לספור כשלים רצופים.
export async function sweepSyncRuns(sb: unknown, now: Date): Promise<string> {
  try {
    const since = new Date(now.getTime() - 65 * 60000);
    const { data, error } = await (sb as SweepClient).from("sync_runs")
      .select("job,status,started_at,finished_at,error_summary").in("job", Object.keys(STREAMS))
      .gte("started_at", new Date(now.getTime() - 48 * 3600000).toISOString()).order("started_at", { ascending: false });
    if (error) return `query failed: ${error.message}`;
    const out: string[] = [];
    for (const job of Object.keys(STREAMS)) {
      const d = decideStream((data ?? []).filter((r) => r.job === job), since);
      if (!d) continue;
      const report = buildReport(job, d.error, d.consecutive);
      await sendReport(report);
      out.push(`${job}:${report ? report.verdict : "held"}`);
    }
    return out.join(" ") || "no new runs";
  } catch (e) {
    return `sweep crashed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
