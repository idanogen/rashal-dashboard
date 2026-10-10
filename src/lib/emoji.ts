/**
 * אימוג'ים בצ'אט הצוות (עידן, 09/10/2026). קובץ טהור, זהה באפליקציה.
 *
 * רשימה קבועה ולא מקלדת אימוג'י מלאה: הלוח הוא מה שעובד שולח לעמית בעבודה
 * (אישור, תודה, בדרך, בעיה), ולא אלפי סמלים לגלול בהם מהרכב.
 */
export const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  { label: 'תגובה', emojis: ['👍', '👌', '🙏', '❤️', '😊', '😂', '😅', '🤔', '😮', '😢', '😡', '🥳'] },
  { label: 'עבודה', emojis: ['✅', '❌', '⚠️', '🔥', '⏰', '📞', '📷', '📦', '🚚', '🔧', '🛠️', '📍'] },
  { label: 'עוד', emojis: ['👋', '💪', '🤝', '👀', '🙈', '☕', '🍕', '🎉', '⭐', '💤', '🚗', '🏠'] },
];

export const ALL_EMOJIS: string[] = EMOJI_GROUPS.flatMap((g) => g.emojis);

/** אימוג'י ורווחים בלבד, עד ארבעה: הודעה כזאת מוצגת גדול, כמו בוואטסאפ. */
const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;

export function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const matches = t.match(EMOJI_RE) ?? [];
  if (matches.length === 0 || matches.length > 4) return false;
  return t.replace(EMOJI_RE, '').replace(/\s/g, '') === '';
}

/** הוספת אימוג'י למיקום הסמן, ומחזירה את הטקסט החדש ומיקום הסמן אחרי. */
export function insertAt(text: string, emoji: string, cursor: number | null): { text: string; cursor: number } {
  const at = cursor == null || cursor < 0 || cursor > text.length ? text.length : cursor;
  return { text: text.slice(0, at) + emoji + text.slice(at), cursor: at + emoji.length };
}
