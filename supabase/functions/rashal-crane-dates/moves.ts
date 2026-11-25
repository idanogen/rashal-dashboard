// טהור, נבדק ב-test/crane-dates.test.mjs. מלוג התנועות של מכשיר: המשלוח ללקוח האחרון וההחזרה האחרונה.
export type MoveRow = { SERNUM?: string; SERNTRANSENV_SUBFORM?: { CURDATE?: string; DOCDES?: string; LOGDOCNO?: string }[] };
export type ShipDates = { sn: string; ship: string | null; doc: string | null; ret: string | null };

export const SHIP = "משלוחים ללקוח";
export const RETURN = "החזרה מלקוח";

export function lastMoves(rows: MoveRow[]): ShipDates[] {
  const out: ShipDates[] = [];
  for (const r of rows) {
    const sn = (r.SERNUM ?? "").trim();
    if (!sn) continue;
    let ship: string | null = null, doc: string | null = null, ret: string | null = null;
    for (const t of r.SERNTRANSENV_SUBFORM ?? []) {
      const d = (t.CURDATE ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      if (t.DOCDES === SHIP && (!ship || d >= ship)) { ship = d; doc = t.LOGDOCNO ?? null; }
      if (t.DOCDES === RETURN && (!ret || d > ret)) ret = d;
    }
    out.push({ sn, ship, doc, ret });
  }
  return out;
}
