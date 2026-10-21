// Pure loan helpers (no Firebase) around the loan engine. Dates are shop-local 'YYYY-MM-DD' strings; money is cents.
import { CONFIG } from './config.js';
import { payoff, accruedInterest, maturityDate, forfeitureDate, statusAsOf } from './loan-engine.js';

/** Today's date in the shop's timezone (Eastern), not the device's. */
export const todayET = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: CONFIG.shop.timezone });

/** Snapshot the loan rules onto each loan at issue time so later config changes never alter an existing loan. */
export const termsFromConfig = (c = CONFIG.loan) => ({ monthlyRate: c.monthlyRate, termMonths: c.termMonths, accrualMode: c.accrualMode,
  graceDays: c.graceDays, rounding: c.rounding, renewalsAllowed: c.renewalsAllowed, forfeitureCostBasis: c.forfeitureCostBasis });

/** Split a principal across n collateral items (cents). Remainder goes to the first items so the total is exact. */
export function splitCost(principal, n) {
  const base = Math.floor(principal / n), extra = principal - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Everything the screens need to show about a loan on a given day. */
export function summarize(loan, asOf = todayET()) {
  const t = loan.terms;
  return { interest: accruedInterest(loan, asOf, t), payoff: payoff(loan, asOf, t), maturity: maturityDate(loan, t),
    forfeitAfter: forfeitureDate(loan, t), status: statusAsOf(loan, asOf, t) };
}

/** What a loan would look like if issued today (for the confirm screen). */
export function previewTerms(principal, originDate = todayET(), terms = termsFromConfig()) {
  const l = { principal, originDate, terms };
  return { maturity: maturityDate(l, terms), forfeitAfter: forfeitureDate(l, terms), payoffAtMaturity: payoff(l, maturityDate(l, terms), terms) };
}

export const STATUS_LABEL = { active: 'Active', 'maturing-soon': 'Maturing soon', overdue: 'Overdue', defaulted: 'Ready to forfeit', redeemed: 'Redeemed', forfeited: 'Forfeited' };
