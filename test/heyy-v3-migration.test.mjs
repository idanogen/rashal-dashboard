import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { variablesToV3 } from '../api/_lib/heyy-variables.ts';

/**
 * הגירת heyy ל-v3 (25/10/2026). v2.0 נסגר ב-01/11/2026, וכל ארבעת המנועים
 * האוטומטיים והטקסט החופשי מהתיבה רצו עליו.
 */

test('משתני תבנית: מערך לפי שם הופך לאובייקט שטוח', () => {
  assert.deepEqual(
    variablesToV3([{ name: 'customer_name', value: 'לוזון' }, { name: 'date', value: '26/10' }]),
    { customer_name: 'לוזון', date: '26/10' },
  );
});

test('🔴 ערך ריק נשמר ריק ולא נעלם, ושם ריק מדולג', () => {
  assert.deepEqual(variablesToV3([{ name: 'x', value: '' }, { name: '  ', value: 'y' }]), { x: '' });
});

test('בלי משתנים: אובייקט ריק', () => {
  assert.deepEqual(variablesToV3([]), {});
  assert.deepEqual(variablesToV3(undefined), {});
});

/** 🔴 שומר: הכתובת הישנה של heyy לא חוזרת לקוד בשום מקום. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

test('🔴 אין קריאה ל-api.heyy.io/api/v2.0 בקוד שרץ', () => {
  const files = [...walk('api'), ...walk('supabase/functions'), ...walk('src')];
  // כתובת שאפשר לקרוא אליה, לא אזכור היסטורי בהערה.
  const hits = files.filter((f) => /https:\/\/api\.heyy\.io\/api\/v2/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});
