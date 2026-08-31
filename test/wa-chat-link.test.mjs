import test from 'node:test';
import assert from 'node:assert/strict';
import { waChatUrl } from '../src/lib/wa-chat-link.ts';

/**
 * קישור פתיחת שיחת וואטסאפ מרשימת ההערות בסקרים (עידן, 31/08/2026).
 * wa.me דורש ספרות בינלאומיות בלבד; מספר שבור חייב להחזיר null כדי
 * שהמסך יציג "אין נייד" ולא כפתור שפותח שיחה עם מספר לא נכון.
 */

test('נייד בפורמט בינלאומי מלא', () => {
  assert.equal(waChatUrl('+972546875850'), 'https://wa.me/972546875850');
});

test('פורמט מקומי עם אפס מוביל מתורגם לבינלאומי', () => {
  assert.equal(waChatUrl('0523694547'), 'https://wa.me/972523694547');
  assert.equal(waChatUrl('052-369-4547'), 'https://wa.me/972523694547');
});

test('בלי טלפון או מספר שבור: null, לא כפתור', () => {
  assert.equal(waChatUrl(null), null);
  assert.equal(waChatUrl(undefined), null);
  assert.equal(waChatUrl(''), null);
  // קו נייח אינו וואטסאפ: פתיחת שיחה אליו נראית תקינה ונכשלת אצל הלקוח.
  assert.equal(waChatUrl('039012345'), null);
  // מספר קצר מדי (טעות הזנה) לא הופך לקישור.
  assert.equal(waChatUrl('+97252123'), null);
});
