import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAlerts } from '../js/alerts-logic.js';
import { ageBuckets, suggestMarkdown, ruleFor, deadStock, ageOf, daysBetween } from '../js/inventory-logic.js';
import { termsFromConfig } from '../js/loans-logic.js';

const terms = termsFromConfig();
const loan = (id, origin, o = {}) => ({ id, principal: 10000, originDate: origin, terms, status: 'active', ...o });
// Owner example: Nov 1 loan matures Jan 1, defaults Jan 2.
test('loan alerts follow the owner example on the exact days', () => {
  const loans = [loan('a', '2026-11-01')];
  assert.equal(computeAlerts({ loans, items: [], today: '2026-12-27' }).maturingSoon.length, 1);        // 5 days to Jan 1
  assert.equal(computeAlerts({ loans, items: [], today: '2026-12-26' }).maturingSoon.length, 0);        // 6 days out
  const mat = computeAlerts({ loans, items: [], today: '2027-01-01' });
  assert.equal(mat.maturingSoon[0].daysLeft, 0); assert.equal(mat.defaultedToday.length, 0);
  const d = computeAlerts({ loans, items: [], today: '2027-01-02' });
  assert.equal(d.defaultedToday.length, 1); assert.equal(d.readyToForfeit.length, 1); assert.equal(d.money.interestOwed, 0);
  const later = computeAlerts({ loans, items: [], today: '2027-01-10' });
  assert.equal(later.defaultedToday.length, 0); assert.equal(later.readyToForfeit.length, 1);
});
test('money on the street counts open loans only', () => {
  const loans = [loan('a', '2026-11-01'), loan('b', '2026-11-01', { status: 'redeemed' }), loan('c', '2026-11-01', { status: 'forfeited' }), loan('d', '2026-12-01')];
  const m = computeAlerts({ loans, items: [], today: '2026-12-01' }).money;
  assert.deepEqual(m, { openLoans: 2, principalOut: 20000, interestOwed: 2500 });
});
test('hold, aging and firearm alerts', () => {
  const items = [
    { id: 1, status: 'on-hold', holdUntil: '2026-11-01' }, { id: 2, status: 'on-hold', holdUntil: '2026-10-01' }, { id: 3, status: 'on-hold', holdUntil: null },
    { id: 4, status: 'for-sale', acquiredDate: '2026-10-02' },   // exactly 30 days on 11-01
    { id: 5, status: 'for-sale', acquiredDate: '2026-10-03' }, { id: 6, status: 'sold', acquiredDate: '2026-10-02' },
    { id: 7, isFirearm: true, status: 'for-sale' }, { id: 8, isFirearm: true, adEntryId: 'x', status: 'for-sale' }];
  const a = computeAlerts({ loans: [], items, today: '2026-11-01' });
  assert.deepEqual([a.holdEndingToday.length, a.holdEnded.length, a.holdNotSet.length], [1, 1, 1]);
  assert.deepEqual(a.agingHits.map((x) => [x.item.id, x.threshold]), [[4, 30]]);
  assert.deepEqual(a.needsAd.map((i) => i.id), [7]);
});
test('police-report pending counts purchases and loans', () => {
  const a = computeAlerts({ loans: [loan('a', '2026-11-01', { policeReport: { status: 'pending' } })], items: [], purchases: [{ policeReport: { status: 'pending' } }, { policeReport: { status: 'done' } }, {}], today: '2026-11-02' });
  assert.equal(a.policePending, 2);
});
test('aging buckets, markdown suggestions, dead stock', () => {
  const t = '2027-06-01', mk = (days, o = {}) => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - days); return { status: 'for-sale', acquiredDate: d.toISOString().slice(0, 10), costBasis: 2000, askPrice: 5000, ...o }; };
  const items = [mk(10), mk(45), mk(75), mk(120), mk(200), mk(400), mk(5, { status: 'sold' }), { status: 'for-sale' }];
  const { buckets, unknown } = ageBuckets(items, t);
  assert.deepEqual(buckets.map((b) => b.count), [1, 1, 1, 1, 1, 1]); assert.equal(unknown, 1); assert.equal(buckets[0].cost, 2000); assert.equal(buckets[5].retail, 5000);
  assert.equal(ruleFor(30).pct, 0); assert.equal(ruleFor(31).pct, 0); assert.equal(ruleFor(61).pct, 5); assert.equal(ruleFor(366).pct, 50);
  assert.equal(suggestMarkdown(mk(10), t), null);
  assert.deepEqual(suggestMarkdown(mk(120), t), { age: 120, label: '91-180 days', action: 'Recommend markdown', pct: 15, from: 5000, to: 4300, belowCost: false });
  assert.equal(suggestMarkdown(mk(400, { askPrice: 3000 }), t).belowCost, true);
  assert.equal(suggestMarkdown({ status: 'for-sale', askPrice: 100 }, t), null);
  assert.equal(deadStock(items, t).length, 1); assert.equal(daysBetween('2026-12-31', '2027-01-02'), 2); assert.equal(ageOf({}, t), null);
});
