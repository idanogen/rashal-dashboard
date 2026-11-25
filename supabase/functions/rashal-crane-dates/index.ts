// rashal-crane-dates: המשלוח ללקוח האחרון של כל מנוף, מלוג התנועות של כרטיס המכשיר בפריוריטי
// (עידן 25/11/2026: "התאריך שממנו סופרים 3 שנים, משלוחים ללקוח האחרון, זה במסך הבן").
// SERNUMBERS → SERNTRANSENV_SUBFORM, שורות DOCDES = "משלוחים ללקוח" / "החזרה מלקוח".
// 🔴 SHIPDATE שעל הכרטיס ריק אצל רבים, לכן הלוג. 🔴 פריוריטי מחזיר עד 2,000 שורות לבקשה: עימוד.
// קריאה בלבד מפריוריטי. כותב ל-cranes דרך crane_apply_ship_dates. קרון לילי rashal-crane-dates.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireSecret } from "../_shared/require-secret.ts";
import { lastMoves, type MoveRow } from "./moves.ts";

const P = "https://p.priority-connect.online/odata/Priority/tabb4ce6.ini/shaal";
const PAGE = 400;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const auth = () => "Basic " + btoa(`${Deno.env.get("PRIORITY_USER")}:${Deno.env.get("PRIORITY_PASSWORD")}`);

async function getJson(path: string) {
  let last = "";
  for (const wait of [0, 2000, 5000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const r = await fetch(P + path, { headers: { Authorization: auth(), Accept: "application/json", "User-Agent": "OgenSync/1.0" } });
      const body = await r.text();
      if (r.ok) return JSON.parse(body) as { value: MoveRow[] };
      last = `HTTP ${r.status}: ${body.slice(0, 200)}`;
    } catch (e) { last = String(e).slice(0, 200); }
  }
  throw new Error(last);
}

Deno.serve(async (req: Request) => {
  const denied = requireSecret(req);
  if (denied) return denied;
  const t0 = Date.now();
  const { data: models, error: mErr } = await sb.from("cranes").select("model").limit(5000);
  if (mErr) return Response.json({ error: mErr.message }, { status: 500 });
  const parts = [...new Set((models ?? []).map((m) => String(m.model)).filter((m) => /^G\d{3}E?$/.test(m)))];
  if (!parts.length) return Response.json({ error: "no crane models" }, { status: 500 });
  const filter = encodeURIComponent(parts.map((p) => `PARTNAME eq '${p}'`).join(" or "));
  const expand = encodeURIComponent("SERNTRANSENV_SUBFORM($select=CURDATE,DOCDES,LOGDOCNO)");
  let rows: MoveRow[] = [];
  for (let skip = 0; skip < 20000; skip += PAGE) {
    const j = await getJson(`/SERNUMBERS?$filter=${filter}&$select=SERNUM&$expand=${expand}&$orderby=SERNUM&$top=${PAGE}&$skip=${skip}`);
    rows = rows.concat(j.value ?? []);
    if ((j.value ?? []).length < PAGE) break;
  }
  const payload = lastMoves(rows);
  let updated = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const { data, error } = await sb.rpc("crane_apply_ship_dates", { p: payload.slice(i, i + 500) });
    if (error) return Response.json({ error: error.message, pulled: rows.length }, { status: 500 });
    updated += Number(data ?? 0);
  }
  return Response.json({ ok: true, models: parts, pulled: rows.length, updated, ms: Date.now() - t0 });
});
