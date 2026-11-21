import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldMarkOk } from '../supabase/functions/rashal-watchdog/alert-state.ts';

// 21/11/2026: ארבעה כרטיסי "התראה תקועה" במרכז השירות (#595-#598) היו התראות שעברו מזמן,
// כי פעמון לכל פריט כתב alerting ולא חזר ל-ok.

test('🔴 בדיקה נקייה אחרי התראה מחזירה את המצב ל-ok', () => {
  assert.equal(shouldMarkOk('ok', { state: 'alerting' }), true);
});

test('תקוע שכבר דווח, או חנק, אינו נקי', () => {
  assert.equal(shouldMarkOk('stuck 2 (already alerted)', { state: 'alerting' }), false);
  assert.equal(shouldMarkOk('1 stuck (throttled)', { state: 'alerting' }), false);
  assert.equal(shouldMarkOk('query failed: x', { state: 'alerting' }), false);
});

test('כבר ok או אין שורה: לא כותבים', () => {
  assert.equal(shouldMarkOk('ok', { state: 'ok' }), false);
  assert.equal(shouldMarkOk('ok', undefined), false);
});
