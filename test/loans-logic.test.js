import test from 'node:test';
import assert from 'node:assert/strict';
import { todayET, termsFromConfig, splitCost, summarize, previewTerms } from '../js/loans-logic.js';

const loan = { principal: 10000, originDate: '2026-11-01', status: 'active', terms: termsFromConfig() };

test('splitCost keeps the exact total', () => {
  assert.deepEqual(splitCost(10000, 3), [3334, 3333, 3333]);
  assert.equal(splitCost(9999, 4).reduce((a, b) => a + b), 9999);
  assert.deepEqual(splitCost(500, 1), [500]);
});
test('summary follows the owner example using the loan\'s own terms', () => {
  assert.equal(summarize(loan, '2026-12-01').payoff, 12500);
  assert.equal(summarize(loan, '2027-01-01').payoff, 15000);
  assert.equal(summarize(loan, '2027-01-01').status, 'maturing-soon');
  assert.equal(summarize(loan, '2027-01-02').status, 'defaulted');
  assert.equal(summarize({ ...loan, status: 'redeemed' }, '2027-03-01').status, 'redeemed');
});
test('a loan keeps its snapshot even if config changes later', () => {
  const old = { ...loan, terms: { ...loan.terms, monthlyRate: 0.1 } };
  assert.equal(summarize(old, '2026-12-01').payoff, 11000);
});
test('preview and Eastern-time date', () => {
  assert.deepEqual(previewTerms(10000, '2026-11-01'), { maturity: '2027-01-01', forfeitAfter: '2027-01-02', payoffAtMaturity: 15000 });
  assert.equal(todayET(new Date('2026-11-02T03:30:00Z')), '2026-11-01'); // 11:30pm Eastern still Nov 1
});

test('defaults that read the clock work (regression: todayET must be imported, not just re-exported)', () => {
  const l = { principal: 10000, originDate: '2020-01-01', status: 'active', terms: termsFromConfig() };
  assert.equal(summarize(l).status, 'defaulted');           // no asOf argument
  assert.match(previewTerms(10000).maturity, /^\d{4}-\d{2}-\d{2}$/); // no originDate argument
});
