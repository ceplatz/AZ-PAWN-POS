// Pure SELL helpers. Money is integer cents.
import { needsSerial } from './item-logic.js';

/** Sellable now: marked for sale, or on hold with a hold date that has passed. Firearms are excluded until the A&D/4473 module exists. */
export const isSellable = (item, today) => item.status === 'for-sale' || (item.status === 'on-hold' && !!item.holdUntil && item.holdUntil <= today);
export const FIREARM_BLOCK = 'Firearms are sold from the Firearms page, which records the A&D disposition and the 4473 / NICS details.';
export const blockedReason = (item, today) => (item.isFirearm ? FIREARM_BLOCK : !isSellable(item, today) ? (item.status === 'on-hold' ? 'On hold: not sellable yet' : 'Not for sale') : null);

export const lineMargin = (price, cost) => (cost == null ? null : price - cost);

/** taxRate is a fraction or null (not set). Tax is computed on the subtotal and rounded half-up to the cent. VERIFY per-item vs per-sale rounding. */
export function computeTotals(prices, taxRate) {
  const subtotal = prices.reduce((a, b) => a + b, 0);
  const taxKnown = taxRate != null, tax = taxKnown ? Math.floor(subtotal * taxRate + 0.5) : 0;
  return { subtotal, tax, total: subtotal + tax, taxKnown };
}
/** Cash change. null if tendered is blank; { error } if short. */
export function changeDue(tenderedCents, total) {
  if (tenderedCents == null) return null;
  return tenderedCents >= total ? { change: tenderedCents - total } : { error: `Short by ${((total - tenderedCents) / 100).toFixed(2)}` };
}
/** Exact tag-barcode match (a scanner types the 10-character code). */
export const findByScan = (items, code) => (String(code).trim().length >= 10 ? items.find((i) => i.id.startsWith(String(code).trim())) || null : null);
export const searchItems = (items, q) => {
  const t = q.trim().toLowerCase(); if (!t) return items;
  return items.filter((i) => [i.title, i.brand, i.model, i.serial, i.location, i.id].join(' ').toLowerCase().includes(t));
};
