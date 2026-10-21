// "May this person pawn or sell to us right now?" Pure, shared by PAWN and BUY. Legal values come from settings, never hardcoded.
import { todayET } from './dates.js';

export function ageOn(dob, today = todayET()) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Returns { block: string|null, warnings: string[], expired: bool }. A block stops the transaction; warnings need acknowledgement. */
export function checkSeller(customer, ids = {}, { today, minAge = null } = {}) {
  const warnings = [], age = ageOn(customer.dob, today);
  const expired = !!(ids.idExpiry && ids.idExpiry < today);
  let block = null;
  if (customer.flags?.doNotBuy) block = 'DO NOT BUY flag on this customer. Do not proceed; see the owner.';
  else if (minAge != null && (age == null || age < minAge)) block = `Customer is under the minimum age of ${minAge}${age == null ? ' (date of birth missing)' : ''}. Do not proceed.`;
  if (customer.flags?.police) warnings.push('Police flag on this customer. Notify the owner before continuing.');
  if (expired) warnings.push('This customer\'s ID is EXPIRED. Get a current ID before continuing.');
  return { block, warnings, expired };
}
