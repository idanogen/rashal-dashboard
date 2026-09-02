// ═══════════════════════════════════════════════════════════════
// דוח מצב כפילויות במייל, לבקשת עידן (01/09/2026)
// ═══════════════════════════════════════════════════════════════
//
// רץ אחרי פירוק הטריגר שסימן כפילויות (20260901_retire_dedup_trigger.sql),
// כדי לראות שהפירוק לא פתח דלת. הדוח עונה על שלוש שאלות, וכולן מגיעות
// מ-`public.duplicate_report()` במסד, כלומר החישוב אינו כאן ואפשר להריץ
// אותו גם ביד ולקבל בדיוק את אותם מספרים.
//
// 🔴 **המייל יוצא תמיד, גם כשהכל נקי.** זו בדיקה שעידן ביקש לראות, ולא
// התראה: דוח שמופיע רק כשיש בעיה אינו מבחין בין "אין בעיה" לבין "הבדיקה
// עצמה מתה", וזו בדיוק התקלה שכבר אכלנו בקרון התזכורות.
//
// 🔴 **והשורה נכתבת רק אחרי שהמייל באמת יצא** (הלקח מ-`alerted_at`
// במנוע הסקרים, 27/08): ניסיון ראשון שנכשל על שולח לא מאומת ב-Resend
// חייב להישאר גלוי ולא להיראות כמו ריצה מוצלחת.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_KEY = () => Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_EMAIL = () => Deno.env.get("ALERT_EMAIL") ?? "idan@ogensolutions.biz";
const ALERT_FROM = () => Deno.env.get("ALERT_FROM") ?? "Ogen Sync <onboarding@resend.dev>";

type Row = Record<string, unknown>;

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

function rows(list: Row[]): string {
  if (!list.length) return "";
  return `<table style="border-collapse:collapse;margin:8px 0 16px;font-size:14px">
    <tr style="background:#f1f5f9">
      <th style="padding:6px 10px;border:1px solid #cbd5e1">מסמך א</th>
      <th style="padding:6px 10px;border:1px solid #cbd5e1">מסמך ב</th>
      <th style="padding:6px 10px;border:1px solid #cbd5e1">לקוח</th>
      <th style="padding:6px 10px;border:1px solid #cbd5e1">תאריך</th>
    </tr>
    ${list.map((r) => `<tr>
      <td style="padding:6px 10px;border:1px solid #cbd5e1"><bdi>${esc(r.doc_a)}</bdi></td>
      <td style="padding:6px 10px;border:1px solid #cbd5e1"><bdi>${esc(r.doc_b)}</bdi></td>
      <td style="padding:6px 10px;border:1px solid #cbd5e1">${esc(r.customer)}</td>
      <td style="padding:6px 10px;border:1px solid #cbd5e1"><bdi>${esc(r.created)}</bdi></td>
    </tr>`).join("")}
  </table>`;
}

