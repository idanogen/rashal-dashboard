export const ORDER_STATUS_OPTIONS = [
  { value: 'ממתין לליקוט', label: 'ממתין לליקוט', color: 'slate' },
  { value: 'ממתין לתאום', label: 'ממתין לתאום', color: 'blue' },
  { value: 'תואמה אספקה', label: 'תואמה אספקה', color: 'purple' },
  { value: 'אין במלאי', label: 'אין במלאי', color: 'amber' },
  { value: 'סופק', label: 'סופק', color: 'green' },
  { value: 'בוטל', label: 'בוטל', color: 'red' },
] as const;

export const TASK_STATUS_OPTIONS = [
  { value: 'Todo', label: 'לביצוע', color: 'red' },
  { value: 'In progress', label: 'בטיפול', color: 'yellow' },
  { value: 'Done', label: 'הושלם', color: 'green' },
] as const;

export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'לקוח חדש', label: 'לקוח חדש', color: 'blue' },
  { value: 'לקוח קיים', label: 'לקוח קיים', color: 'gray' },
] as const;

export const WORKERS = ['שורה', 'אילונה'] as const;

export function getOrderStatusLabel(status: string | undefined): string {
  if (!status) return 'לא ידוע';
  const option = ORDER_STATUS_OPTIONS.find(o => o.value === status);
  return option?.label || status;
}

export function getOrderStatusColor(status: string | undefined): string {
  if (!status) return 'gray';
  const option = ORDER_STATUS_OPTIONS.find(o => o.value === status);
  return option?.color || 'gray';
}

export function getTaskStatusLabel(status: string | undefined): string {
  if (!status) return 'לביצוע';
  const option = TASK_STATUS_OPTIONS.find(o => o.value === status);
  return option?.label || status;
}

// ─── Service Calls ──────────────────────────────────────────

export const SERVICE_CALL_STATUS_OPTIONS = [
  { value: 'קריאה חדשה', label: 'קריאה חדשה', color: 'blue' },
  { value: 'תואם ביקור', label: 'תואם ביקור', color: 'purple' },
  { value: 'בוצע', label: 'בוצע', color: 'green' },
  { value: 'בוטל', label: 'בוטל', color: 'red' },
] as const;

// ─── Data window ────────────────────────────────────────────
// Upper bound on how far back the list screens load rows. The tables grow with
// every Priority sync (orders went 600 → 6,000 in four months) and the client
// reads them whole, so an unbounded fetch gets heavier forever.
//
// 180 days excludes nothing today — the oldest order is from 06/04/2026 — so
// this is a growth guard, not a behaviour change. Anything touched inside the
// window is kept regardless of age (see dataWindowFilter), so an old record
// that is still being worked on never disappears from the screen.
// Tighten this number if the dispatcher does not need half a year of history.
export const DATA_WINDOW_DAYS = 180;

export function dataWindowCutoff(): string {
  const d = new Date();
  d.setDate(d.getDate() - DATA_WINDOW_DAYS);
  return d.toISOString();
}

/**
 * מסנן החלון של PostgREST.
 *
 * 🔴🔴 **"נגעו בשורה" אינו "עובדים על הרשומה", וזה מה שנשבר.**
 * עידן, 25/08/2026: "אין סיכוי שאין הזמנות, והמסך עולה ממש לאט."
 * הנוסח הקודם היה `created_at >= cutoff or updated_at >= cutoff`.
 * הכוונה הייתה טובה: רשומה ישנה שעדיין מטפלים בה לא נעלמת מהמסך.
 * אלא שהייבוא ההיסטורי של היום כתב מחדש **את כל** ההזמנות, ולכן
 * `updated_at` של כולן הוא היום, וכולן נכנסו לחלון.
 *
 * **נמדד:** ‎40,402 הזמנות נטענו במקום 1,571, כלומר 41 סבבי רשת
 * סדרתיים במקום 2. המסך נראה ריק עד שהם נגמרים, ומספיק שאחד נכשל
 * כדי שהרשימה תישאר ריקה לגמרי. אותו דבר בקריאות: 13,894 במקום 2,376.
 *
 * ⭐ **התיקון מחזיר את הכוונה המקורית:** רשומה ישנה נשארת רק אם היא
 * גם נגעו בה בחלון **וגם היא לא סגורה**. אומת שכל 735 ההזמנות
 * הממתינות וכל 459 הקריאות הפתוחות נשמרות, אחת לאחת.
 * [[silent_failure_needs_a_watchdog]]
 */
