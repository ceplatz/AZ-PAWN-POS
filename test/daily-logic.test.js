import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReport } from '../js/daily-logic.js';

const tx = (type, amount, o = {}) => ({ type, amount, date: '2026-11-01', method: 'cash', employeeEmail: 'a@x', ...o });
test('daily report totals, cash flow, interest income, by employee', () => {
  const r = dailyReport([
    tx('sale', 5583, { subtotal: 5250, tax: 333 }), tx('sale', 1000, { subtotal: 1000, tax: 0, method: 'card', employeeEmail: 'b@x' }),
    tx('buy', 2500), tx('loan-out', 10000), tx('redemption', 12500, { principal: 10000, interest: 2500 }), tx('renewal', 2500),
    tx('sale', 999, { date: '2026-10-31' }), tx('expense', 300), tx('mystery', 5)], '2026-11-01');
  assert.deepEqual([r.sales.count, r.sales.amount, r.sales.subtotal, r.sales.tax], [2, 6583, 6250, 333]);
  assert.deepEqual(r.sales.byMethod, { cash: 5583, card: 1000 });
  assert.deepEqual([r.buys.amount, r.loansOut.amount, r.redemptions.amount, r.renewals.amount, r.expenses.amount], [2500, 10000, 12500, 2500, 300]);
  assert.deepEqual(r.cash, { in: 5583 + 12500 + 2500, out: 2500 + 10000 + 300, net: 20583 - 12800 });
  assert.deepEqual(r.card, { in: 1000, out: 0, net: 1000 });
  assert.equal(r.interestIncome, 5000); assert.equal(r.transactions, 8);
  assert.equal(r.byEmployee['b@x'].sales.amount, 1000); assert.equal(r.byEmployee['a@x'].buys.count, 1);
});
test('empty day', () => { const r = dailyReport([], '2026-11-01'); assert.equal(r.cash.net, 0); assert.equal(r.sales.count, 0); });
