// Pure reporting logic: loans, inventory, sales, customers, employee scorecards. Money in cents; dates 'YYYY-MM-DD'.
// Costs/margins use the cost basis recorded on each sale line; lines without a cost are counted separately, never guessed.
import { summarize } from './loans-logic.js';
import { ageBuckets, deadStock, daysBetween, onFloor, ageOf } from './inventory-logic.js';

const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (f(x) || 0), 0);
const rate = (a, b) => (b ? a / b : null);
const avg = (a) => (a.length ? sum(a) / a.length : null);
const group = (arr, key) => arr.reduce((m, x) => { const k = key(x) ?? 'unknown'; (m[k] ||= []).push(x); return m; }, {});
const empKey = (x) => x.createdByEmail || x.employeeEmail || 'unknown';

// ---------------- loans ----------------
export function loanStats(loans, txs, today) {
  const st = loans.map((l) => ({ l, s: summarize(l, today) })), byStatus = {};
  st.forEach((x) => { byStatus[x.s.status] = (byStatus[x.s.status] || 0) + 1; });
  const red = loans.filter((l) => l.status === 'redeemed'), forf = loans.filter((l) => l.status === 'forfeited'), closed = red.length + forf.length;
  const days = red.filter((l) => l.closedDate).map((l) => daysBetween(l.issuedDate || l.originDate, l.closedDate));
  const ltvs = loans.filter((l) => l.itemSummaries?.length && l.itemSummaries.every((i) => i.estValue > 0)).map((l) => l.principal / sum(l.itemSummaries, (i) => i.estValue));
  const cats = {};
  for (const l of loans.filter((x) => ['redeemed', 'forfeited'].includes(x.status))) for (const c of new Set((l.itemSummaries || []).map((i) => i.category))) { const o = (cats[c] ||= { redeemed: 0, forfeited: 0 }); o[l.status]++; }
  return { total: loans.length, byStatus, redemptionRate: rate(red.length, closed), forfeitureRate: rate(forf.length, closed), avgLoan: avg(loans.map((l) => l.principal)), avgDaysToRedeem: avg(days),
    interestIncome: sum(txs.filter((t) => t.type === 'redemption'), (t) => t.interest) + sum(txs.filter((t) => t.type === 'renewal'), (t) => t.amount),
    forfeitureValue: sum(forf, (l) => l.principal), avgLtv: avg(ltvs), ltvSample: ltvs.length,
    byCategory: Object.entries(cats).map(([category, o]) => ({ category, ...o, redemptionRate: rate(o.redeemed, o.redeemed + o.forfeited) })).sort((a, b) => (b.redeemed + b.forfeited) - (a.redeemed + a.forfeited)) };
}

// ---------------- inventory ----------------
export function inventoryStats(items, sales, today, { targetMarginPct = 20 } = {}) {
  const floor = onFloor(items), cost = sum(floor, (i) => i.costBasis), retail = sum(floor, (i) => i.askPrice);
  const lines = sales.flatMap((s) => s.lines || []), costed = lines.filter((l) => l.costBasis != null);
  const margin = (ls) => ({ count: ls.length, revenue: sum(ls, (l) => l.price), cogs: sum(ls, (l) => l.costBasis), margin: sum(ls, (l) => l.price - (l.costBasis || 0)) });
  const mk = (map) => Object.entries(map).map(([k, ls]) => { const m = margin(ls); return { key: k, ...m, marginPct: rate(m.margin, m.revenue) }; }).sort((a, b) => b.margin - a.margin);
  const sold = items.filter((i) => i.status === 'sold' && i.soldDate && i.acquiredDate), byCat = group(items.filter((i) => ['sold', 'for-sale', 'on-hold'].includes(i.status)), (i) => i.category);
  const turn = Object.entries(byCat).map(([category, its]) => { const s = its.filter((i) => i.status === 'sold'), d = s.filter((i) => i.soldDate && i.acquiredDate).map((i) => daysBetween(i.acquiredDate, i.soldDate));
    return { category, sold: s.length, onFloor: its.length - s.length, sellThrough: rate(s.length, its.length), avgDaysToSell: avg(d) }; }).sort((a, b) => b.sold - a.sold);
  const realized = sum(costed, (l) => l.price - l.costBasis);
  return { units: floor.length, cost, retail, unrealized: sum(floor.filter((i) => i.costBasis != null && i.askPrice != null), (i) => i.askPrice - i.costBasis),
    ...ageBuckets(items, today), deadStock: deadStock(items, today), bySource: mk(group(costed, (l) => l.source)), byCategory: mk(group(costed, (l) => l.category)), turn,
    belowTarget: floor.filter((i) => i.askPrice > 0 && i.costBasis != null && (i.askPrice - i.costBasis) / i.askPrice * 100 < targetMarginPct),
    gmroi: cost ? realized / cost : null, linesWithoutCost: lines.length - costed.length, avgDaysToSell: avg(sold.map((i) => daysBetween(i.acquiredDate, i.soldDate))) };
}

