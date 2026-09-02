import test from 'node:test';
import assert from 'node:assert/strict';
import { waInboxPath, waLocalPhone } from '../src/lib/wa-chat-link.ts';

/**
 * 🔴🔴 **הקישור מוביל לתיבת השיחות של המערכת, לא ל-wa.me** (עידן,
 * 02/09/2026: "אנחנו עובדים בוואטסאפ על המערכת שלנו"). wa.me היה מוציא
 * את ההודעה מהמספר הפרטי של העובד, בלי תיעוד ובלי שאף אחד אחר יראה.
 *
 * הבדיקה הזאת נועלת שני דברים: שהיעד פנימי, ושמספר שבור מחזיר null כדי
 * שהמסך יציג "אין נייד" ולא כפתור שמבטיח ולא מקיים.
 */

test('🔴 היעד פנימי, ולא wa.me', () => {
  const path = waInboxPath('+972546875850');
  assert.equal(path, '/inbox?phone=0546875850');
  assert.ok(!String(path).includes('wa.me'));
});

test('⚠️ המספר עובר בצורה המקומית, כי כך הוא שמור בשורות התיבה', () => {
  assert.equal(waLocalPhone('+972546875850'), '0546875850');
  assert.equal(waLocalPhone('0523694547'), '0523694547');
  assert.equal(waLocalPhone('052-369-4547'), '0523694547');
});

test('בלי טלפון או מספר שבור: null, לא כפתור', () => {
  assert.equal(waInboxPath(null), null);
  assert.equal(waInboxPath(undefined), null);
  assert.equal(waInboxPath(''), null);
  // קו נייח אינו וואטסאפ.
  assert.equal(waInboxPath('039012345'), null);
  // מספר קצר מדי (טעות הזנה) לא הופך לקישור.
  assert.equal(waInboxPath('+97252123'), null);
});
