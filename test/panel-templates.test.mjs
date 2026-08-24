import test from 'node:test';
import assert from 'node:assert/strict';
import { toPanelTemplates } from '../api/_lib/panel-templates.ts';

/**
 * 🔴🔴 **הכלל היחיד שקובע מה אפשר לשלוח מאיפה.** עד 24/08/2026 הוא היה
 * מוצהר בשלושה מקומות, ואחד מהם כבר נפרד בשקט: החלונית שבתוך פריוריטי
 * לא הציעה שום תבנית כשחלון 24 השעות היה סגור, ושלחה את העובד לפריוריטי,
 * בזמן שהדשבורד כבר שלח את אותן תבניות מהמסך המקביל.
 *
 * ⭐ הקו האמיתי הוא **מסמך חדש לכל הודעה**, ולא "מדיה" בכלל: סרטון
 * הבטיחות אושר יחד עם התבנית ויושב אצל heyy, ולכן הוא נשלח מכל מקום.
 */

const tpl = (over) => ({
  key: 'k', heyyTemplateId: 'h', name: 'n', label: 'תבנית', category: 'utility',
  bodyPreview: 'שלום {{var.customer_name}}', variables: ['customer_name'],
  attachmentKind: null, attachmentId: null, attachmentFileId: null,
  mediaPerMessage: false, heyyStatus: 'active', ...over,
});

test('תבנית שדורשת מסמך לכל הודעה אינה נשלחת מהתיבה', () => {
  const list = [tpl({ key: 'send_document', mediaPerMessage: true }), tpl({ key: 'service_update' })];

  const fromInbox = toPanelTemplates(list, { allowDocument: false });
  assert.deepEqual(fromInbox.map((t) => t.key), ['service_update']);

  const fromRow = toPanelTemplates(list, { allowDocument: true });
  assert.deepEqual(fromRow.map((t) => t.key), ['send_document', 'service_update']);
});

test('⭐ מדיה קבועה כן נשלחת מהתיבה: הקובץ כבר אצל heyy', () => {
  // 🔴 זו הטעות המזמינה: לחסום לפי "יש קובץ" במקום לפי "צריך להפיק קובץ".
  const out = toPanelTemplates(
    [tpl({ key: 'crane_safety', attachmentKind: 'video', mediaPerMessage: false })],
    { allowDocument: false },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].needsDocument, false);
  assert.equal(out[0].attachmentKind, 'video');
});

test('🔴 תבנית שמטא לא אישרה חוזרת עם הסיבה, ולא נעלמת', () => {
  for (const status of [null, 'pending', 'rejected', 'ACTIVE']) {
    const out = toPanelTemplates([tpl({ heyyStatus: status })], { allowDocument: true });
    assert.equal(out.length, 1, String(status));
    assert.equal(out[0].available, false, String(status));
    assert.match(out[0].unavailableReason ?? '', /מטא/);
  }
  const ok = toPanelTemplates([tpl({ heyyStatus: 'active' })], { allowDocument: true });
  assert.equal(ok[0].available, true);
  assert.equal(ok[0].unavailableReason, null);
});

test('הנוסח והמשתנים עוברים כמו שהם, כי התצוגה המקדימה נבנית מהם', () => {
  const out = toPanelTemplates([tpl({ variables: ['customer_name', 'subject'] })], { allowDocument: true });
  assert.deepEqual(out[0].variables, ['customer_name', 'subject']);
  assert.equal(out[0].preview, 'שלום {{var.customer_name}}');
});
