// צילום דיאלוג עריכת העצירה מהתצוגה המקדימה (28/10/2026): npm run dev, ואז OUT=<dir> node scripts/stop-edit-shot.mjs

import { chromium } from '/Users/idanogen/Projects/ogen-motion/engine/node_modules/playwright-core/index.mjs';
const OUT = process.env.OUT;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [];
for (const [w, name] of [[560, '560'], [390, '390']]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000/preview.html?view=stop-edit');
  await page.waitForSelector('text=עריכת פרטי העצירה', { timeout: 20000 });
  await page.fill('#stop-address', 'עלה שיח, הרצל 3'); await page.fill('#stop-phone', '0587777777');
  await page.click('text=קבוע ללקוח');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/stop-edit-${name}.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(name, 'overflow', overflow, 'save enabled', await page.isEnabled('text=שמור'));
  await page.close();
}
await browser.close();
console.log('errors', errors);