export function dataWindowFilter(statusColumn?: string, terminal?: readonly string[]): string {
  const cutoff = dataWindowCutoff();
  if (!statusColumn || !terminal?.length) {
    return `created_at.gte.${cutoff},updated_at.gte.${cutoff}`;
  }
  // 🔴 הערכים במרכאות כפולות: הם בעברית ומכילים רווחים, ובלי המרכאות
  // PostgREST חותך את הרשימה על הפסיק.
  const list = terminal.map((v) => `"${v}"`).join(',');
  return `created_at.gte.${cutoff},and(updated_at.gte.${cutoff},${statusColumn}.not.in.(${list}))`;
}

/** סטטוסים סופיים. רשומה כזאת לא "עובדים עליה" גם אם נגעו בשורה. */
export const ORDER_CLOSED = ['סופק', 'בוטל'] as const;
export const CALL_CLOSED = ['בוצע', 'בוטל'] as const;
/**
 * 🔴🔴 **היה `['בוצע','בוטל']`, ו-`בוצע` אינו סטטוס איסוף בכלל.**
 *
 * ארבעת הסטטוסים האמיתיים (`types/pickup.ts`) הם:
 * `ממתין לתאום` · `תואם איסוף` · `נאסף` · `בוטל`.
 * כלומר הרשימה החזיקה ערך שלא מופיע אף פעם, **ופספסה את `נאסף`** שהוא
 * מצב הסיום הרגיל של איסוף. נמדד 27/08/2026: **12,210 מתוך 13,266
 * האיסופים הם `נאסף`**, וכולם נחשבו "לא סופיים" למסנן החלון.
 *
 * ⭐ ולמה זה לא התפוצץ קודם: הזרוע הראשונה של המסנן היא `created_at`,
 * וכל השורות נוצרו אצלנו בייבוא ההיסטורי, ולכן הן נכנסו ממילא. הטעות
 * ישבה שם בשקט וחיכתה ליום שבו הזרוע הראשונה תפסיק לכסות אותה.
 */
export const PICKUP_CLOSED = ['נאסף', 'בוטל'] as const;

/**
 * 🔴🔴 **קו פרשת המים: אפריל 2024.**
 *
 * שלומי נתן אותו בעצמו בפגישה של <bdi>20/08/2026</bdi>: "כל הנתונים
 * שאתה מסתכל עליהם, אפריל 24, זו נקודת הקו, כי שם עברנו עם משרד
 * הבריאות ושם התחילו לעקוב אחרינו." מה שלפניו הוא היסטוריה, לא עבודה.
 *
 * **למה זה נדרש דווקא באיסופים.** מסנן החלון הרגיל שואל "נגעו ברשומה
 * לאחרונה, והיא אינה סגורה". באיסופים **כמעט כולם פתוחים לפי הסטטוס**
 * (12,487 מתוך 13,260), ולכן המסנן לא מוריד ולו שורה אחת: מסך הסדרן
 * משך 16,830 איסופים בכל פתיחה. ⭐ בהזמנות ובקריאות המסנן כן עובד
 * (40,402 ⟵ 1,571 ו-13,894 ⟵ 2,376), ולכן הקו חל **על איסופים בלבד**.
 *
 * ⭐ **וזה תיחום שאילתה, לא נגיעה בנתונים.** שום שורה לא נמחקת ולא
 * מאורכבת, וההיסטוריה נשלפת מלאה בחיפוש ובכרטיס הלקוח. עידן, 26/08:
 * "אם זה לא מכביד על המערכת אפשר להשאיר." על המסד זה באמת לא מכביד
 * (11 מגה), אבל על הדפדפן כן, ולכן התיקון הוא בשאילתה.
 *
 * 🔴 **ונבדק לפני שהוסתר משהו:** מתוך כל האיסופים שתאריכם לפני הקו,
 * **אפס שובצו אי פעם ביומן**, גם לא פעם אחת בעבר. כלומר איש לא עבד על
 * אף אחד מהם, ואין כאן עבודה חיה שנעלמת. [[stale_item_is_not_a_dead_item]]
 */
export const BUSINESS_FLOOR_DATE = '2024-04-01';
