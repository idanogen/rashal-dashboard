import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/password-reset.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../api/admin-users.ts', import.meta.url), 'utf8');

/**
 * 🔴🔴 **הנקודה היחידה במערכת שמחליפה סיסמה בלי משתמש מחובר.**
 * הבדיקות כאן נועלות את ארבע התכונות שבלעדיהן המנגנון הופך מדלת שירות
 * לדלת פריצה. כולן נבדקות על המקור, כי הן תכונות של המבנה ולא של ריצה
 * בודדת: ריצה אחת מוצלחת לא מוכיחה שאין מסלול שני.
 */

test('🔴🔴 היעד נקרא מהכרטיס במסד, ולעולם לא ממה שהדפדפן שלח', () => {
  const block = admin.slice(admin.indexOf("case 'send_reset_link'"), admin.indexOf("default:"));
  assert.ok(
    /\.from\('profiles'\)[\s\S]{0,200}phone_e164/.test(block),
    'השליחה חייבת לשלוף את הטלפון מטבלת הפרופילים',
  );
  assert.ok(
    !/phoneE164:\s*body\./.test(block),
    '🔴 מספר שמגיע מגוף הבקשה מאפשר להפנות איפוס של חשבון זר למכשיר של התוקף',
  );
});

test('🔴 האסימון נשמר כטביעה ולא כערך גולמי', () => {
  const block = admin.slice(admin.indexOf("case 'send_reset_link'"), admin.indexOf("default:"));
  assert.ok(/createHash\('sha256'\)/.test(block), 'חייבת להישמר טביעת sha256');
  assert.ok(
    !/token_hash:\s*token\b/.test(block),
    '🔴 שמירת הערך הגולמי הופכת דליפת טבלה לדליפת מפתחות',
  );
  assert.ok(/createHash\('sha256'\)/.test(api), 'החיפוש בצד הציבורי נעשה לפי הטביעה');
});

test('🔴 תשובה זהה לאסימון שגוי ולאסימון שפג, אחרת זה מנוע ניחוש', () => {
  // מופע אחד של הנוסח, שחוזר בכל מסלולי הכישלון.
  const uses = api.match(/BAD_TOKEN/g) ?? [];
  assert.ok(uses.length >= 5, `הנוסח האחיד חייב לכסות את כל מסלולי הכישלון (נמצאו ${uses.length})`);
  assert.ok(
    !/פג תוקפו של האסימון|האסימון כבר נוצל|token expired/i.test(api),
    '🔴 ניסוח שמבחין בין "לא קיים" ל"פג" מאשר לתוקף שהוא קלע לערך אמיתי',
  );
});

test('🔴🔴 האסימון נסגר לפני עדכון הסיסמה, ובאותה בקשה', () => {
  const claim = api.indexOf("is('used_at', null)");
  const update = api.indexOf('auth.admin.updateUserById');
  assert.ok(claim > -1, 'חייבת להיות תפיסה מותנית של האסימון');
  assert.ok(update > -1, 'חייב להיות עדכון סיסמה');
  assert.ok(
    claim < update,
    '🔴 סגירה אחרי העדכון מותירה חלון שבו שתי בקשות מקבילות עוברות שתיהן',
  );
});

test('⭐ חשבון מושבת אינו נפתח דרך הקישור, גם אם האסימון תקף', () => {
  assert.ok(/profile\.disabled/.test(api), 'חייבת להיבדק השבתה של החשבון');
  const block = admin.slice(admin.indexOf("case 'send_reset_link'"), admin.indexOf("default:"));
  assert.ok(/target\.disabled/.test(block), 'ולא לשלוח לחשבון מושבת מלכתחילה');
});

test('🔴 שליחה שנכשלה לא משאירה קישור חי שאיש לא קיבל', () => {
  const block = admin.slice(admin.indexOf("case 'send_reset_link'"), admin.indexOf("default:"));
  const failBranch = block.slice(block.indexOf('if (!sent.ok)'));
  assert.ok(
    /expires_at/.test(failBranch),
    '🔴 אסימון שנוצר ולא נשלח חייב להיסגר מיד, אחרת הוא כתובת תקפה בלי בעלים',
  );
});
