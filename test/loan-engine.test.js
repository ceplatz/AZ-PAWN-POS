import test from 'node:test';
import assert from 'node:assert/strict';
import { payoff, statusAsOf, maturityDate, forfeitureDate, renew, redeem, forfeit, addMonths } from '../js/loan-engine.js';

const loan = { id: 'L1', principal: 10000, originDate: '2026-11-01', status: 'active' }; // $100.00

test("owner's worked example: Nov 1 $100 loan", () => {
  assert.equal(payoff(loan, '2026-11-01'), 10000);
  assert.equal(payoff(loan, '2026-12-01'), 12500);
  assert.equal(payoff(loan, '2027-01-01'), 15000);
  assert.equal(maturityDate(loan), '2027-01-01');
  assert.equal(forfeitureDate(loan), '2027-01-02');
  assert.equal(statusAsOf(loan, '2027-01-01'), 'maturing-soon');
  assert.equal(statusAsOf(loan, '2027-01-02'), 'defaulted');
});

test('forfeit pulls item to inventory at principal cost basis', () => {
  assert.throws(() => forfeit(loan, '2027-01-01'));
  const r = forfeit(loan, '2027-01-02');
  assert.equal(r.inventory.costBasis, 10000);
  assert.equal(r.inventory.source, 'forfeited');
  assert.equal(r.loan.status, 'forfeited');
});

test('redeem on maturity day charges $150; blocked after forfeiture', () => {
  assert.equal(redeem(loan, '2027-01-01').amountDue, 15000);
  assert.throws(() => redeem(loan, '2027-01-02'));
});

test('renewal collects interest and restarts the clock', () => {
  const { loan: n, interestPaid } = renew(loan, '2026-12-01');
  assert.equal(interestPaid, 2500);
  assert.equal(n.originDate, '2026-12-01');
  assert.equal(payoff(n, '2026-12-01'), 10000);
  assert.equal(n.renewals, 1);
});

test('month-end clamping and per-started / per-diem modes', () => {
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  const cfg = (accrualMode) => ({ monthlyRate: 0.25, termMonths: 2, graceDays: 0, rounding: 'half-up', accrualMode });
  assert.equal(payoff(loan, '2026-11-02', cfg('per-started-month')), 12500);
  assert.equal(payoff(loan, '2026-12-16', cfg('per-diem')), 13750); // 45 of 30-day month = 1.5 periods
});
