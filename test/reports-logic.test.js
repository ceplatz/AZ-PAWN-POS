import test from 'node:test';
import assert from 'node:assert/strict';
import { loanStats, inventoryStats, salesStats, customerInsights, employeeScorecards } from '../js/reports-logic.js';
import { termsFromConfig } from '../js/loans-logic.js';

const terms = termsFromConfig(), T = '2027-03-01';
const loan = (id, o) => ({ id, principal: 10000, originDate: '2027-01-01', issuedDate: '2027-01-01', terms, status: 'active', customerId: 'c1', createdByEmail: 'charles@x', itemSummaries: [{ category: 'Tools', estValue: 20000 }], ...o });

test('loan stats: redemption vs forfeiture, days to redeem, LTV, interest income', () => {
  const loans = [loan('1', { status: 'redeemed', closedDate: '2027-01-21' }), loan('2', { status: 'redeemed', closedDate: '2027-02-10' }), loan('3', { status: 'forfeited', closedDate: '2027-03-02', itemSummaries: [{ category: 'Jewelry' }] }), loan('4', { principal: 30000 })];
  const s = loanStats(loans, [{ type: 'redemption', interest: 2500 }, { type: 'renewal', amount: 2500 }, { type: 'sale', amount: 999 }], T);
  assert.equal(s.redemptionRate, 2 / 3); assert.equal(s.forfeitureRate, 1 / 3); assert.equal(s.avgLoan, 15000); assert.equal(s.avgDaysToRedeem, (20 + 40) / 2);
  assert.equal(s.interestIncome, 5000); assert.equal(s.forfeitureValue, 10000); assert.equal(s.ltvSample, 3); assert.equal(Math.round(s.avgLtv * 100), 83); // (0.5 + 0.5 + 1.5) / 3
  assert.deepEqual(s.byCategory.find((c) => c.category === 'Tools'), { category: 'Tools', redeemed: 2, forfeited: 0, redemptionRate: 1 });
  assert.equal(s.byStatus.redeemed, 2);
});

