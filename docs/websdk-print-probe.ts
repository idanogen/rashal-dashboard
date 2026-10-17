// 🟡 טיוטה שמורה (15/10/2026): נכתבה להדפסת תעודת משלוח דרך ה-Web SDK, אבל רצה רק עד בדיקת סוג הגישה (טוקן, ולכן בלי כניסה). שלב הכניסה וההדפסה מעולם לא רצו. להחזיר לפונקציה כשיהיה משתמש פריוריטי ייעודי.
// בדיקה חד-פעמית (15/10/2026, מערכת החתימות): האם משתמש ה-API של shaal נכנס גם
// בדלת המסכים (Web SDK) ומדפיס תעודת משלוח כ-PDF של פריוריטי.
// 🔴 ניסיון כניסה אחד בלבד בכל קריאה, ובלי ניסיון חוזר: כשלונות ברצף נועלים את
// המשתמש, ואז כל הסנכרון נעצר. הסיסמה לא יוצאת מהפונקציה בשום צורה.
// אישור עידן: "כן תנסה". למחוק אחרי שהשאלה נענתה.
import priority from "npm:priority-web-sdk@3.0.39";

const SECRET = Deno.env.get("PRIORITY_SYNC_SECRET") ?? "";
const USER = Deno.env.get("PRIORITY_USER") ?? "";
const PASS = Deno.env.get("PRIORITY_PASSWORD") ?? "";

function msg(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return String(o.message ?? o.text ?? JSON.stringify(o)).slice(0, 400);
  }
  return String(e).slice(0, 400);
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-sync-secret") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const docno = String(body.docno ?? "SH2604177");
  const out: Record<string, unknown> = {
    // מה סוג הגישה, בלי לחשוף ערך: טוקן = הסיסמה הקבועה PAT.
    kind: PASS === "PAT" ? "token" : "user",
    user_len: USER.length,
  };
  if (out.kind === "token") {
    out.result = "token: אין משתמש לדלת המסכים, לא נוסתה כניסה";
    return Response.json(out);
  }
  if (body.dryRun) return Response.json(out);

  const steps: unknown[] = [];
  try {
    await priority.login({
      url: "https://p.priority-connect.online/",
      tabulaini: "tabb4ce6.ini",
      language: 1,
      profile: { company: "shaal" },
      appname: "SDK-Sandbox",
      username: USER,
      password: PASS,
      devicename: "",
      appid: "APP001",
      appkey: "",
    });
    out.login = "ok";
  } catch (e) {
    out.login = "failed";
    out.login_error = msg(e);
    return Response.json(out);
  }

  try {
    const form = await priority.formStart("DOCUMENTS_D", () => {}, () => {}, { company: "shaal" }, 0);
    await form.setSearchFilter({
      or: 0, ignorecase: 1,
      QueryValues: [{ field: "DOCNO", fromval: docno, op: "=", sort: 0, isdesc: 0 }],
    });
    const rows = await form.getRows(1);
    const row = (rows as Record<string, Record<string, Record<string, unknown>>>)?.DOCUMENTS_D?.["1"];
    out.row = row ? { DOCNO: row.DOCNO, CDES: row.CDES, STATDES: row.STATDES } : null;
    if (!row || row.DOCNO !== docno) throw new Error("השורה לא נמצאה");
    await form.setActiveRow(1);

    let res: Record<string, unknown> = await form.activateStart("WWWSHOWDOC_D", "P", () => {});
    let url: string | null = null;
    for (let i = 0; i < 12 && res; i++) {
      const type = String(res.type ?? "end");
      const proc = res.proc as Record<string, (...a: unknown[]) => Promise<Record<string, unknown>>>;
      steps.push({ type, formats: (res as { formats?: unknown }).formats });
      if (type === "end") break;
      if (type === "displayUrl") {
        const urls = (res as { Urls?: Array<{ url: string }> | { url: string } }).Urls;
        url = Array.isArray(urls) ? urls[0]?.url ?? null : urls?.url ?? null;
        break;
      }
      if (type === "documentOptions") {
        const formats = ((res as { formats?: Array<{ format: number; selected: number }> }).formats) ?? [];
        const pick = formats.find((f) => f.format === -3) ?? formats.find((f) => f.selected) ?? formats[0];
        res = await proc.documentOptions(1, pick?.format ?? -3, { pdf: 1, word: 0, signature: 0 });
      } else if (type === "reportOptions") {
        const formats = ((res as { formats?: Array<{ format: number; selected: number }> }).formats) ?? [];
        const pick = formats.find((f) => f.selected) ?? formats[0];
        res = await proc.reportOptions(1, pick?.format ?? -1);
      } else if (type === "message") {
        out.proc_message = String((res as { message?: string }).message ?? "");
        res = await proc.message(1);
      } else if (type === "inputOptions") {
        res = await proc.inputOptions(1, 1);
      } else {
        res = await proc.continueProc();
      }
    }
    out.steps = steps;
    out.url = url ? url.replace(/[0-9A-F]{20,}/i, "<id>") : null;
    try { await form.activateEnd(); } catch { /* */ }
    try { await form.endCurrentForm(); } catch { /* */ }

    if (url) {
      // הכתובת נפתחת רק בתוך הסשן (לקח #59). קודם בלי כלום, ובודקים את הבייטים.
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36" } });
      const bytes = new Uint8Array(await r.arrayBuffer());
      const head = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
      out.fetch = { status: r.status, type: r.headers.get("content-type"), size: bytes.length, is_pdf: head === "%PDF-" };
    }
  } catch (e) {
    out.steps = steps;
    out.print_error = msg(e);
  }
  return Response.json(out);
});
