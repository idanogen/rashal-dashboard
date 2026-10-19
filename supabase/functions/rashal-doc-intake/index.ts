// ─── קליטת מסמכים מהמייל של פריוריטי (18/10/2026) ────────────────────
//
// חוק עסקי 1172 בפריוריטי שולח על כל שינוי סטטוס מייל עם ה-PDF, בנושא
// "<מספר מסמך>*<סטטוס>", אל rashal-docs@intake.ogensolutions.biz. הוא יורה
// גם על תעודות משלוח (SH) וגם על קריאות שירות (SC, מ-19/10 נקלטות גם הן:
// עידן, "גם קריאות שירות וגם משלוחים ללקוח אלה דברים שאנחנו רוצים להציג
// לנהגים ב-PDF"). תיבת הקליטה ב-AWS (~/Idan-HQ/company/intake-mailbox,
// הלמדה ogen-intake-forward) מפענחת את ה-PDF, מרנדרת כל עמוד ל-PNG, מוצאת
// בו את מקומות החתימה, ושולחת הכל לכאן. כאן: שמירה בדלי הפרטי של הסוג
// (SH → delivery-note-docs, SC → service-call-docs) תחת `<מספר>/`, ושורה
// בטבלה של הסוג (delivery_note_docs / service_call_docs).
//
// 🔴 נפרסת עם --no-verify-jwt: הלמדה לא מחזיקה JWT של סופבייס. השער הוא
// הסוד המשותף בכותרת x-intake-secret (DOC_INTAKE_SECRET כאן, וגם בלמדה).
//   supabase functions deploy rashal-doc-intake --no-verify-jwt
//
// ⭐ אידמפוטנטי לפי מפתח המייל: שליחה חוזרת של אותו מייל (השלמה אחורה,
// ניסיון חוזר של הלמדה) מחליפה את אותה שורה ואת אותם קבצים.
// 🔴 נושא אחר (החוק שולח על אותו מעבר גם מייל עם מספר ההזמנה, SO...)
// לא נשמר: מחזירים skipped, והמייל נשאר בתיבה הגולמית כמו כל מייל.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** לכל סוג מסמך: הדלי והטבלה שלו. */
export const DOC_KINDS = {
  SH: { bucket: "delivery-note-docs", table: "delivery_note_docs" },
  SC: { bucket: "service-call-docs", table: "service_call_docs" },
} as const;

interface Body {
  key?: string;
  subject?: string;
  received_at?: string;
  pdf_b64?: string;
  pages?: string[];
  page_size?: { w: number; h: number } | null;
  anchors?: Record<string, unknown> | null;
  doc_date?: string | null;
  pdf_status?: string | null;
  customer_number?: string | null;
  order_numbers?: string[];
}

/** "SH2604194*סופית" / "SC2603758*לביצוע" → { docno, status, kind }. נושא אחר → null. */
export function parseSubject(
  subject: string,
): { docno: string; status: string | null; kind: keyof typeof DOC_KINDS } | null {
  const m = subject.trim().match(/^((?:SH|SC)\d{5,20})\s*(?:\*\s*(.*))?$/i);
  if (!m) return null;
  const docno = m[1].toUpperCase();
  return { docno, status: m[2]?.trim() || null, kind: docno.slice(0, 2) as keyof typeof DOC_KINDS };
}

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("DOC_INTAKE_SECRET") ?? "";
  if (!secret || req.headers.get("x-intake-secret") !== secret) return json({ ok: false, error: "forbidden" }, 403);
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const b = (await req.json().catch(() => ({}))) as Body;
  const key = (b.key ?? "").trim();
  if (!/^raw\/[A-Za-z0-9]+$/.test(key)) return json({ ok: false, error: "bad key" }, 400);

  const parsed = parseSubject(b.subject ?? "");
  if (!parsed) return json({ ok: true, skipped: "subject", subject: b.subject ?? "" });
  if (!b.pdf_b64) return json({ ok: false, error: "no pdf" }, 400);

  const { bucket, table } = DOC_KINDS[parsed.kind];
  const id = key.slice(4);
  const dir = `${parsed.docno}/${id}`;
  const up = async (path: string, data: Uint8Array, type: string) => {
    const { error } = await sb.storage.from(bucket).upload(path, data, { contentType: type, upsert: true });
    if (error) throw new Error(`${path}: ${error.message}`);
  };

  try {
    await up(`${dir}.pdf`, bytes(b.pdf_b64), "application/pdf");
    const pagePaths: string[] = [];
    for (const [i, png] of (b.pages ?? []).entries()) {
      const p = `${dir}-p${i + 1}.png`;
      await up(p, bytes(png), "image/png");
      pagePaths.push(p);
    }

    const row: Record<string, unknown> = {
      mail_key: key,
      docno: parsed.docno,
      // הסטטוס מהנושא. מייל בלי סטטוס בנושא (נשלחו לפני שהחוק הוסיף אותו):
      // מהכותרת של ה-PDF, שם מודפס למשל "מבוטלת".
      status: parsed.status ?? b.pdf_status ?? null,
      subject: b.subject,
      received_at: b.received_at ?? new Date().toISOString(),
      doc_date: b.doc_date || null,
      customer_number: b.customer_number || null,
      pdf_path: `${dir}.pdf`,
      page_paths: pagePaths,
      page_size: b.page_size ?? null,
      anchors: b.anchors ?? null,
    };
    // מספרי הזמנה יש רק בתעודת משלוח (ולטבלת הקריאות אין את העמודה).
    if (parsed.kind === "SH") {
      row.order_numbers = (b.order_numbers ?? []).filter((s) => /^SO\d+$/i.test(s));
    }
    const { error } = await sb.from(table).upsert(row, { onConflict: "mail_key" });
    if (error) throw new Error(error.message);

    return json({ ok: true, docno: parsed.docno, status: parsed.status ?? b.pdf_status ?? null, pages: pagePaths.length });
  } catch (e) {
    console.error("[doc-intake]", key, (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
