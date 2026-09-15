// rashal-invoice-lines: משיכה חד פעמית של שורות חשבוניות לדוח "מה נמכר לאיזו קופה" (15/09/2026).
// קריאה בלבד מפריוריטי. לא כותבת למסד ולא לפריוריטי, רק מחזירה JSON רזה לקורא.
// הפעלה: POST {"entity":"CINVOICES"|"AINVOICES","from":"2026-01-01","to":"2026-02-01"} עם x-sync-secret.
// 🔴 חלון קצר (חודש) בגלל תקרת 2,000 השורות לבקשה. תוצאה של בדיוק 2,000 = capped:true, לפצל.
// 🔴 ב-AINVOICES אין $select על הכותרת: $select + $expand שם מחזיר JSON קטוע (לקח ידוע).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const PRIORITY = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const UA = "OgenSync/1.0";
const syncSecret = () => Deno.env.get("PRIORITY_SYNC_SECRET") ?? "";
const basicAuth = () =>
  "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);

type Row = Record<string, unknown>;

const HEAD = ["IVNUM", "CUSTNAME", "CDES", "IVDATE", "DOCNO", "STATDES", "DEBIT", "IVTYPE", "TOTPRICE", "VAT", "FINAL"];
const LINE = ["KLINE", "PARTNAME", "PDES", "TQUANT", "TUNITNAME", "PRICE", "PERCENT", "QPRICE", "TOTPRICE", "IVTAX",
  "PRSOURCENAME", "DOCNO", "ORDNAME", "ORDREFERENCE", "ACCNAME", "ACCDES"];

const pick = (r: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => k in r).map((k) => [k, r[k]]));
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (!syncSecret() || (req.headers.get("x-sync-secret") ?? "") !== syncSecret()) return json({ error: "bad secret" }, 401);

  let body: Row = {};
  try { body = await req.json(); } catch { /* validated below */ }

  // מצב patients: מסמך מקור (SH/SC) → מטופל וקופה בכרטיס שלו, מהמסד שלנו בלבד. בלי פריוריטי.
  if (body.mode === "patients") {
    const all = async (table: string, cols: string, like: string, key: string) => {
      const out: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from(table).select(cols).like(key, like).range(from, from + 999);
        if (error) throw new Error(`${table}: ${error.message}`);
        out.push(...(data as Row[]));
        if (!data || data.length < 1000) return out;
      }
    };
    try {
      const dn = await all("delivery_notes", "priority_doc_id,customer_number,customer_name", "SH2%", "priority_doc_id");
      const sc = await all("service_calls", "priority_call_id,customer_number,customer_name", "SC2%", "priority_call_id");
      const map: Record<string, { number: string; name: string; card_hmo?: string }> = {};
      for (const r of dn) map[String(r.priority_doc_id)] = { number: String(r.customer_number ?? ""), name: String(r.customer_name ?? "") };
      for (const r of sc) map[String(r.priority_call_id)] ??= { number: String(r.customer_number ?? ""), name: String(r.customer_name ?? "") };
      const nums = [...new Set(Object.values(map).map((v) => v.number).filter(Boolean))];
      const hmo: Record<string, string> = {};
      for (let i = 0; i < nums.length; i += 300) {
        const { data, error } = await sb.from("priority_customers").select("custname,customer_type").in("custname", nums.slice(i, i + 300));
        if (error) throw new Error(`priority_customers: ${error.message}`);
        for (const r of data as Row[]) hmo[String(r.custname)] = String(r.customer_type ?? "");
      }
      for (const v of Object.values(map)) v.card_hmo = hmo[v.number] ?? "";
      const path = "invoice-lines/patients.json";
      const up = await sb.storage.from("exports").upload(path, new Blob([JSON.stringify(map)], { type: "application/json" }), { upsert: true });
      if (up.error) return json({ error: "upload", detail: up.error.message }, 500);
      const signed = await sb.storage.from("exports").createSignedUrl(path, 3600);
      return json({ mode: "patients", delivery_notes: dn.length, service_calls: sc.length, docs: Object.keys(map).length, url: signed.data?.signedUrl ?? null });
    } catch (e) { return json({ error: "patients", detail: String(e).slice(0, 300) }, 500); }
  }
  const entity = String(body.entity ?? "");
  const from = String(body.from ?? "");
  const to = String(body.to ?? "");
  if (!["CINVOICES", "AINVOICES"].includes(entity)) return json({ error: "entity" }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ error: "dates" }, 400);

  const sub = entity === "CINVOICES" ? "CINVOICEITEMS_SUBFORM" : "AINVOICEITEMS_SUBFORM";
  const filter = `IVDATE ge ${from}T00:00:00Z and IVDATE lt ${to}T00:00:00Z`;
  const url = `${PRIORITY}/${entity}?` +
    (entity === "CINVOICES" ? `$select=${HEAD.join(",")}&` : "") +
    `$filter=${encodeURIComponent(filter)}&$expand=${sub}&$top=2000`;
  const auth = { headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" } };

  // עד 3 ניסיונות עם המתנה, פריוריטי קונקט מנתק חלק מהקריאות (לקח #22). 401/403 עוצרים מיד.
  let last = "";
  for (const wait of [0, 3000, 8000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(url, auth);
      const text = await res.text();
      if (res.status === 401 || res.status === 403) return json({ error: `HTTP ${res.status}`, detail: text.slice(0, 300) }, 502);
      if (!res.ok) { last = `HTTP ${res.status}: ${text.slice(0, 300)}`; continue; }
      const rows = (JSON.parse(text)?.value ?? []) as Row[];
      const invoices = rows.map((r) => ({
        ...pick(r, HEAD),
        lines: (Array.isArray(r[sub]) ? (r[sub] as Row[]) : []).map((l) => pick(l, LINE)),
      }));
      // הגוף המלא נשמר לדלי פרטי ומוחזר קישור חתום לשעה, כדי שלא יעבור דרך net._http_response.
      const path = `invoice-lines/${entity}-${from}-${to}.json`;
      const payload = JSON.stringify({ entity, from, to, count: invoices.length, invoices });
      const up = await sb.storage.from("exports").upload(path, new Blob([payload], { type: "application/json" }), { upsert: true });
      if (up.error) return json({ error: "upload", detail: up.error.message }, 500);
      const signed = await sb.storage.from("exports").createSignedUrl(path, 3600);
      return json({
        entity, from, to, count: invoices.length, capped: invoices.length >= 2000,
        lines: invoices.reduce((n, i) => n + i.lines.length, 0), url: signed.data?.signedUrl ?? null,
      });
    } catch (e) { last = String(e).slice(0, 300); }
  }
  return json({ error: "failed", detail: last }, 502);
});
