// Pawn loan math. Money is integer cents; dates are 'YYYY-MM-DD' strings (shop-local).
// All rules come from CONFIG.loan, so nothing legal is hardcoded here.
import { CONFIG } from './config.js';

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const fmt = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Add calendar months, clamping the day (Jan 31 + 1mo = Feb 28/29). */
export function addMonths(date, n) {
  const { y, m, d } = parse(date);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12), nm = (t % 12) + 1;
  return fmt({ y: ny, m: nm, d: Math.min(d, dim(ny, nm)) });
}
export function addDays(date, n) {
  const { y, m, d } = parse(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const dayNum = (s) => { const { y, m, d } = parse(s); return Date.UTC(y, m - 1, d) / 86400000; };

/** Whole calendar months fully elapsed from `from` to `to` (0 if to < from). */
function completedMonths(from, to) {
  let n = 0;
  while (addMonths(from, n + 1) <= to) n++;
  return n;
}

const round = (x, mode) => (mode === 'half-up' ? Math.floor(x + 0.5) : Math.round(x));

/** Interest owed (cents) on `loan` as of `asOf`, per cfg.accrualMode. */
export function accruedInterest(loan, asOf, cfg = CONFIG.loan) {
  if (asOf <= loan.originDate) return 0;
  const monthly = loan.principal * cfg.monthlyRate;
  switch (cfg.accrualMode) {
    case 'per-completed-month':
      return round(monthly * completedMonths(loan.originDate, asOf), cfg.rounding);
    case 'per-started-month': {
      const done = completedMonths(loan.originDate, asOf);
      const started = addMonths(loan.originDate, done) < asOf || done === 0 ? done + 1 : done;
      return round(monthly * started, cfg.rounding);
    }
    case 'per-diem': {
      const days = dayNum(asOf) - dayNum(loan.originDate);
      const monthLen = dayNum(addMonths(loan.originDate, 1)) - dayNum(loan.originDate);
      return round((monthly * days) / monthLen, cfg.rounding);
    }
    default: throw new Error(`Unknown accrualMode: ${cfg.accrualMode}`);
  }
}

export const payoff = (loan, asOf, cfg) => loan.principal + accruedInterest(loan, asOf, cfg);
export const maturityDate = (loan, cfg = CONFIG.loan) => addMonths(loan.originDate, cfg.termMonths);

/** Active loans forfeit the day after maturity + grace. */
export const forfeitureDate = (loan, cfg = CONFIG.loan) => addDays(maturityDate(loan, cfg), cfg.graceDays + 1);

/** Derived status for an open loan as of a date (stored terminal states win). */
export function statusAsOf(loan, asOf, cfg = CONFIG.loan, soonDays = 5) {
  if (['redeemed', 'forfeited'].includes(loan.status)) return loan.status;
  const mat = maturityDate(loan, cfg);
  if (asOf >= forfeitureDate(loan, cfg)) return 'defaulted';
  if (asOf > mat) return 'overdue';
  if (dayNum(mat) - dayNum(asOf) <= soonDays) return 'maturing-soon';
  return 'active';
}

export function redeem(loan, asOf, cfg) {
  if (statusAsOf(loan, asOf, cfg) === 'defaulted') throw new Error('Loan is past forfeiture; cannot redeem');
  return { ...loan, status: 'redeemed', closedDate: asOf, amountDue: payoff(loan, asOf, cfg) };
}

/** Renewal: customer pays accrued interest; same principal, clock restarts. */
export function renew(loan, asOf, cfg = CONFIG.loan) {
  if (cfg.renewalsAllowed !== null && (loan.renewals || 0) >= cfg.renewalsAllowed) throw new Error('Renewal limit reached');
  if (statusAsOf(loan, asOf, cfg) === 'defaulted') throw new Error('Loan is past forfeiture; cannot renew');
  const interestPaid = accruedInterest(loan, asOf, cfg);
  return { loan: { ...loan, originDate: asOf, renewals: (loan.renewals || 0) + 1, status: 'active' }, interestPaid };
}

/** Forfeiture: item becomes shop inventory, cost basis per config. */
export function forfeit(loan, asOf, cfg = CONFIG.loan) {
  if (statusAsOf(loan, asOf, cfg) !== 'defaulted') throw new Error('Loan not yet eligible for forfeiture');
  return {
    loan: { ...loan, status: 'forfeited', closedDate: asOf },
    inventory: { source: 'forfeited', status: 'for-sale', costBasis: loan.principal, // 'principal+fees' not yet modeled: VERIFY
      holdUntil: null /* set from CONFIG.compliance.resaleHoldDays once verified */, loanId: loan.id },
  };
}
