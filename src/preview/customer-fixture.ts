/**
 * מטען לדוגמה לכרטיס הלקוח, לצילום מסך בלי להתחבר.
 *
 * 🔴 **הנתונים כאן מומצאים בכוונה.** זה מסך שמציג תיק של מטופל, ואין
 * שום סיבה שנתוני אמת ייכנסו לקובץ שיושב בגיט.
 * ⭐ אבל **המבנה** מועתק אחד לאחד מהתשובה האמיתית של `customer_card`,
 * אחרת הצילום מראה משהו שהקוד לא מייצר. [[feedback_visual_check_before_done]]
 */
import type { CustomerCardData } from '@/lib/customer-card';

export const FIXTURE: CustomerCardData = {
  ok: true,
  customer: {
    customerNumber: '3051234',
    name: 'רוזן מרים',
    phone: '0525550134',
    city: 'רמת גן',
    address: 'הזית 14',
    healthFund: 'כללית',
    agent: 'אילונה',
  },
  open: {
    orders: [
      {
        id: 'o1', ref: 'SO2603120', status: 'תואמה אספקה',
        created: '2026-08-20T09:00:00Z', match: 'number', archived: false,
        scheduled: true, date: '2026-08-26', driver: 'רודי',
        winStart: '09:00:00', winEnd: '12:00:00', coordination: 'coordinated',
        mismatch: false,
        items: [{ part: 'MR4001', desc: 'מזרן אוויר', qty: 1 }],
      },
      {
        id: 'o2', ref: 'SO2601880', status: 'תואמה אספקה',
        created: '2026-06-02T09:00:00Z', match: 'phone', archived: true,
        scheduled: false, date: null, driver: null, mismatch: true,
      },
    ],
    calls: [
      {
        id: 'c1', ref: 'SC2602711', status: 'קריאה חדשה',
        created: '2026-08-15T09:00:00Z', match: 'number',
        scheduled: false, date: null, driver: null, mismatch: false,
        device: 'כיסא ממונע', fault: 'לא נטען עד הסוף',
      },
    ],
    pickups: [],
    notes: [],
  },
  timeline: [
    { at: '2026-08-22T11:00:00Z', kind: 'wa', title: 'הודעה מהלקוח', ref: null, detail: 'מתאים, תודה', match: 'phone' },
    { at: '2026-08-22T10:40:00Z', kind: 'wa', title: 'הודעה ללקוח', ref: null, detail: 'תיאום אספקה ליום רביעי 26/08, 09:00-12:00', match: 'phone' },
    { at: '2026-08-20T09:00:00Z', kind: 'order', title: 'הזמנה נפתחה', ref: 'SO2603120', detail: 'תואמה אספקה · אילונה', match: 'number' },
    { at: '2026-08-15T09:00:00Z', kind: 'call', title: 'קריאת שירות נפתחה', ref: 'SC2602711', detail: 'כיסא ממונע · לא נטען עד הסוף', match: 'number' },
    { at: '2026-06-03T13:20:00Z', kind: 'pickup', title: 'איסוף נפתח', ref: '302411', detail: 'נאסף · מחסן ראשי', match: 'number' },
    { at: '2026-05-28T15:10:00Z', kind: 'stop', title: 'בוצע בשטח', ref: 'דוד', detail: 'נמסר לבת', match: 'number' },
    { at: '2026-05-28T16:30:00Z', kind: 'survey', title: 'סקר שביעות רצון', ref: '5', detail: 'הגיעו בזמן והסבירו הכל', match: 'number' },
    { at: '2026-05-28T00:00:00Z', kind: 'note', title: 'תעודת משלוח', ref: '301884', detail: 'סופית · חויבה', match: 'number' },
  ],
  wa: {
    phone: '0525550134',
    lastInboundAt: '2026-08-22T11:00:00Z',
    unansweredSince: null,
    readAt: '2026-08-22T11:05:00Z',
    messageCount: 6,
    messages: [
      { direction: 'out', body: 'תיאום אספקה ליום רביעי 26/08, 09:00-12:00', at: '2026-08-22T10:40:00Z', status: 'read' },
      { direction: 'in', body: 'מתאים, תודה', at: '2026-08-22T11:00:00Z', status: 'delivered' },
    ],
  },
  // ⭐ הנתונים כאן מחקים מקרה אמיתי שנמדד (לקוח 055851927): מנוף אחד
  // נשאר, וארבעה פריטים אחרים כבר נאספו בחזרה.
  stock: {
    devices: [
      {
        part: 'G175', desc: '"מנוף חשמלי SUNRISE MEDICAL למשקל עד 175 ק""ג"',
        qty: 1, serials: ['17517098728'], installedAt: '2026-01-13',
        warrantyEnd: '2028-01-12', lastSeen: '2026-07-07',
        sources: ['delivery', 'service', 'register'], match: 'number',
      },
      {
        // 🔴 אחריות שנגמרת בקרוב היא המקום היחיד שבו מופיע כתום.
        part: 'MR4001-00-242', desc: 'כיסא ממונע', qty: 1,
        serials: [], installedAt: '2024-02-14', warrantyEnd: '2026-09-20',
        lastSeen: '2026-06-02', sources: ['service'], match: 'phone',
      },
    ],
    accessories: [
      {
        // 🔴 פריט שנרשם בפריוריטי כטקסט חופשי, בלי קוד קטלוגי.
        part: null, desc: 'חגורת פרפר', qty: 1, serials: [],
        installedAt: null, warrantyEnd: null, lastSeen: '2026-03-15',
        sources: ['delivery'], match: 'number',
      },
    ],
    returned: [
      { part: '2HD24RAFPS', desc: 'גרדיאן שלמות רוחב מושב 60', at: '2026-05-26' },
      { part: 'CLRSHLEC2261', desc: 'זוג רגליות מתרוממות', at: '2026-03-17' },
    ],
    since: '2026-01-01',
  },
  surveys: [
    { at: '2026-05-28T16:30:00Z', q1: 5, q2: 5, comment: 'הגיעו בזמן והסבירו הכל', driver: 'דוד' },
  ],
  documents: {
    notes: [{ ref: '301884', date: '2026-05-28', status: 'סופית', invoiced: true, total: 1330 }],
    invoices: [{ ref: 'SI26602993', date: '2026-06-01', total: 1330, status: 'סופית', type: 'C' }],
  },
  match: { byNumber: 4, byPhone: 1, byName: 0 },
  counts: { orders: 5, calls: 3, pickups: 2, notes: 4, stops: 3 },
};
