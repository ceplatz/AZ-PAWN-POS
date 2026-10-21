// The daily alert engine (pure). Given loans, items and purchases it says what needs attention today.
import { CONFIG } from './config.js';
import { summarize } from './loans-logic.js';
import { daysBetween, ageOf, onFloor } from './inventory-logic.js';
import { needsAd } from './firearms-logic.js';

const OPEN = ['active', 'maturing-soon', 'overdue', 'defaulted'];

export function computeAlerts({ loans, items, purchases = [], today, cfg = CONFIG.alerts }) {
  const open = loans.map((l) => ({ l, s: summarize(l, today) })).filter((x) => OPEN.includes(x.s.status));
  const out = {
    money: { openLoans: open.length, principalOut: open.reduce((a, x) => a + x.l.principal, 0), interestOwed: open.reduce((a, x) => a + (x.s.status === 'defaulted' ? 0 : x.s.interest), 0) },
    defaultedToday: open.filter((x) => x.s.forfeitAfter === today && x.l.status === 'active').map((x) => x.l),
    readyToForfeit: open.filter((x) => x.s.status === 'defaulted').map((x) => x.l),
    overdue: open.filter((x) => x.s.status === 'overdue').map((x) => x.l),
    maturingSoon: open.filter((x) => ['active', 'maturing-soon'].includes(x.s.status) && daysBetween(today, x.s.maturity) <= cfg.maturingDays && daysBetween(today, x.s.maturity) >= 0)
      .map((x) => ({ loan: x.l, daysLeft: daysBetween(today, x.s.maturity), maturity: x.s.maturity })).sort((a, b) => a.daysLeft - b.daysLeft),
    holdEndingToday: items.filter((i) => i.status === 'on-hold' && i.holdUntil === today),
    holdEnded: items.filter((i) => i.status === 'on-hold' && i.holdUntil && i.holdUntil < today),
    holdNotSet: items.filter((i) => i.status === 'on-hold' && !i.holdUntil),
    agingHits: onFloor(items).flatMap((i) => { const a = ageOf(i, today); return a != null && cfg.agingThresholds.includes(a) ? [{ item: i, threshold: a }] : []; }),
    needsAd: needsAd(items),
    policePending: purchases.filter((p) => p.policeReport?.status === 'pending').length + loans.filter((l) => l.policeReport?.status === 'pending').length,
  };
  out.total = out.defaultedToday.length + out.readyToForfeit.length + out.overdue.length + out.maturingSoon.length + out.holdEndingToday.length + out.agingHits.length + out.needsAd.length;
  return out;
}