// ---------------- sales / cash over a range ----------------
export function salesStats(sales, txs, from, to) {
  const inR = sales.filter((s) => s.date >= from && s.date <= to), lines = inR.flatMap((s) => (s.lines || []).map((l) => ({ ...l, _s: s })));
  const costed = lines.filter((l) => l.costBasis != null), revenue = sum(inR, (s) => s.subtotal), cogs = sum(costed, (l) => l.costBasis), costedRev = sum(costed, (l) => l.price);
  const byDayMap = {}; for (const s of inR) { const o = (byDayMap[s.date] ||= { date: s.date, total: 0, count: 0 }); o.total += s.total; o.count++; }
  const byDay = []; for (let d = from; d <= to; d = new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10)) byDay.push(byDayMap[d] || { date: d, total: 0, count: 0 });
  const tally = (key) => Object.entries(group(inR, key)).map(([k, ss]) => ({ key: k, count: ss.length, total: sum(ss, (s) => s.total) })).sort((a, b) => b.total - a.total);
  const buys = txs.filter((t) => t.type === 'buy' && t.date >= from && t.date <= to);
  return { count: inR.length, total: sum(inR, (s) => s.total), subtotal: revenue, tax: sum(inR, (s) => s.tax), cogs, margin: costedRev - cogs, marginPct: rate(costedRev - cogs, costedRev), avgTicket: avg(inR.map((s) => s.total)),
    byDay, byEmployee: tally(empKey), byMethod: tally((s) => s.method), byCategory: Object.entries(group(lines, (l) => l.category)).map(([k, ls]) => ({ key: k, count: ls.length, total: sum(ls, (l) => l.price) })).sort((a, b) => b.total - a.total),
    linesWithoutCost: lines.length - costed.length, buys: { count: buys.length, total: sum(buys, (t) => t.amount) } };
}

// ---------------- customers ----------------
export const TIERS = { gold: 50000, silver: 15000 };   // lifetime profit in cents; business defaults, tunable
export function customerInsights(customers, loans, sales, txs, today, { tiers = TIERS, lapsedDays = 90 } = {}) {
  const L = group(loans, (l) => l.customerId), S = group(sales.filter((s) => s.customerId), (s) => s.customerId), T = group(txs.filter((t) => t.customerId), (t) => t.customerId);
  return customers.map((c) => {
    const ls = L[c.id] || [], ss = S[c.id] || [], ts = T[c.id] || [];
    const red = ls.filter((l) => l.status === 'redeemed').length, forf = ls.filter((l) => l.status === 'forfeited').length;
    const interestPaid = sum(ts.filter((t) => t.type === 'redemption'), (t) => t.interest) + sum(ts.filter((t) => t.type === 'renewal'), (t) => t.amount);
    const spend = sum(ss, (s) => s.total), salesMargin = sum(ss.flatMap((s) => s.lines || []).filter((l) => l.costBasis != null), (l) => l.price - l.costBasis);
    const dates = [...ls.map((l) => l.issuedDate || l.originDate), ...ss.map((s) => s.date), ...ts.map((t) => t.date)].filter(Boolean).sort();
    const lastSeen = dates.length ? dates[dates.length - 1] : null, lifetimeProfit = interestPaid + salesMargin;
    const cats = {}; ls.forEach((l) => (l.itemSummaries || []).forEach((i) => { cats[i.category] = (cats[i.category] || 0) + 1; }));
    const redRate = rate(red, red + forf), tier = lifetimeProfit >= tiers.gold ? 'Gold' : lifetimeProfit >= tiers.silver ? 'Silver' : 'Standard';
    return { id: c.id, name: `${c.firstName} ${c.lastName}`, loans: ls.length, redeemed: red, forfeited: forf, redemptionRate: redRate, avgLoan: avg(ls.map((l) => l.principal)), interestPaid, spend, salesMargin, lifetimeProfit, tier,
      lastSeen, topCategories: Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]), visits: dates.length,
      flags: { doNotBuy: !!c.flags?.doNotBuy, police: !!c.flags?.police, frequentDefaults: forf >= 2 && redRate < 0.5 }, lapsing: !!lastSeen && dates.length >= 2 && daysBetween(lastSeen, today) > lapsedDays };
  }).sort((a, b) => b.lifetimeProfit - a.lifetimeProfit);
}

