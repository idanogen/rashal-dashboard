// Build "sales by HMO" xlsx from pulled invoice-line JSON files.
// usage: node build.mjs <linesDir> <out.xlsx> [patients.json]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/idanogen/Projects/rashal-dashboard/package.json");
const XLSX = require("xlsx");

const [linesDir, outFile, patientsFile] = process.argv.slice(2);
const patients = patientsFile && fs.existsSync(patientsFile) ? JSON.parse(fs.readFileSync(patientsFile, "utf8")) : {};

const PAYER = {
  "511941213": "כללית",
  "589902279": "מכבי", "589902279-1": "מכבי", "7333247": "מכבי", "46305658": "מכבי", "46261030": "מכבי",
  "589958495": "מאוחדת",
  "589916006": "לאומית",
  "930103742": "משרד הביטחון",
};
const HMO_ORDER = ["כללית", "מכבי", "מאוחדת", "לאומית", "משרד הביטחון", "אחר"];
const HMO_WORDS = /כללית|מכבי|מאוחדת|לאומית|ביטחון|בטחון/;
const EXCLUDED = new Set(["מבוטלת", "טיוטא"]);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// card names another HMO than the payer. "משרד הבריאות"/"שירותים"/empty on the card are not HMOs, so no conflict.
const cardHmo = (c) => /כללית/.test(c) ? "כללית" : /מכבי/.test(c) ? "מכבי" : /מאוחדת/.test(c) ? "מאוחדת" : /לאומית/.test(c) ? "לאומית" : null;
const cardConflict = (payer, card) => { const h = cardHmo(String(card ?? "")); return !!h && ["כללית", "מכבי", "מאוחדת", "לאומית"].includes(payer) && h !== payer; };

const files = fs.readdirSync(linesDir).filter((f) => f.endsWith(".json")).sort();
const detail = [], control = [], unmapped = new Map(), excluded = {}, headTotals = {};
const fileStats = [];

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(linesDir, f), "utf8"));
  const docType = data.entity === "CINVOICES" ? "חשבונית מרכזת" : "חשבונית מס";
  fileStats.push({ "קובץ": f, "מסמכים": data.count, "תקרה": data.count >= 2000 ? "כן, לפצל" : "לא" });
  for (const iv of data.invoices) {
    const ivnum = String(iv.IVNUM ?? "");
    if (EXCLUDED.has(iv.STATDES) || /^T\d/.test(ivnum)) { excluded[iv.STATDES ?? "?"] = (excluded[iv.STATDES ?? "?"] ?? 0) + 1; continue; }
    const cust = String(iv.CUSTNAME ?? "");
    const hmo = PAYER[cust] ?? "אחר";
    if (hmo === "אחר" && HMO_WORDS.test(String(iv.CDES ?? ""))) unmapped.set(cust, iv.CDES);
    const headNet = r2(Number(iv.TOTPRICE) - Number(iv.VAT));
    const lineSum = r2(iv.lines.reduce((s, l) => s + Number(l.QPRICE ?? 0), 0));
    // credit docs may carry positive lines under a negative header
    const sign = headNet < 0 && lineSum > 0 ? -1 : 1;
    const diff = r2(headNet - sign * lineSum);
    headTotals[hmo] = r2((headTotals[hmo] ?? 0) + headNet);
    if (Math.abs(diff) > 1 || iv.lines.length === 0) {
      control.push({ "חשבונית": ivnum, "סוג": docType, "קופה": hmo, "משלם": iv.CDES, "תאריך": String(iv.IVDATE).slice(0, 10),
        "לפני מע\"מ בכותרת": headNet, "סכום השורות": r2(sign * lineSum), "הפרש": diff, "שורות": iv.lines.length });
    }
    for (const l of iv.lines) {
      const sku = String(l.PARTNAME ?? "").trim();
      const noSku = !sku || sku === "*";
      const src = String(l.DOCNO ?? iv.DOCNO ?? "");
      const p = patients[src] ?? {};
      detail.push({
        "קופה": hmo, "משלם": iv.CDES, "מספר משלם": cust, "סוג מסמך": docType, "חשבונית": ivnum,
        "תאריך": String(iv.IVDATE).slice(0, 10), "סטטוס": iv.STATDES, "מקור": l.PRSOURCENAME ?? "", "מסמך מקור": src,
        "מטופל": p.name ?? "", "מספר מטופל": p.number ?? "", "קופה בכרטיס המטופל": p.card_hmo ?? "",
        "כרטיס סותר את המשלם": cardConflict(hmo, p.card_hmo) ? "כן" : "",
        "מק\"ט": noSku ? "ללא מק\"ט" : sku, "תיאור": l.PDES ?? "", "כמות": sign * Number(l.TQUANT ?? 0), "יחידה": l.TUNITNAME ?? "",
        "מחיר יחידה לפני מע\"מ": r2(l.PRICE), "הנחה %": Number(l.PERCENT ?? 0),
        "סה\"כ לפני מע\"מ": r2(sign * Number(l.QPRICE ?? 0)), "סה\"כ כולל מע\"מ": r2(sign * Number(l.TOTPRICE ?? 0)),
        "הזמנה": l.ORDNAME ?? "", "PO קופה": l.ORDREFERENCE ?? "", "חשבון הכנסה": l.ACCDES ?? "",
      });
    }
  }
}

