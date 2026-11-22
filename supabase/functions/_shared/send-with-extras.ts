// שליחה ללקוח ולבני המשפחה שקישרנו אליו (extra_phones), מקור אחד לשלושת המנועים:
// rashal-media-request · rashal-on-way · rashal-surveys. קובץ טהור, נבדק מ-node (test/send-with-extras.test.mjs).
//
// עד 13/11/2026 בני המשפחה קיבלו הודעה רק אחרי שהשליחה ללקוח הצליחה. מ-13/11 מספר שאינו בוואטסאפ
// מקבל הפסקה של 30 יום (api/heyy-send מחזיר 409 `unreachable_paused`), ובלי הקובץ הזה דווקא
// הלקוח בלי וואטסאפ, שבן המשפחה הוא הדרך היחידה אליו, היה מפסיק לקבל הכל.

export type SendResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean; paused?: boolean };

export const PAUSED_ERROR = "unreachable_paused";

/** מסווג תשובה של api/heyy-send. */
export function isPausedResponse(status: number, body: unknown): boolean {
  return status === 409 && (body as { error?: unknown } | null)?.error === PAUSED_ERROR;
}

/**
 * הלקוח קודם. הצליח: שולחים גם לבני המשפחה, וכשלון אצלם רק נרשם ביומן.
 * מושהה (אינו בוואטסאפ): שולחים לבני המשפחה, ואם אחד מהם קיבל, הבקשה נחשבת כנשלחה.
 * כל כשלון אחר: מוחזר כמו שהוא ובני המשפחה לא מקבלים (כמו קודם, כולל 429 שחוזר לתור).
 */
export async function sendWithExtras(
  primary: string,
  extras: readonly string[] | null | undefined,
  send: (phone: string) => Promise<SendResult>,
  onExtraFail: (phone: string, error: string) => void,
): Promise<SendResult & { via_extra?: boolean }> {
  const res = await send(primary);
  if (!res.ok && !res.paused) return res;
  let anyExtra = false;
  for (const extra of extras ?? []) {
    if (extra === primary) continue;
    const r2 = await send(extra);
    if (r2.ok) anyExtra = true;
    else onExtraFail(extra, r2.error);
  }
  if (res.ok) return res;
  return anyExtra ? { ok: true, via_extra: true } : res;
}