// ---------------- employee scorecards ----------------
export function employeeScorecards({ loans, items, sales, txs, today, hoursByEmail = {} }) {
  const emps = new Set([...loans.map(empKey), ...items.map(empKey), ...sales.map(empKey)]), loanEmp = Object.fromEntries(loans.map((l) => [l.id, empKey(l)]));
  const card = (e) => {
    const ls = loans.filter((l) => empKey(l) === e), red = ls.filter((l) => l.status === 'redeemed').length, forf = ls.filter((l) => l.status === 'forfeited').length, open = ls.filter((l) => !['redeemed', 'forfeited'].includes(l.status));
    const myTx = txs.filter((t) => t.loanId && loanEmp[t.loanId] === e), interest = sum(myTx.filter((t) => t.type === 'redemption'), (t) => t.interest) + sum(myTx.filter((t) => t.type === 'renewal'), (t) => t.amount);
    const buys = items.filter((i) => i.source === 'bought' && empKey(i) === e), sold = buys.filter((i) => i.status === 'sold'), floor = buys.filter((i) => ['for-sale', 'on-hold'].includes(i.status));
    const profit = sum(sold.filter((i) => i.costBasis != null && i.soldPrice != null), (i) => i.soldPrice - i.costBasis), rev = sum(sold.filter((i) => i.costBasis != null), (i) => i.soldPrice);
    const forfFloor = items.filter((i) => i.source === 'forfeited' && empKey(i) === e && ['for-sale', 'on-hold'].includes(i.status));
    const ss = sales.filter((s) => empKey(s) === e), sm = sum(ss.flatMap((s) => s.lines || []).filter((l) => l.costBasis != null), (l) => l.price - l.costBasis), hours = hoursByEmail[e] ?? null;
    return { employee: e,
      loans: { count: ls.length, principal: sum(ls, (l) => l.principal), avgSize: avg(ls.map((l) => l.principal)), redeemed: red, forfeited: forf, redemptionRate: rate(red, red + forf), defaultRate: rate(forf, red + forf), interestIncome: interest, outstanding: sum(open, (l) => l.principal) },
      buys: { count: buys.length, spent: sum(buys, (i) => i.costBasis), sold: sold.length, profit, marginPct: rate(profit, rev), onFloor: floor.length, onFloorPct: rate(floor.length, buys.length), floorCost: sum(floor, (i) => i.costBasis),
        avgDaysToSell: avg(sold.filter((i) => i.soldDate && i.acquiredDate).map((i) => daysBetween(i.acquiredDate, i.soldDate))), avgFloorAge: avg(floor.map((i) => ageOf(i, today)).filter((a) => a != null)), sellThrough: rate(sold.length, buys.length) },
      forfeitedOnFloor: { count: forfFloor.length, cost: sum(forfFloor, (i) => i.costBasis) },
      sales: { count: ss.length, total: sum(ss, (s) => s.total), margin: sm }, hours, salesPerHour: hours ? sum(ss, (s) => s.total) / hours : null };
  };
  const cards = [...emps].filter((e) => e !== 'unknown').map(card);
  const ranked = cards.filter((c) => c.buys.count > 0).sort((a, b) => (b.buys.sellThrough - a.buys.sellThrough) || ((a.buys.avgDaysToSell ?? 1e9) - (b.buys.avgDaysToSell ?? 1e9)));
  return { cards, goodBuys: ranked };
}
