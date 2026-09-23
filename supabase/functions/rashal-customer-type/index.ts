// ─── סוג הלקוח = קופת החולים ────────────────────────────────────
//
// מושך מפריוריטי את `CTYPENAME` (סוג לקוח), שהוא שדה קופת החולים
// האמיתי בכרטיס הלקוח, וכותב אותו ל-`priority_customers.customer_type`.
// נולד ב-02/09/2026 אחרי שעידן דיווח שלקוח מכבי מוצג כמשרד הבריאות.
//
// 🔴 **רץ במנות, ולא מטעמי נוחות:** 42,820 לקוחות בריצה אחת אורכים
// מעל התקרה של פונקציית קצה (הלקח מסריקת הלקוחות המלאה, 25/08:
// ריצה אחת ארכה 142 שניות מול תקרה של כ-150).
//   {"skip":0,"pages":8}   ← שמונה דפים של 2,000, ומחזיר את next_skip
//
// 🔴 **כותב רק את שתי עמודות הסוג**, ולא נוגע בשום שדה אחר של הלקוח.
// הסנכרון הראשי ממשיך לנהל את שאר הכרטיס, ושתי העבודות לא דורסות
// זו את זו.
//
// 🔴🔴 23/09/2026: נכנס לריפו (היה פרוס בלי קוד) ומאחורי שער הסוד. עד היום
// כל מי שהחזיק את המפתח הציבורי יכול היה להפעיל משיכה כבדה מפריוריטי.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireSecret } from "../_shared/require-secret.ts";

const PRIORITY = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const UA = "ogen-rashal-sync/1.0";
const PAGE = 2000;

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const basicAuth = () =>
  "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);

type Row = Record<string, unknown>;
const s = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return t === "" ? null : t;
};

Deno.serve(async (req) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  let skip = Number.isFinite(b?.skip) ? Number(b.skip) : 0;
  const pages = Math.min(12, Math.max(1, Number(b?.pages ?? 6)));

  const started = Date.now();
  let fetched = 0, updated = 0, withType = 0;
  let done = false;

  for (let p = 0; p < pages; p++) {
    const url = `${PRIORITY}/CUSTOMERS?$select=CUSTNAME,CTYPENAME,CTYPECODE&$orderby=CUSTNAME&$skip=${skip}&$top=${PAGE}`;
    const res = await fetch(url, {
      headers: { Authorization: basicAuth(), "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) {
      return json({ ok: false, skip, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` }, 500);
    }
    const rows = (await res.json())?.value ?? [];
    fetched += rows.length;
    if (!rows.length) { done = true; break; }

    // 🔴 עדכון ולא upsert: לקוח שאינו אצלנו אינו נולד כאן עם שם ריק
    // ובלי כתובת. מי שחסר ייכנס דרך הסנכרון הרגיל עם כל השדות.
    const byType = new Map<string, string[]>();
    for (const r of rows as Row[]) {
      const cust = s(r.CUSTNAME);
      const type = s(r.CTYPENAME);
      if (!cust) continue;
      if (type) withType++;
      const key = `${type ?? ""}\u0000${s(r.CTYPECODE) ?? ""}`;
      (byType.get(key) ?? byType.set(key, []).get(key)!).push(cust);
    }
    for (const [key, custs] of byType) {
      const [type, code] = key.split("\u0000");
      for (let i = 0; i < custs.length; i += 500) {
        const { error, count } = await sb
          .from("priority_customers")
          .update({ customer_type: type || null, customer_type_code: code || null }, { count: "exact" })
          .in("custname", custs.slice(i, i + 500));
        if (error) return json({ ok: false, skip, error: error.message }, 500);
        updated += count ?? 0;
      }
    }

    skip += rows.length;
    if (rows.length < PAGE) { done = true; break; }
    // עוצרים במרווח בטוח מתקרת הזמן של פונקציית הקצה.
    if (Date.now() - started > 100_000) break;
  }

  return json({ ok: true, fetched, updated, with_type: withType, next_skip: done ? null : skip, done });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
