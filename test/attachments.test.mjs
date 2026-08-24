import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAttachments } from '../api/_lib/attachments.ts';

/**
 * 🔴 המטענים כאן הועתקו משורות אמיתיות ב-`wa_messages` (24/08/2026),
 * ולא הומצאו. מבנה מומצא היה מאשר את עצמו.
 */

const image = {
  id: 'd1616240',
  type: 'image',
  file: { id: '385cc70a', url: 'https://heyy-storage.s3.eu-central-1.amazonaws.com/app/assets/x?X-Amz-Expires=86400', name: 'File.jpg', size: 255206, type: 'image', contentType: 'image/jpeg' },
  stored_path: 'conv/msg/385cc70a-File.jpg',
};

const pdf = {
  id: '6668ace6',
  type: 'document',
  file: { id: 'afd00414', url: 'https://heyy-storage.s3.eu-central-1.amazonaws.com/app/assets/y', name: 'SO2603069.pdf', size: 79389, type: 'document', contentType: 'application/pdf' },
  stored_path: 'conv/msg/afd00414-SO2603069.pdf',
};

/** כפתור של תבנית. אין לו `file`, והוא לא קובץ. */
const button = {
  id: 'e738027d',
  type: 'button',
  text: 'למילוי הסקר',
  buttonType: 'url',
  data: { url: 'https://api.heyy.io/public/redirect/wa', type: 'dynamic_url' },
  stored_error: 'אין כתובת לקובץ',
};

test('תמונה מזוהה כתמונה ומסומנת כמוכנה להצגה', () => {
  const [a] = describeAttachments([image]);
  assert.equal(a.kind, 'image');
  assert.equal(a.ready, true);
  assert.equal(a.name, 'File.jpg');
  assert.equal(a.sizeBytes, 255206);
});

test('מסמך PDF מזוהה כ-pdf ולא כתמונה', () => {
  const [a] = describeAttachments([pdf]);
  assert.equal(a.kind, 'pdf');
  assert.equal(a.ready, true);
});

test('🔴 כפתור תבנית אינו מצורף, ואינו מייצר סימן אטב', () => {
  // זה מה שגרם לכל הודעת סקר להציג "📎 קובץ מצורף" שלחיצה עליו נכשלת.
  assert.deepEqual(describeAttachments([button]), []);
});

test('🔴 האינדקס נשאר של המערך המקורי גם אחרי סינון', () => {
  // בקשת המדיה נשלחת לפי אינדקס. מספור מחדש היה פותח קובץ אחר.
  const [a] = describeAttachments([button, pdf]);
  assert.equal(a.index, 1);
  assert.equal(a.kind, 'pdf');
});

test('🔴 כתובת S3 והנתיב הפנימי אינם עוברים ללקוח', () => {
  const json = JSON.stringify(describeAttachments([image, pdf, button]));
  assert.ok(!json.includes('X-Amz'), 'כתובת חתומה של heyy דלפה ללקוח');
  assert.ok(!json.includes('heyy-storage'), 'כתובת האחסון של heyy דלפה ללקוח');
  assert.ok(!json.includes('conv/msg'), 'הנתיב הפנימי בדלי דלף ללקוח');
});

test('קובץ שלא הועתק אלינו מסומן כלא מוכן', () => {
  const { stored_path, ...notCopied } = pdf;
  const [a] = describeAttachments([notCopied]);
  assert.equal(a.ready, false);
  assert.equal(a.kind, 'pdf');
});

test('וידאו ואודיו מזוהים, גם כשאין contentType', () => {
  const [v] = describeAttachments([{ type: 'video', file: { name: 'WhatsApp Video 2026-07-20 at 11.50.04.mp4' } }]);
  assert.equal(v.kind, 'video');
  const [a] = describeAttachments([{ type: 'voice', file: { name: 'x' } }]);
  assert.equal(a.kind, 'audio');
});

test('סוג לא מוכר נופל ל-file ולא נעלם', () => {
  const [a] = describeAttachments([{ type: 'weird', file: { name: 'x.zzz' } }]);
  assert.equal(a.kind, 'file');
  assert.equal(a.name, 'x.zzz');
});

test('קובץ בלי שם מקבל שם קריא ולא מחרוזת ריקה', () => {
  const [a] = describeAttachments([{ type: 'document', file: {} }]);
  assert.equal(a.name, 'קובץ');
});

test('קלט שאינו מערך אינו מפיל', () => {
  assert.deepEqual(describeAttachments(null), []);
  assert.deepEqual(describeAttachments(undefined), []);
  assert.deepEqual(describeAttachments('x'), []);
});
