import test from 'node:test';
import assert from 'node:assert/strict';

import { detectLanguageReply, renderTranslated } from '../api/_lib/wa-lang-core.ts';
import { parseCustomerReply } from '../api/_lib/extract.ts';

test('button captions and short codes are language choices, sentences are not', () => {
  assert.equal(detectLanguageReply('English'), 'en');
  assert.equal(detectLanguageReply(' العربية '), 'ar');
  assert.equal(detectLanguageReply('Русский'), 'ru');
  assert.equal(detectLanguageReply('ไทย'), 'th');
  assert.equal(detectLanguageReply('ru'), 'ru');
  assert.equal(detectLanguageReply('EN.'), 'en');
  assert.equal(detectLanguageReply('עברית'), 'he');
  assert.equal(detectLanguageReply('English please, I do not read Hebrew'), null);
  assert.equal(detectLanguageReply('מתאים לי'), null);
  assert.equal(detectLanguageReply(''), null);
});

const dict = {
  'v:לאספקת הציוד': 'to deliver the equipment', 'v:שני': 'Monday', 'v:עד': 'and', 'v:טכנאי': 'technician',
};

test('closed-list values, weekday and hours are translated inside the body', () => {
  const body = 'Hello {{var.customer_name}}, we come {{var.purpose}} on {{var.day}}, between {{var.hours}}.';
  const out = renderTranslated(body, { customer_name: 'Sana', purpose: 'לאספקת הציוד', day: 'שני, 7.9.2026', hours: '09:00 עד 11:00' }, dict, 'en');
  assert.equal(out, 'Hello Sana, we come to deliver the equipment on Monday, 7.9.2026, between 09:00 and 11:00.');
});

test('thai and arabic day formats differ from the latin one', () => {
  assert.equal(renderTranslated('{{var.day}}', { day: 'שני, 7.9.2026' }, { 'v:שני': 'จันทร์' }, 'th'), 'จันทร์ที่ 7.9.2026');
  assert.equal(renderTranslated('{{var.day}}', { day: 'שני, 7.9.2026' }, { 'v:שני': 'الاثنين' }, 'ar'), 'الاثنين 7.9.2026');
});

test('a value without a translation passes through, a missing variable renders empty', () => {
  assert.equal(renderTranslated('{{var.worker}} {{var.name}}|{{var.x}}', { worker: 'טכנאי', name: 'Orit' }, dict, 'en'), 'technician Orit|');
});

test('translated button captions are understood as coordination replies', () => {
  assert.equal(parseCustomerReply('Works for me').status, 'מתאים');
  assert.equal(parseCustomerReply("Doesn't work").status, 'לא מתאים');
  assert.equal(parseCustomerReply('مناسب لي').status, 'מתאים');
  assert.equal(parseCustomerReply('غير مناسب').status, 'לא מתאים');
  assert.equal(parseCustomerReply('Мне подходит').status, 'מתאים');
  assert.equal(parseCustomerReply('Не подходит').status, 'לא מתאים');
  assert.equal(parseCustomerReply('สะดวก').status, 'מתאים');
  assert.equal(parseCustomerReply('ไม่สะดวก').status, 'לא מתאים');
});
