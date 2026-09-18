// Build "sales by HMO" xlsx from pulled invoice-line JSON files.
// usage: node invoice-lines-by-hmo.mjs <linesDir> <out.xlsx> [patients.json] [--no-patient-ids]
// --no-patient-ids: the version that leaves the house (email). Drops patient name and number, keeps the HMO-conflict flag.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/idanogen/Projects/rashal-dashboard/package.json");
const XLSX = require("xlsx");

const args = process.argv.slice(2);
const noPatientIds = args.includes("--no-patient-ids");
const [linesDir, outFile, patientsFile] = args.filter((a) => !a.startsWith("--"));
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
// per-SKU stats per HMO ("אחר" is not an HMO, so it never counts toward overlap or ownership)
const HMOS = HMO_ORDER.filter((h) => h !== "אחר");
const bySku = new Map();
for (const d of detail) {
  if (d["מק\"ט"] === "ללא מק\"ט" || !HMOS.includes(d["קופה"])) continue;
  const g = bySku.get(d["מק\"ט"]) ?? { sku: d["מק\"ט"], descs: new Map(), h: {} };
  g.descs.set(d["תיאור"], (g.descs.get(d["תיאור"]) ?? 0) + 1);
  const s = (g.h[d["קופה"]] ??= { qty: 0, net: 0 });
  s.qty += d["כמות"]; s.net += d["סה\"כ לפני מע\"מ"];
  bySku.set(d["מק\"ט"], g);
}
for (const g of bySku.values()) {
  g.desc = [...g.descs].sort((a, b) => b[1] - a[1])[0][0];
  g.hmos = HMOS.filter((h) => g.h[h]?.qty > 0);
  g.main = g.hmos.slice().sort((a, b) => g.h[b].qty - g.h[a].qty)[0];
  g.qty = g.hmos.reduce((s, h) => s + g.h[h].qty, 0);
  g.net = g.hmos.reduce((s, h) => s + g.h[h].net, 0);
}
const avg = (s) => (s?.qty > 0 ? r2(s.net / s.qty) : "");

const overlap = [...bySku.values()].filter((g) => g.hmos.length >= 2)
  .sort((a, b) => b.hmos.length - a.hmos.length || b.net - a.net)
  .map((g) => {
    const prices = g.hmos.map((h) => g.h[h].net / g.h[h].qty).filter((p) => p > 0);
    const row = { "מק\"ט": g.sku, "תיאור": g.desc, "מספר קופות": g.hmos.length, "קופות": g.hmos.join(", ") };
    for (const h of HMOS) { row[`כמות ${h}`] = g.h[h]?.qty > 0 ? r2(g.h[h].qty) : ""; row[`מחיר ממוצע ${h}`] = avg(g.h[h]); }
    row["פער בין המחיר הגבוה לנמוך %"] = prices.length >= 2 ? r2((Math.max(...prices) / Math.min(...prices) - 1) * 100) : "";
    row["סה\"כ לפני מע\"מ"] = r2(g.net);
    return row;
  });

