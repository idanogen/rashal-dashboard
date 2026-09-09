import test from 'node:test';
import assert from 'node:assert/strict';
import { SURVEY_LANGS, SURVEY_TEXT, isSurveyLang, surveyDir } from '../src/lib/i18n/survey.ts';

const CODES = ['he', 'en', 'ar', 'ru', 'th', 'am'];

test('שש שפות, כל אחת עם תווית וכיוון', () => {
  assert.deepEqual(SURVEY_LANGS.map((l) => l.code), CODES);
  assert.deepEqual(SURVEY_LANGS.map((l) => l.label), ['עברית', 'English', 'العربية', 'Русский', 'ไทย', 'አማርኛ']);
  assert.equal(surveyDir('he'), 'rtl');
  assert.equal(surveyDir('ar'), 'rtl');
  assert.equal(surveyDir('en'), 'ltr');
  assert.equal(surveyDir('ru'), 'ltr');
  assert.equal(surveyDir('th'), 'ltr');
  assert.equal(surveyDir('am'), 'ltr');
});

test('isSurveyLang מקבל רק את השש, ולא כל מחרוזת', () => {
  for (const c of CODES) assert.equal(isSurveyLang(c), true);
  assert.equal(isSurveyLang('fr'), false);
  assert.equal(isSurveyLang('HE'), false);
  assert.equal(isSurveyLang(''), false);
  assert.equal(isSurveyLang(null), false);
  assert.equal(isSurveyLang(undefined), false);
  assert.equal(isSurveyLang(3), false);
});

/**
 * 🔴 מפתח שחסר בשפה אחת פירושו מילה בעברית באמצע עמוד בערבית. הבדיקה
 * משווה את סט המפתחות של כל שפה מול עברית, ומוודאת שאף ערך אינו ריק.
 */
test('🔴 לכל שפה בדיוק אותם מפתחות כמו לעברית, ואף אחד לא ריק', () => {
  const heKeys = Object.keys(SURVEY_TEXT.he).sort();
  for (const c of CODES) {
    const t = SURVEY_TEXT[c];
    assert.deepEqual(Object.keys(t).sort(), heKeys, `keys of ${c}`);
    for (const [k, v] of Object.entries(t)) {
      if (k === 'greeting') continue;
      assert.equal(typeof v, 'string', `${c}.${k}`);
      assert.ok(v.trim().length > 0, `${c}.${k} is empty`);
    }
  }
});

test('הפנייה האישית: עם שם ובלי שם', () => {
  assert.equal(SURVEY_TEXT.he.greeting('רטיג חווה'), 'רטיג חווה שלום,');
  assert.equal(SURVEY_TEXT.he.greeting(''), 'שלום,');
  assert.equal(SURVEY_TEXT.en.greeting('Dana'), 'Hello Dana,');
  assert.equal(SURVEY_TEXT.en.greeting(''), 'Hello,');
  assert.equal(SURVEY_TEXT.ar.greeting(''), 'مرحباً،');
  assert.equal(SURVEY_TEXT.ru.greeting('Анна'), 'Здравствуйте, Анна,');
  assert.equal(SURVEY_TEXT.th.greeting(''), 'สวัสดีค่ะ/ครับ');
});

/**
 * 🔴 המשפט הפותח בעברית זהה מילה במילה לתבנית `survey_invite_service`
 * שאושרה במטא. שינוי כאן הוא הגשה מחדש של 48 שעות.
 */
test('🔴 הפתיח בעברית לא זז מהתבנית המאושרת', () => {
  assert.equal(
    SURVEY_TEXT.he.intro,
    'קיבלת לאחרונה שירות מחברת ר.שעל בע״מ. חשוב לי לדעת איך הרגשת עם השירות שקיבלת, ולכן אשמח אם תקדיש לנו פחות מדקה ותענה על שתי שאלות קצרות.',
  );
});

test('אין גרש ארוך באף מחרוזת שמוצגת ללקוח', () => {
  for (const c of CODES) {
    for (const [k, v] of Object.entries(SURVEY_TEXT[c])) {
      const s = typeof v === 'function' ? v('X') + v('') : v;
      assert.equal(/[–—]/.test(s), false, `${c}.${k} has a long dash`);
    }
  }
});

test('החתימה: השם המודפס והתפקיד מתורגמים, והמותג נשאר ר.שעל בעברית', () => {
  assert.equal(SURVEY_TEXT.he.signerName, 'שלומי קורן');
  assert.equal(SURVEY_TEXT.en.signerName, 'Shlomi Koren');
  assert.equal(SURVEY_TEXT.ar.signerName, 'شلومي كورن');
  assert.equal(SURVEY_TEXT.ru.signerName, 'Шломи Корен');
  assert.equal(SURVEY_TEXT.th.signerName, 'Shlomi Koren');
  assert.equal(SURVEY_TEXT.he.brand, 'שירותי עזר לנכים');
});
