/**
 * מה שהלקוח צריך לדעת על קובץ שעבר בשיחה, ותו לא.
 *
 * 🔴🔴 **המטען הגולמי של heyy לא נמסר לדפדפן, בכוונה.** בתוכו יושבת
 * `file.url`, כתובת S3 חתומה שחיה 24 שעות ואינה דורשת שום הזדהות, וגם
 * `stored_path`, הנתיב הפנימי שלנו בדלי. שניהם היו נוסעים עד היום לכל
 * לשונית פתוחה. כאן נשאר רק שם, סוג, וגודל.
 *
 * 🔴 **ולא כל מה שיושב במערך הזה הוא קובץ.** heyy מכניסה לאותו מערך גם
 * כפתורים של תבנית (`type: "button"`), ובגללם כל הודעת סקר שנשלחה הציגה
 * בתיבת השיחות "📎 קובץ מצורף" שלחיצה עליו נכשלת. נמדד ב-24/08/2026:
 * 18 מתוך 27 המצורפים במסד היו כפתורים, כלומר רוב הסימנים היו שקר.
 *
 * ⭐ ואין כאן שום ייבוא שרץ, בכוונה, כדי שהבדיקות יריצו את הקובץ ישירות.
 */

export type AttachmentKind = 'image' | 'pdf' | 'video' | 'audio' | 'file';

export interface PanelAttachment {
  /**
   * 🔴 **האינדקס במערך המקורי, ולא מקומו ברשימה המסוננת.** הוא מה
   * שנשלח ל-`/api/wa-media?i=`, והשרת קורא לפיו את הנתיב מהשורה. מספור
   * מחדש אחרי סינון כפתורים היה פותח קובץ אחר.
   */
  index: number;
  name: string;
  kind: AttachmentKind;
  /** יש עותק אצלנו, כלומר אפשר באמת לפתוח אותו. */
  ready: boolean;
  sizeBytes: number | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * סוג הקובץ, לפי מה שאפשר לסמוך עליו קודם.
 *
 * `contentType` הוא ההצהרה המדויקת ביותר. `type` של heyy גס יותר
 * (`image` · `document` · `video`), והסיומת היא הניחוש האחרון.
 */
function kindOf(contentType: string, heyyType: string, name: string): AttachmentKind {
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct === 'application/pdf') return 'pdf';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';

  const t = heyyType.toLowerCase();
  if (t === 'image' || t === 'sticker') return 'image';
  if (t === 'video') return 'video';
  if (t === 'audio' || t === 'voice' || t === 'ptt') return 'audio';

  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'm4v', '3gp', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'oga', 'opus', 'm4a', 'wav', 'aac'].includes(ext)) return 'audio';

  return 'file';
}

/**
 * המטען הגולמי ⟵ מה שהמסך מציג.
 *
 * ⭐ **החלטה אחת, בשרת, לשני הצדדים.** גם תיבת השיחות שבדשבורד וגם
 * החלונית שבפריוריטי מציירות מתוך הרשימה הזאת. הכרעה כפולה בשני
 * הקודים הייתה נסדקת בשקט, וזה כבר קרה כאן פעמיים.
 */
export function describeAttachments(raw: unknown): PanelAttachment[] {
  if (!Array.isArray(raw)) return [];

  const out: PanelAttachment[] = [];
  for (let i = 0; i < raw.length; i++) {
    const a = (raw[i] ?? {}) as Record<string, unknown>;
    const file = (a.file ?? null) as Record<string, unknown> | null;

    // 🔴 בלי `file` אין קובץ. כפתור תבנית נראה כאן בדיוק כמו מצורף.
    if (!file || typeof file !== 'object') continue;

    const name = str(file.name) || 'קובץ';
    const size = Number(file.size);

    out.push({
      index: i,
      name,
      kind: kindOf(str(file.contentType), str(a.type) || str(file.type), name),
      ready: Boolean(str(a.stored_path)),
      sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    });
  }
  return out;
}
