// Pure BUY helpers. Money is integer cents.
import { parseMoney, needsSerial } from './item-logic.js';

/** Validates one purchased item as typed on the form. Returns { error } or { line } with parsed cents. */
export function validateLine(v) {
  const title = String(v.title ?? '').trim();
  if (!title) return { error: 'Title is required.' };
  if (!String(v.category ?? '').trim()) return { error: 'Choose a category.' };
  const price = parseMoney(v.price);
  if (price == null) return { error: 'Enter the price paid, like 25 or 25.50.' };
  if (price === 0) return { error: 'Price paid must be more than $0.' };
  const ask = String(v.ask ?? '').trim() ? parseMoney(v.ask) : null;
  if (String(v.ask ?? '').trim() && ask === null) return { error: 'Asking price is not a valid amount.' };
  if (needsSerial(v.category) && !String(v.serial ?? '').trim()) return { error: 'A serial number is required for this category.' };
  return { line: { ...v, title, costBasis: price, askPrice: ask } };
}
export const totalPaid = (lines) => lines.reduce((sum, l) => sum + l.f.costBasis, 0);
export const hasFirearm = (lines) => lines.some((l) => l.f.category === 'Firearm');
