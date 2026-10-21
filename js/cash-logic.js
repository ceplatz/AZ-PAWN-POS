// Cash drawer logic (pure). Money in cents.
export const DENOMS = [{ v: 10000, l: '$100' }, { v: 5000, l: '$50' }, { v: 2000, l: '$20' }, { v: 1000, l: '$10' }, { v: 500, l: '$5' }, { v: 100, l: '$1' }, { v: 25, l: '25¢' }, { v: 10, l: '10¢' }, { v: 5, l: '5¢' }, { v: 1, l: '1¢' }];
export const countTotal = (counts) => DENOMS.reduce((t, d) => t + d.v * Math.max(0, Math.floor(Number(counts?.[d.v]) || 0)), 0);

/**
 * Expected cash in the drawer = opening float + cash in - cash out for the day (from the day's report).
 * `opening` is the counted total from today's opening count, else yesterday's closing count, else null (unknown).
 */
export function expectedCash(opening, dayReport) {
  if (opening == null) return null;
  return opening + dayReport.cash.net;
}
export function variance(counted, expected) {
  if (expected == null) return null;
  const v = counted - expected;
  return { amount: v, status: v === 0 ? 'balanced' : v > 0 ? 'over' : 'short' };
}
/** Opening float for a date: today's 'open' count if present, else the most recent earlier 'close' count. */
export function openingFloat(counts, date) {
  const today = counts.filter((c) => c.date === date && c.kind === 'open').sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (today) return { total: today.total, source: 'opening count today' };
  const prev = counts.filter((c) => c.date < date && c.kind === 'close').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.at < b.at ? 1 : -1))[0];
  return prev ? { total: prev.total, source: `closing count on ${prev.date}` } : { total: null, source: 'none' };
}