function buildHtml(rep: Row): string {
  const nf = rep.new_flags as Row, lg = rep.legacy as Row, sd = rep.same_day_pairs as Row;
  const suspects = (rep.suspects ?? []) as Row[];
  const callPairs = (rep.call_pairs ?? []) as Row[];
  const newFlags = Number(nf.orders) + Number(nf.service_calls);

  const verdict = newFlags > 0
    ? `<p style="background:#fee2e2;border-right:4px solid #dc2626;padding:10px 14px;margin:0 0 16px">
         <b>נוצרו ${newFlags} סימוני כפילות חדשים.</b> הטריגר פורק ב-01/09, ולכן ערך מעל אפס
         אומר שמשהו החזיר אותו או שנוסף כותב חדש. שווה בדיקה מיידית.</p>`
    : suspects.length
    ? `<p style="background:#fef3c7;border-right:4px solid #d97706;padding:10px 14px;margin:0 0 16px">
         <b>${suspects.length} זוגות חשודים ככפילות אמיתית בפריוריטי.</b> אלה שני מסמכים שונים
         לאותו לקוח באותו יום <b>עם סחורה זהה לחלוטין</b>, וזו הקטגוריה היחידה שיש בה חדשות.</p>`
    : `<p style="background:#dcfce7;border-right:4px solid #16a34a;padding:10px 14px;margin:0 0 16px">
         <b>נקי.</b> לא נוצר שום סימון כפילות חדש, ואין ולו זוג אחד של שני מסמכים לאותו לקוח
         באותו יום עם סחורה זהה.</p>`;

  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:760px;margin:0 auto">
    <h2 style="margin:0 0 4px">דוח מצב כפילויות</h2>
    <p style="color:#64748b;margin:0 0 16px;font-size:14px">
      החלון נבדק מ-<bdi>${esc(rep.since)}</bdi> · הופק <bdi>${esc(String(rep.generated_at).slice(0, 16).replace("T", " "))}</bdi> UTC</p>
    ${verdict}
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:18px">
      <tr><td style="padding:6px 12px;border:1px solid #cbd5e1">סימוני כפילות חדשים (הזמנות · קריאות)</td>
          <td style="padding:6px 12px;border:1px solid #cbd5e1"><b><bdi>${esc(nf.orders)} · ${esc(nf.service_calls)}</bdi></b></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #cbd5e1">זוגות של אותו לקוח באותו יום (הזמנות)</td>
          <td style="padding:6px 12px;border:1px solid #cbd5e1"><bdi>${esc(sd.orders)}</bdi></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #cbd5e1">מהם, עם סחורה זהה</td>
          <td style="padding:6px 12px;border:1px solid #cbd5e1"><b><bdi>${esc(sd.orders_same_items)}</bdi></b></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #cbd5e1">קריאות שנפתחו לאותו לקוח בהפרש של עד חמש דקות</td>
          <td style="padding:6px 12px;border:1px solid #cbd5e1"><bdi>${esc(sd.calls)}</bdi></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #cbd5e1">שאריות ה-webhook הישן שעדיין מסומנות</td>
          <td style="padding:6px 12px;border:1px solid #cbd5e1"><bdi>${esc(lg.orders_flagged)} · ${esc(lg.calls_flagged)}</bdi></td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #cbd5e1">מהן, עבודה פתוחה שאין לה מסך</td>
          <td style="padding:6px 12px;border:1px solid #cbd5e1"><b><bdi>${esc(lg.orders_hidden_open)} · ${esc(lg.calls_hidden_open)}</bdi></b></td></tr>
    </table>
    ${suspects.length ? `<h3 style="margin:0 0 4px">חשודים ככפילות אמיתית (סחורה זהה)</h3>${rows(suspects)}` : ""}
    ${callPairs.length ? `<h3 style="margin:0 0 4px">קריאות שנפתחו ברצף לאותו לקוח</h3>${rows(callPairs)}` : ""}
    <p style="color:#64748b;font-size:13px;margin-top:20px">
      רקע: מנגנון הכפילויות פורק ב-<bdi>01/09/2026</bdi> אחרי שנמדד שהוא סימן שני מסמכי פריוריטי
      שונים כאותה הזמנה, וב-<bdi>96%</bdi> מהזוגות הסחורה הייתה שונה לגמרי. הדוח הזה הוא הבדיקה
      שהפירוק לא פתח דלת.</p>
  </div>`;
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const since: string | null = body?.since ?? null;

  const { data, error } = await sb.rpc("duplicate_report", since ? { p_since: since } : {});
  if (error) {
    // 🔴 כשל של הבדיקה עצמה מדוּוח כמו ממצא. בדיקה שנשברת בשקט נראית ירוקה.
    await sendMail("🔴 דוח הכפילויות נכשל", `<div dir="rtl">הפונקציה במסד החזירה שגיאה:<br><code>${esc(error.message)}</code></div>`);
    return json({ ok: false, error: error.message }, 500);
  }

  const rep = data as Row;
  const nf = rep.new_flags as Row;
  const suspects = ((rep.suspects ?? []) as Row[]).length;
  const newFlags = Number(nf.orders) + Number(nf.service_calls);
  const tag = newFlags > 0 ? "🔴 " : suspects > 0 ? "⚠️ " : "✅ ";

  const sent = await sendMail(`${tag}דוח מצב כפילויות · רשעל`, buildHtml(rep));

  // רק עכשיו, ורק אם המייל באמת יצא.
  if (sent) await sb.from("dup_report_runs").insert({ report: rep, emailed: true });

  return json({ ok: true, emailed: sent, new_flags: newFlags, suspects });
});

async function sendMail(subject: string, html: string): Promise<boolean> {
  const key = RESEND_KEY();
  if (!key) { console.error("dup-report: no RESEND_API_KEY"); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: ALERT_FROM(), to: [ALERT_EMAIL()], subject, html }),
  });
  if (!r.ok) console.error("resend failed:", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