function skuSummary(rows) {
  const m = new Map();
  for (const d of rows) {
    const key = d["מק\"ט"] === "ללא מק\"ט" ? `*|${d["תיאור"]}` : d["מק\"ט"];
    const g = m.get(key) ?? { sku: d["מק\"ט"], desc: d["תיאור"], qty: 0, net: 0, min: Infinity, max: -Infinity, ivs: new Set() };
    g.qty += d["כמות"]; g.net += d["סה\"כ לפני מע\"מ"]; g.ivs.add(d["חשבונית"]);
    if (d["כמות"] > 0) { g.min = Math.min(g.min, d["מחיר יחידה לפני מע\"מ"]); g.max = Math.max(g.max, d["מחיר יחידה לפני מע\"מ"]); }
    m.set(key, g);
  }
  return [...m.values()].sort((a, b) => (a.sku === "ללא מק\"ט") - (b.sku === "ללא מק\"ט") || b.net - a.net).map((g) => ({
    "מק\"ט": g.sku, "תיאור": g.desc, "כמות": r2(g.qty), "מחיר ממוצע ליחידה": g.qty ? r2(g.net / g.qty) : 0,
    "מחיר מינימלי": Number.isFinite(g.min) ? g.min : "", "מחיר מקסימלי": Number.isFinite(g.max) ? g.max : "",
    "סה\"כ לפני מע\"מ": r2(g.net), "מספר חשבוניות": g.ivs.size,
  }));
}

const summary = HMO_ORDER.map((h) => {
  const rows = detail.filter((d) => d["קופה"] === h);
  const net = r2(rows.reduce((s, d) => s + d["סה\"כ לפני מע\"מ"], 0));
  const noSku = r2(rows.filter((d) => d["מק\"ט"] === "ללא מק\"ט").reduce((s, d) => s + d["סה\"כ לפני מע\"מ"], 0));
  return { "קופה": h, "חשבוניות": new Set(rows.map((d) => d["חשבונית"])).size, "שורות": rows.length,
    "מק\"טים שונים": new Set(rows.filter((d) => d["מק\"ט"] !== "ללא מק\"ט").map((d) => d["מק\"ט"])).size,
    "סה\"כ שורות לפני מע\"מ": net, "מתוכו בלי מק\"ט": noSku, "% בלי מק\"ט": net ? r2((noSku / net) * 100) : 0,
    "הנחה ברמת חשבונית": r2((headTotals[h] ?? 0) - net), "סה\"כ לפי כותרות החשבוניות": r2(headTotals[h] ?? 0) };
});

const wb = XLSX.utils.book_new();
wb.Workbook = { Views: [{ RTL: true }] };
function add(name, rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "אין שורות" }]);
  if (rows.length) ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!cols"] = Object.keys(rows[0] ?? { a: 1 }).map((k) => ({ wch: widths?.[k] ?? Math.max(10, Math.min(45, k.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}
add("סיכום", summary);
for (const h of HMO_ORDER) add(h, skuSummary(detail.filter((d) => d["קופה"] === h)), { "תיאור": 50, "מק\"ט": 18 });
add("פירוט שורות", detail, { "תיאור": 45, "משלם": 28 });
add("בקרה", [
  ...fileStats,
  { "קובץ": "מסמכים שהוצאו", "מסמכים": Object.entries(excluded).map(([k, v]) => `${k}: ${v}`).join(" · ") },
  { "קובץ": "משלמים שנראים כקופה ולא ממופים", "מסמכים": [...unmapped].map(([k, v]) => `${k} ${v}`).join(" · ") || "אין" },
  { "קובץ": "שורות שבהן כרטיס המטופל אומר קופה אחרת מהמשלם (עמודה בפירוט)", "מסמכים": detail.filter((d) => d["כרטיס סותר את המשלם"]).length },
  { "קובץ": "חשבוניות שהשורות לא מסתכמות לכותרת (מעל 1 ש\"ח), בעיקר הנחה ברמת חשבונית", "מסמכים": control.length },
  ...control,
]);
XLSX.writeFile(wb, outFile, { compression: true });
console.log(JSON.stringify({ files: files.length, detail: detail.length, summary, excluded, unmapped: [...unmapped], mismatches: control.length }, null, 1));
