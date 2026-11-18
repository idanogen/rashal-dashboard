/**
 * תמונות עבר של לקוח (עידן, 18/11/2026: "גישה לתמונות עבר שיש בכרטיסים גם לנהגים
 * בשטח וגם למשרד", כולם רואים הכל). קובץ טהור, מסונכרן לאפליקציה ב-`npm run sync-forms`
 * (שם: lib/forms/shared/media-history.ts). המסד בונה את הרשימה (`customer_media_history`).
 *
 * ⭐ "לא כבד": בממוצע תמונה שמורה היא 0.5MB (מהאפליקציה) עד 1MB (וואטסאפ). הרשת
 * מקבלת רק מוקטנת של כ-10KB מ-render/image, והתמונה בגודל מסך נטענת רק כשפותחים אחת.
 * 🔴 render/image עם width בלי height חותך: תמיד שניהם (לקח 2026).
 */

export interface PastMedia {
  /** tech = צולם מהאפליקציה או מהדשבורד; customer = הלקוח שלח בוואטסאפ. */
  src: 'tech' | 'customer';
  bucket: string;
  path: string;
  type: 'image' | 'video';
  at: string;
  by: string | null;
  /** מספר הקריאה או ההזמנה (SC… / SO…), כשידוע. */
  ref: string | null;
}

export interface PastMediaPage {
  items: PastMedia[];
  total: number;
  customerNumber: string | null;
}

export const PAST_MEDIA_PAGE = 24;

export interface MediaTransform {
  width: number;
  height: number;
  resize: 'cover' | 'contain';
  quality: number;
}

/** ריבוע ברשת: חיתוך למילוי. */
export const THUMB_TRANSFORM: MediaTransform = { width: 240, height: 240, resize: 'cover', quality: 60 };
/** תמונה אחת פתוחה: מלאה, עד 1280 בצד הארוך. */
export const FULL_TRANSFORM: MediaTransform = { width: 1280, height: 1280, resize: 'contain', quality: 75 };

/** הדלי של מה שצולם מהאפליקציה ציבורי (getPublicUrl עם transform); wa-media פרטי ודורש חתימה. */
export const PUBLIC_MEDIA_BUCKET = 'timeline-files';

/** מפתח יחיד לקובץ, גם כשאותו נתיב קיים בשני דליים. */
export const pastMediaKey = (m: Pick<PastMedia, 'bucket' | 'path'>) => `${m.bucket}/${m.path}`;

export function parsePastMedia(raw: unknown): PastMediaPage {
  const r = (raw ?? {}) as { items?: unknown; total?: unknown; customer_number?: unknown };
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    items: items
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.path === 'string' && typeof x.bucket === 'string' && typeof x.at === 'string')
      .map((x) => ({
        src: x.src === 'customer' ? 'customer' : 'tech',
        bucket: x.bucket as string,
        path: x.path as string,
        type: x.type === 'video' ? 'video' : 'image',
        at: x.at as string,
        by: typeof x.by === 'string' && x.by.trim() ? x.by : null,
        ref: typeof x.ref === 'string' && x.ref.trim() ? x.ref : null,
      })),
    total: typeof r.total === 'number' ? r.total : Number(r.total) || 0,
    customerNumber: typeof r.customer_number === 'string' ? r.customer_number : null,
  };
}

/** הסמן לעמוד הבא: התאריך של האחרון שהוצג, או null כשאין עוד. */
export function nextCursor(shown: PastMedia[], total: number): string | null {
  if (!shown.length || shown.length >= total) return null;
  return shown[shown.length - 1].at;
}

/** מוסיף עמוד בלי כפילויות (שני פריטים באותה שנייה בגבול העמוד). */
export function mergePages(prev: PastMedia[], next: PastMedia[]): PastMedia[] {
  const seen = new Set(prev.map(pastMediaKey));
  return [...prev, ...next.filter((m) => !seen.has(pastMediaKey(m)))];
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** קבוצה לכל יום (ביקור), החדש למעלה, לפי השעון המקומי של המכשיר. */
export function groupPastMediaByDay(items: PastMedia[]): { day: string; items: PastMedia[] }[] {
  const out: { day: string; items: PastMedia[] }[] = [];
  for (const m of items) {
    const k = dayKey(m.at);
    const last = out[out.length - 1];
    if (last && last.day === k) last.items.push(m);
    else out.push({ day: k, items: [m] });
  }
  return out;
}

/** כותרת היום: "11/11/26 · הלקוח, אבי · SC2604136". */
export function pastMediaDayTitle(group: { day: string; items: PastMedia[] }): string {
  const [y, m, d] = group.day.split('-');
  const who = [...new Set(group.items.map((x) => (x.src === 'customer' ? 'הלקוח' : x.by ?? 'צוות')))];
  const refs = [...new Set(group.items.map((x) => x.ref).filter((x): x is string => !!x))];
  return [`${d}/${m}/${y.slice(2)}`, who.join(', '), refs.join(', ')].filter(Boolean).join(' · ');
}