// same product under a different SKU per HMO: identical description, similar description with a shared model token,
// or the same number inside the code (2157 / RUB2157). Pairs only link SKUs whose main HMO differs.
const STOP = new Set(["לכסא", "לכיסא", "כסא", "כיסא", "גלגלים", "של", "עם", "כולל", "דגם", "תוצרת", "חח", "ל", "מ", "ח", "את", "או", "ו"]);
const tokens = (t) => String(t).toLowerCase().replace(/ח"+ח/g, " ").replace(/[^a-z0-9א-ת]+/g, " ").split(" ").filter((w) => w && !STOP.has(w));
// a model token names a product line (EC2000, RUBIX, Q6); plain English words and bare small numbers do not
const PLAIN = new Set(["tilt", "on", "off", "pu", "air", "cushion", "assembly", "basic", "back", "seat", "and", "for", "with"]);
const isModel = (w) => (/[a-z]/.test(w) && /\d/.test(w)) || (/[a-z0-9]/.test(w) && w.length >= 3 && !PLAIN.has(w));
const cands = [...bySku.values()].filter((g) => g.main).map((g) => {
  const tk = tokens(g.desc);
  const heb = [...new Set(tk.filter((w) => !isModel(w) && /[א-ת]/.test(w)))].sort().join(" ");
  const sizes = (String(g.desc).match(/\d+\s*[x*X]\s*\d+/g) ?? []).map((s) => s.replace(/\s/g, "").replace(/[xX]/, "*")).sort().join(",");
  return { g, set: new Set(tk), key: [...new Set(tk)].sort().join(" "), heb, sizes, models: tk.filter(isModel),
    code: g.sku.toUpperCase().replace(/[^A-Z0-9]/g, "") };
});
// JX21818 / MJX21818, 2157 / RUB2157. Shared digits alone are not enough, sizes like 1616 repeat across series.
const codeContains = (a, b) => { const [s, l] = a.code.length <= b.code.length ? [a.code, b.code] : [b.code, a.code];
  return s.length >= 4 && /\d/.test(s) && s !== l && l.includes(s); };
const parent = new Map(cands.map((c) => [c.g.sku, c.g.sku]));
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
const why = new Map();
const link = (a, b, reason) => { const [ra, rb] = [find(a.g.sku), find(b.g.sku)]; if (ra !== rb) parent.set(ra, rb);
  for (const c of [a, b]) { const s = why.get(c.g.sku) ?? new Set(); s.add(reason); why.set(c.g.sku, s); } };
for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
  const a = cands[i], b = cands[j];
  if (a.g.main === b.g.main || !a.key || !b.key) continue;
  // 16*18 and 18*16 are different cushions; a cover (כיסוי) is not the cushion
  if (a.sizes && b.sizes && a.sizes !== b.sizes) continue;
  if (a.set.has("כיסוי") !== b.set.has("כיסוי")) continue;
  if (a.key === b.key) { link(a, b, "תיאור זהה"); continue; }
  const inter = [...a.set].filter((w) => b.set.has(w));
  const aModel = [...a.set].some((w) => !b.set.has(w) && isModel(w)), bModel = [...b.set].some((w) => !a.set.has(w) && isModel(w));
  // different model names on both sides (Q6EDGE / Q6EDGE HD) are different products
  if (inter.length && codeContains(a, b) && !(aModel && bModel)) { link(a, b, "קוד אחד מוכל בשני"); continue; }
  // similar: same Hebrew words and same model tokens, so the difference is only wording. A model on one side only
  // (Tilt / Tilt Q400) would chain parts of different chairs through the generic row.
  const nums = (c) => [...c.set].filter((w) => /^\d+$/.test(w)).sort().join(",");
  const jac = inter.length / new Set([...a.set, ...b.set]).size;
  if (a.heb && a.heb === b.heb && jac >= 0.6 && inter.some(isModel) && nums(a) === nums(b) && !aModel && !bModel) link(a, b, "תיאור דומה");
}
const groups = new Map();
for (const c of cands) if (why.has(c.g.sku)) { const r = find(c.g.sku); groups.set(r, [...(groups.get(r) ?? []), c]); }
const sameProduct = [];
let gno = 0;
for (const members of [...groups.values()].sort((a, b) => b.reduce((s, c) => s + c.g.net, 0) - a.reduce((s, c) => s + c.g.net, 0))) {
  if (new Set(members.map((c) => c.g.main)).size < 2) continue;
  gno++;
  // a generic Hebrew-only name ("ריפוד משענת יד") is often the same part for different chair models
  const specific = members.every((c) => c.models.length > 0) || members.some((c) => why.get(c.g.sku).has("קוד אחד מוכל בשני"));
  for (const c of members.sort((a, b) => HMOS.indexOf(a.g.main) - HMOS.indexOf(b.g.main))) {
    sameProduct.push({
      "קבוצה": gno, "ביטחון": specific ? "גבוה" : "נמוך, שם כללי. ייתכן חלק לדגם כסא אחר",
      "למה נראים זהים": [...why.get(c.g.sku)].join(", "), "מק\"ט": c.g.sku, "תיאור": c.g.desc,
      "קופה עיקרית": c.g.main, "נמכר גם ל": c.g.hmos.filter((h) => h !== c.g.main).join(", "),
      "כמות": r2(c.g.qty), "מחיר ממוצע ליחידה": c.g.qty > 0 ? r2(c.g.net / c.g.qty) : "", "סה\"כ לפני מע\"מ": r2(c.g.net),
    });
  }
}
sameProduct.sort((a, b) => (a["ביטחון"] !== "גבוה") - (b["ביטחון"] !== "גבוה") || a["קבוצה"] - b["קבוצה"]);
const renum = new Map();
for (const r of sameProduct) r["קבוצה"] = renum.get(r["קבוצה"]) ?? renum.set(r["קבוצה"], renum.size + 1).get(r["קבוצה"]);

add("פריטים חופפים", overlap, { "תיאור": 45, "מק\"ט": 18, "קופות": 30 });
add("מק\"ט ייעודי לקופה", sameProduct, { "תיאור": 45, "מק\"ט": 18, "ביטחון": 34, "למה נראים זהים": 22, "נמכר גם ל": 24 });
add("פירוט שורות", noPatientIds ? detail.map(({ "מטופל": _n, "מספר מטופל": _id, ...rest }) => rest) : detail, { "תיאור": 45, "משלם": 28 });
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
