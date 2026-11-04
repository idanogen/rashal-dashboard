#!/usr/bin/env node
// מרנדר טופס קופה ל-PNG, ממולא בנתוני הדגמה וריק, ישר מהתבנית שבקוד (04/11/2026, טופס כללית).
// איך מריצים:  node scripts/render-form-png.mjs clalit-delivery /tmp/out
// הבנייה: esbuild מאגד את מודולי הטפסים ל-node עם הלוגו כ-data URL, ואז Chrome headless מצלם.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [key = 'clalit-delivery', out = '/tmp/form-png'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
execSync(`npx esbuild src/lib/forms/html.ts src/lib/forms/demo.ts src/lib/forms/prefill.ts src/lib/forms/registry.ts ` +
  `--bundle --format=esm --platform=node --loader:.png=dataurl --alias:@=./src --outdir=${out} --log-level=error`, { stdio: 'inherit' });
const { buildFormHtml } = await import(pathToFileURL(join(out, 'html.js')).href);
const { getFormByKey } = await import(pathToFileURL(join(out, 'registry.js')).href);
const { demoSource } = await import(pathToFileURL(join(out, 'demo.js')).href);
const { buildContext, buildInitialValues } = await import(pathToFileURL(join(out, 'prefill.js')).href);

const def = getFormByKey(key);
if (!def) throw new Error(`אין טופס ${key}`);
const meta = { signedAt: new Date(), driverName: 'נהג הדגמה', location: null };
const src = demoSource(def);
const ctx = buildContext(src, 'נהג הדגמה', new Date());
const filled = buildInitialValues(def, ctx, src.lines ?? []);
const sig = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70"><path d="M10 50 C 40 10, 70 60, 100 30 S 160 50, 210 20" stroke="#0b2a6b" stroke-width="3" fill="none"/></svg>');
const sigs = Object.fromEntries((def.signatures ?? []).map((s) => [s.key, sig]));
const names = { customer: ctx.customerName, driver: 'נהג הדגמה' };
const wrap = (inner) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${inner}</body></html>`;
writeFileSync(join(out, 'filled.html'), wrap(buildFormHtml(def, filled, sigs, names, meta)));
writeFileSync(join(out, 'empty.html'), wrap(buildFormHtml(def, {}, {}, {}, meta)));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const n of ['filled', 'empty']) {
  execSync(`"${chrome}" --headless=new --disable-gpu --hide-scrollbars --window-size=820,1180 --screenshot="${join(out, n + '.png')}" "${pathToFileURL(join(out, n + '.html')).href}"`, { stdio: 'ignore' });
}
console.log(`PNG: ${join(out, 'filled.png')} · ${join(out, 'empty.png')}`);
