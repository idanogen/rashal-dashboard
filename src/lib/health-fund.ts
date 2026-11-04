/**
 * סינון לפי קופה במסך הסדרן (עידן, 04/11/2026): "ברמזורים, סינון לפי קופה,
 * שישפיע על כל העמוד". קופה אחת או אף אחת, לא כמה יחד.
 *
 * ⭐ המקור לקופה הוא CTYPENAME של פריוריטי: `orders.health_fund`,
 * `service_calls.health_fund`, ו-`priority_customers.customer_type` לאיסופים,
 * לעצירות ביומן וללקוחות חדשים (שם `health_fund` הוא המשלם: לשכת בריאות,
 * בית חולים, ולא הקופה). הערכים בפריוריטי לא אחידים ("כללית הנדסה",
 * "כללית הנדסה רפואית בעמ", "קופת חולים לאומית"), ולכן מנרמלים למפתח.
 * 🔴 קובץ טהור בלי ייבוא, נבדק ב-`test/health-fund.test.mjs`.
 */
export type HealthFundKey = 'clalit' | 'maccabi' | 'leumit' | 'meuhedet' | 'moh' | 'mod' | 'other' | 'none';

export const HEALTH_FUND_ORDER: HealthFundKey[] = ['clalit', 'maccabi', 'leumit', 'meuhedet', 'moh', 'mod', 'other', 'none'];

export const HEALTH_FUND_LABEL: Record<HealthFundKey, string> = {
  clalit: 'כללית', maccabi: 'מכבי', leumit: 'לאומית', meuhedet: 'מאוחדת',
  moh: 'משרד הבריאות', mod: 'משרד הביטחון', other: 'אחר', none: 'ללא קופה',
};

/** מפתח הקופה מהטקסט של פריוריטי. ריק = 'none', לא מזוהה = 'other'. */
export function healthFundKey(raw: string | null | undefined): HealthFundKey {
  const t = (raw ?? '').trim();
  if (!t) return 'none';
  if (t.includes('כללית')) return 'clalit';
  if (t.includes('מכבי')) return 'maccabi';
  if (t.includes('לאומית')) return 'leumit';
  if (t.includes('מאוחדת')) return 'meuhedet';
  if (t.includes('משרד הבריאות') || t.includes('לשכ')) return 'moh';
  if (t.includes('בטחון') || t.includes('ביטחון')) return 'mod';
  return 'other';
}

export function isHealthFundKey(v: unknown): v is HealthFundKey {
  return typeof v === 'string' && (HEALTH_FUND_ORDER as string[]).includes(v);
}

/** ספירה לצ'יפים: כמה רשומות בכל קופה, בסדר הקבוע, רק קופות שיש בהן משהו. */
export function countByFund(keys: Iterable<HealthFundKey>): Array<{ key: HealthFundKey; count: number }> {
  const m = new Map<HealthFundKey, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return HEALTH_FUND_ORDER.filter((k) => m.has(k)).map((k) => ({ key: k, count: m.get(k)! }));
}
