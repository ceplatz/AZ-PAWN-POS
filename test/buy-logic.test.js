import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSeller, ageOn } from '../js/seller-check.js';
import { validateLine, totalPaid, hasFirearm } from '../js/buy-logic.js';

const cust = { dob: '1990-06-15', flags: {} }, ok = { idExpiry: '2030-01-01' };
test('ageOn handles birthdays', () => {
  assert.equal(ageOn('2000-06-15', '2026-06-14'), 25); assert.equal(ageOn('2000-06-15', '2026-06-15'), 26); assert.equal(ageOn(''), null);
});
test('do-not-buy blocks; police flag and expired ID only warn', () => {
  assert.match(checkSeller({ ...cust, flags: { doNotBuy: true } }, ok, { today: '2026-11-01' }).block, /DO NOT BUY/);
  const r = checkSeller({ ...cust, flags: { police: true } }, { idExpiry: '2026-01-01' }, { today: '2026-11-01' });
  assert.equal(r.block, null); assert.equal(r.warnings.length, 2); assert.equal(r.expired, true);
  assert.deepEqual(checkSeller(cust, ok, { today: '2026-11-01' }), { block: null, warnings: [], expired: false });
});
test('minimum age is only enforced when configured (never a hardcoded legal value)', () => {
  const kid = { dob: '2010-01-01', flags: {} };
  assert.equal(checkSeller(kid, ok, { today: '2026-11-01', minAge: null }).block, null);
  assert.match(checkSeller(kid, ok, { today: '2026-11-01', minAge: 18 }).block, /minimum age of 18/);
  assert.match(checkSeller({ flags: {} }, ok, { today: '2026-11-01', minAge: 18 }).block, /date of birth missing/);
});
test('line validation', () => {
  assert.equal(validateLine({ title: ' ', category: 'Tools', price: '5' }).error, 'Title is required.');
  assert.equal(validateLine({ title: 'a', category: '', price: '5' }).error, 'Choose a category.');
  assert.match(validateLine({ title: 'a', category: 'Tools', price: 'x' }).error, /price paid/);
  assert.match(validateLine({ title: 'a', category: 'Tools', price: '0' }).error, /more than/);
  assert.match(validateLine({ title: 'a', category: 'Electronics', price: '5', serial: ' ' }).error, /serial/);
  assert.match(validateLine({ title: 'a', category: 'Tools', price: '5', ask: 'zz' }).error, /Asking/);
  const r = validateLine({ title: ' Saw ', category: 'Tools', price: '$12.50', ask: '30' });
  assert.equal(r.line.title, 'Saw'); assert.equal(r.line.costBasis, 1250); assert.equal(r.line.askPrice, 3000);
});
test('totals and firearm detection', () => {
  const lines = [{ f: { costBasis: 1250, category: 'Tools' } }, { f: { costBasis: 10000, category: 'Firearm' } }];
  assert.equal(totalPaid(lines), 11250); assert.equal(hasFirearm(lines), true); assert.equal(hasFirearm(lines.slice(0, 1)), false);
});
