import test from 'node:test';
import assert from 'node:assert/strict';
import { isSellable, blockedReason, computeTotals, changeDue, lineMargin, searchItems, FIREARM_BLOCK } from '../js/sell-logic.js';

test('sellable: for sale, or hold date reached; never during hold or when hold unset', () => {
  assert.equal(isSellable({ status: 'for-sale' }, '2026-11-01'), true);
  assert.equal(isSellable({ status: 'on-hold', holdUntil: '2026-11-01' }, '2026-11-01'), true);
  assert.equal(isSellable({ status: 'on-hold', holdUntil: '2026-11-02' }, '2026-11-01'), false);
  assert.equal(isSellable({ status: 'on-hold', holdUntil: null }, '2026-11-01'), false);
  for (const s of ['sold', 'collateral-active', 'released', 'scrapped', 'on-layaway']) assert.equal(isSellable({ status: s }, '2026-11-01'), false, s);
});
test('firearms are blocked even when otherwise sellable', () => {
  assert.equal(blockedReason({ status: 'for-sale', isFirearm: true }, '2026-11-01'), FIREARM_BLOCK);
  assert.equal(blockedReason({ status: 'for-sale' }, '2026-11-01'), null);
  assert.match(blockedReason({ status: 'on-hold', holdUntil: null }, '2026-11-01'), /On hold/);
});
test('totals: tax rounds half-up to the cent; unset tax is flagged, not guessed', () => {
  assert.deepEqual(computeTotals([1000, 2550], 0.0635), { subtotal: 3550, tax: 225, total: 3775, taxKnown: true }); // 225.425 -> 225
  assert.equal(computeTotals([1000], 0.0635).tax, 64);   // 63.5 -> 64
  assert.deepEqual(computeTotals([1000], null), { subtotal: 1000, tax: 0, total: 1000, taxKnown: false });
  assert.deepEqual(computeTotals([], 0.1), { subtotal: 0, tax: 0, total: 0, taxKnown: true });
});
test('change due', () => {
  assert.equal(changeDue(null, 500), null); assert.deepEqual(changeDue(2000, 1500), { change: 500 });
  assert.deepEqual(changeDue(1500, 1500), { change: 0 }); assert.match(changeDue(1000, 1500).error, /Short by 5.00/);
});
test('margin and search', () => {
  assert.equal(lineMargin(5000, 3000), 2000); assert.equal(lineMargin(5000, null), null); assert.equal(lineMargin(1000, 3000), -2000);
  const items = [{ id: 'a', title: 'DeWalt drill', serial: 'X1' }, { id: 'b', title: 'Guitar', brand: 'Fender' }];
  assert.equal(searchItems(items, 'fender').length, 1); assert.equal(searchItems(items, 'x1')[0].id, 'a'); assert.equal(searchItems(items, '').length, 2);
});
