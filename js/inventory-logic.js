// Pure inventory aging / markdown logic. Money is integer cents; dates are shop-local 'YYYY-MM-DD'.
import { CONFIG } from './config.js';

const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
export const daysBetween = (from, to) => dayNum(to) - dayNum(from);
/** Items physically on the floor and available (or soon available): for sale, or on hold. */
export const onFloor = (items) => items.filter((i) => ['for-sale', 'on-hold'].includes(i.status));
export const ageOf = (item, today) => (item.acquiredDate ? Math.max(0, daysBetween(item.acquiredDate, today)) : null);

/** Which markdown rule applies at this age (the last rule whose minDays <= age). */
export function ruleFor(age, rules = CONFIG.markdown) {
  let hit = rules[0]; for (const r of rules) if (age >= r.minDays) hit = r; return hit;
}

/** Counts, cost and retail value per age bucket. Items with no acquired date are listed separately, not guessed. */
export function ageBuckets(items, today, rules = CONFIG.markdown) {
  const buckets = rules.map((r) => ({ label: r.label, action: r.action, pct: r.pct, count: 0, cost: 0, retail: 0 })); let unknown = 0;
  for (const i of onFloor(items)) {
    const a = ageOf(i, today); if (a == null) { unknown++; continue; }
    const r = ruleFor(a, rules), b = buckets[rules.indexOf(r)]; b.count++; b.cost += i.costBasis || 0; b.retail += i.askPrice || 0;
  }
  return { buckets, unknown };
}

/** Suggested new price: asking price less the rule's percent, rounded to the nearest whole dollar. Never auto-applied. */
export function suggestMarkdown(item, today, rules = CONFIG.markdown) {
  const age = ageOf(item, today); if (age == null || item.askPrice == null) return null;
  const r = ruleFor(age, rules); if (!r.pct) return null;
  const price = Math.round((item.askPrice * (1 - r.pct / 100)) / 100) * 100;
  return { age, label: r.label, action: r.action, pct: r.pct, from: item.askPrice, to: price, belowCost: item.costBasis != null && price < item.costBasis };
}

export const deadStock = (items, today, days = 365) => onFloor(items).filter((i) => (ageOf(i, today) ?? -1) > days);
