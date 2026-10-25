// הרצה אוטומטית של מסך הדגמת הטפסים (25/10/2026): מכבי אספקה ואישור הדרכה למנוף,
// מילוי, חתימה על הקנבס ו-PDF בסוף. שומר את שני ה-PDF ואת צילומי השלבים לתיקיית OUT.
//
// איך מריצים:
//   1. `npm run dev` (localhost:3000).
//   2. המסך האמיתי (/forms-demo) דורש התחברות, ולכן ההרצה עוברת דרך התצוגה המקדימה:
//      להוסיף זמנית ל-`src/preview/main.tsx` את השורה
//      `if (view === 'forms-demo') VIEWS['forms-demo'] = <FormsDemoPage />;` (ואת הייבוא),
//      ולא לקמט אותה: הקובץ מעל תקרת השורות.
//   3. `OUT=/tmp/x/ node scripts/forms-demo-e2e.mjs`
// playwright-core לא מותקן בריפו; ההרצה משתמשת בעותק של ogen-motion ובכרום של המחשב.
import { chromium } from '/Users/idanogen/Projects/ogen-motion/engine/node_modules/playwright-core/index.mjs';

const OUT = process.env.OUT ?? new URL('.', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });

async function sign() {
  const c = page.locator('canvas').first();
  await c.scrollIntoViewIfNeeded();
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 40, b.y + 60);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(b.x + 50 + i * 20, b.y + 50 + (i % 2) * 40, { steps: 3 });
  await page.mouse.up();
}

await page.goto('http://localhost:3000/preview.html?view=forms-demo');
await page.getByText('אישור קבלת מכשיר שיקום וניידות').first().click();
await page.getByRole('button', { name: 'מכשיר מהמלאי' }).click();
await page.getByRole('button', { name: 'פטור מהשתתפות עצמית' }).click();
const idInput = page.locator('label:has-text("מספר תעודת הזהות") + input, label:has-text("מספר תעודת הזהות") ~ * input').first();
await idInput.fill('000000018');
await page.screenshot({ path: OUT + 'e2e-1-fill.png' });
await page.getByRole('button', { name: /המשך ל/ }).click();
await sign();
await page.screenshot({ path: OUT + 'e2e-2-sign.png' });
await page.getByRole('button', { name: /המשך ל/ }).click();
await page.screenshot({ path: OUT + 'e2e-3-review.png', fullPage: false });
await page.getByRole('button', { name: 'שמירה ושליחה' }).click();
await page.waitForSelector('iframe[title="PDF"]', { timeout: 30000 });
const src = await page.locator('iframe[title="PDF"]').getAttribute('src');
const size = await page.evaluate(async (u) => (await (await fetch(u)).blob()).size, src);
console.log('maccabi pdf bytes', size);
const b1 = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), src);
(await import('node:fs')).writeFileSync(OUT + 'demo-maccabi.pdf', Buffer.from(b1));
await page.screenshot({ path: OUT + 'e2e-4-result.png' });

// אישור הדרכה למנוף
await page.getByText('אישור קבלת הדרכה').first().click();
await page.getByRole('button', { name: 'סמן הכל' }).click();
await page.locator('[role="dialog"] div:has(> label:text-is("שם מלא")) input, [role="dialog"] div:has(> *:text-is("שם מלא")) input').first().fill('ישראלי ישראל');
await sign();
await page.screenshot({ path: OUT + 'e2e-5-crane.png' });
await page.locator('[role="dialog"] button').filter({ hasText: 'שמור אישור' }).first().click();
await page.waitForFunction((old) => document.querySelector('iframe[title="PDF"]')?.getAttribute('src') !== old, src, { timeout: 30000 });
const src2 = await page.locator('iframe[title="PDF"]').getAttribute('src');
const size2 = await page.evaluate(async (u) => (await (await fetch(u)).blob()).size, src2);
console.log('crane pdf bytes', size2, src2 !== src ? 'new' : 'SAME');
const b2 = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), src2);
(await import('node:fs')).writeFileSync(OUT + 'demo-crane.pdf', Buffer.from(b2));
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await browser.close();
