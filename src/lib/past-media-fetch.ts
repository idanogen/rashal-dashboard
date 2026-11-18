import { supabase } from './supabase';
import {
  FULL_TRANSFORM, PAST_MEDIA_PAGE, PUBLIC_MEDIA_BUCKET, THUMB_TRANSFORM, parsePastMedia, pastMediaKey,
  type PastMedia, type PastMediaPage,
} from './media-history';

/** מי הלקוח: עצירה, קריאה שלא שובצה, או מספר לקוח. המסד גוזר מהעצירה מספר וטלפון. */
export interface PastMediaTarget {
  stopId?: string | null;
  serviceCallId?: string | null;
  customerNumber?: string | null;
}

export const pastMediaTargetKey = (t: PastMediaTarget) => [t.stopId ?? '', t.serviceCallId ?? '', t.customerNumber ?? ''];

export async function fetchPastMedia(t: PastMediaTarget, before: string | null): Promise<PastMediaPage> {
  const { data, error } = await supabase.rpc('customer_media_history', {
    p_stop_id: t.stopId || null,
    p_service_call_id: t.serviceCallId || null,
    p_customer_number: t.customerNumber || null,
    p_before: before,
    p_limit: PAST_MEDIA_PAGE,
  });
  if (error) throw new Error(error.message);
  return parsePastMedia(data);
}

/** כמה זמן חיה כתובת חתומה לקובץ מהדלי הפרטי. */
const SIGNED_SECONDS = 600;

export interface PastMediaUrls {
  thumb: Record<string, string>;
  full: Record<string, string>;
}

/**
 * כתובות לעמוד אחד: מוקטנת לכל פריט (כ-10KB), ובגודל מסך לפתיחה. הדלי הציבורי
 * לא דורש בקשה לשרת; בדלי הפרטי חתימה לכל מוקטנת (render/image לא נחתם באצווה)
 * ואצווה אחת לקבצים המלאים. 🔴 סרטון אין לו מוקטנת, רק אריח עם סימן הפעלה.
 */
export async function pastMediaUrls(items: PastMedia[]): Promise<PastMediaUrls> {
  const thumb: Record<string, string> = {};
  const full: Record<string, string> = {};
  const pub = supabase.storage.from(PUBLIC_MEDIA_BUCKET);
  const priv = items.filter((m) => m.bucket !== PUBLIC_MEDIA_BUCKET);
  for (const m of items.filter((x) => x.bucket === PUBLIC_MEDIA_BUCKET)) {
    const k = pastMediaKey(m);
    if (m.type === 'image') {
      thumb[k] = pub.getPublicUrl(m.path, { transform: THUMB_TRANSFORM }).data.publicUrl;
      full[k] = pub.getPublicUrl(m.path, { transform: FULL_TRANSFORM }).data.publicUrl;
    } else {
      full[k] = pub.getPublicUrl(m.path).data.publicUrl;
    }
  }
  const byBucket = new Map<string, PastMedia[]>();
  for (const m of priv) byBucket.set(m.bucket, [...(byBucket.get(m.bucket) ?? []), m]);
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, list]) => {
      const store = supabase.storage.from(bucket);
      const [signedFull, ...thumbs] = await Promise.all([
        store.createSignedUrls(list.map((m) => m.path), SIGNED_SECONDS),
        ...list.map((m) =>
          m.type === 'image'
            ? store.createSignedUrl(m.path, SIGNED_SECONDS, { transform: THUMB_TRANSFORM })
            : Promise.resolve(null),
        ),
      ]);
      for (const s of signedFull.data ?? []) {
        if (s.path && s.signedUrl) full[`${bucket}/${s.path}`] = s.signedUrl;
      }
      list.forEach((m, i) => {
        const url = thumbs[i]?.data?.signedUrl;
        if (url) thumb[pastMediaKey(m)] = url;
      });
    }),
  );
  return { thumb, full };
}