const item = (id, o) => ({ id, category: 'Tools', status: 'for-sale', source: 'bought', costBasis: 2000, askPrice: 5000, acquiredDate: '2027-02-01', createdByEmail: 'charles@x', ...o });
test('inventory: valuation, margin by source/category, turn, below-target, GMROI', () => {
  const items = [item('a', {}), item('b', { source: 'forfeited', askPrice: 2200 }), item('c', { status: 'sold', soldDate: '2027-02-11', soldPrice: 4000 }), item('d', { status: 'on-hold', category: 'Jewelry' })];
  const sales = [{ lines: [{ price: 4000, costBasis: 2000, source: 'bought', category: 'Tools' }, { price: 3000, costBasis: 1000, source: 'forfeited', category: 'Jewelry' }, { price: 500, costBasis: null, source: 'bought', category: 'Tools' }] }];
  const r = inventoryStats(items, sales, T);
  assert.deepEqual([r.units, r.cost, r.retail, r.unrealized], [3, 6000, 12200, 6200]);
  assert.deepEqual(r.bySource.map((x) => [x.key, x.margin, x.marginPct]), [['bought', 2000, 0.5], ['forfeited', 2000, 2 / 3]]);
  assert.equal(r.linesWithoutCost, 1); assert.equal(r.belowTarget.map((i) => i.id).join(), 'b');   // (2200-2000)/2200 = 9%
  const tools = r.turn.find((t) => t.category === 'Tools'); assert.deepEqual([tools.sold, tools.onFloor, tools.avgDaysToSell], [1, 2, 10]);
  assert.equal(r.gmroi, 4000 / 6000);
});
test('sales stats: range, zero-filled days, cogs, margin, by employee/method/category', () => {
  const lines = (p, c, cat = 'Tools') => [{ price: p, costBasis: c, category: cat }];
  const sales = [{ date: '2027-02-27', total: 1063, subtotal: 1000, tax: 63, method: 'cash', createdByEmail: 'a@x', lines: lines(1000, 600) }, { date: '2027-03-01', total: 2000, subtotal: 2000, tax: 0, method: 'card', createdByEmail: 'b@x', lines: lines(2000, null, 'Jewelry') }, { date: '2027-01-01', total: 999, subtotal: 999, tax: 0, method: 'cash', lines: [] }];
  const r = salesStats(sales, [{ type: 'buy', amount: 500, date: '2027-02-28' }, { type: 'buy', amount: 100, date: '2026-12-01' }], '2027-02-27', '2027-03-01');
  assert.deepEqual(r.byDay.map((d) => [d.date, d.total]), [['2027-02-27', 1063], ['2027-02-28', 0], ['2027-03-01', 2000]]);
  assert.deepEqual([r.count, r.total, r.subtotal, r.tax, r.cogs, r.margin], [2, 3063, 3000, 63, 600, 400]); assert.equal(r.marginPct, 0.4); assert.equal(r.linesWithoutCost, 1);
  assert.deepEqual(r.byEmployee.map((e) => e.key), ['b@x', 'a@x']); assert.deepEqual(r.buys, { count: 1, total: 500 });
});
test('customer insights: tiers, defaults, lapsing, lifetime profit', () => {
  const customers = [{ id: 'c1', firstName: 'Jane', lastName: 'Doe' }, { id: 'c2', firstName: 'Bob', lastName: 'Risky', flags: { police: true } }, { id: 'c3', firstName: 'New', lastName: 'Guy' }];
  const loans = [loan('1', { status: 'redeemed' }), loan('2', { status: 'redeemed' }), loan('3', { customerId: 'c2', status: 'forfeited', issuedDate: '2026-05-01' }), loan('4', { customerId: 'c2', status: 'forfeited', issuedDate: '2026-06-01' })];
  const sales = [{ customerId: 'c1', date: '2027-02-01', total: 20000, lines: [{ price: 20000, costBasis: 5000 }] }];
  const txs = [{ type: 'redemption', customerId: 'c1', interest: 2500, date: '2027-01-21' }, { type: 'renewal', customerId: 'c1', amount: 2500, date: '2027-01-10' }];
  const r = customerInsights(customers, loans, sales, txs, T), by = Object.fromEntries(r.map((x) => [x.id, x]));
  assert.equal(by.c1.interestPaid, 5000); assert.equal(by.c1.salesMargin, 15000); assert.equal(by.c1.lifetimeProfit, 20000); assert.equal(by.c1.tier, 'Silver'); assert.equal(by.c1.redemptionRate, 1);
  assert.equal(by.c2.flags.frequentDefaults, true); assert.equal(by.c2.flags.police, true); assert.equal(by.c2.lapsing, true); assert.equal(by.c3.lastSeen, null); assert.equal(by.c3.lapsing, false);
  assert.equal(r[0].id, 'c1');
});
test('employee scorecards: Charles 90% vs Maria 50%, buy turnover, lingering buys', () => {
  const mk = (n, st, e) => Array.from({ length: n }, (_, i) => loan(`${e}${st}${i}`, { status: st, createdByEmail: e }));
  const loans = [...mk(9, 'redeemed', 'charles@x'), ...mk(1, 'forfeited', 'charles@x'), ...mk(5, 'redeemed', 'maria@x'), ...mk(5, 'forfeited', 'maria@x'), loan('open', { createdByEmail: 'maria@x' })];
  const items = [item('c1', { status: 'sold', soldDate: '2027-02-06', soldPrice: 4000 }), item('c2', { status: 'sold', soldDate: '2027-02-11', soldPrice: 3000 }), item('m1', { createdByEmail: 'maria@x', acquiredDate: '2026-11-01' }), item('m2', { createdByEmail: 'maria@x', status: 'sold', soldDate: '2027-02-28', soldPrice: 2500 }), item('m3', { createdByEmail: 'maria@x' }),
    item('mf', { createdByEmail: 'maria@x', source: 'forfeited', costBasis: 10000 })];
  const txs = [{ type: 'redemption', loanId: 'charles@xredeemed0', interest: 2500 }, { type: 'renewal', loanId: 'maria@xredeemed1', amount: 2500 }];
  const { cards, goodBuys } = employeeScorecards({ loans, items, sales: [{ createdByEmail: 'charles@x', total: 5000, lines: [{ price: 5000, costBasis: 2000 }] }], txs, today: T, hoursByEmail: { 'charles@x': 10 } });
  const c = cards.find((x) => x.employee === 'charles@x'), m = cards.find((x) => x.employee === 'maria@x');
  assert.equal(c.loans.redemptionRate, 0.9); assert.equal(m.loans.redemptionRate, 0.5); assert.equal(m.loans.outstanding, 10000); assert.equal(c.loans.interestIncome, 2500); assert.equal(m.loans.interestIncome, 2500);
  assert.deepEqual([c.buys.count, c.buys.spent, c.buys.sold, c.buys.profit, c.buys.onFloor], [2, 4000, 2, 3000, 0]); assert.equal(c.buys.marginPct, 3000 / 7000); assert.equal(c.buys.avgDaysToSell, (5 + 10) / 2);
  assert.deepEqual([m.buys.count, m.buys.onFloor, m.buys.onFloorPct], [3, 2, 2 / 3]); assert.equal(m.forfeitedOnFloor.cost, 10000);
  assert.equal(c.sales.total, 5000); assert.equal(c.sales.margin, 3000); assert.equal(c.salesPerHour, 500); assert.equal(m.salesPerHour, null);
  assert.deepEqual(goodBuys.map((x) => x.employee), ['charles@x', 'maria@x']);
});
