// Pure item rules (no Firebase) so they are unit tested. Money is integer cents.
import { CONFIG } from './config.js';
import { todayET } from './dates.js';

export const CATEGORIES = ['Firearm', 'Jewelry', 'Electronics', 'Tools', 'Musical', 'Outdoor / Sporting', 'Collectibles', 'Other'];
export const CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'Poor'];
export const SOURCES = { bought: 'Bought', 'pawn-collateral': 'Pawn collateral', consignment: 'Consignment', forfeited: 'Forfeited' };
export const STATUSES = { 'collateral-active': 'Collateral', 'on-hold': 'On hold', 'for-sale': 'For sale', 'on-layaway': 'Layaway', sold: 'Sold', released: 'Returned to customer', scrapped: 'Scrapped' };
/** These categories must carry a serial number (stolen-goods matching / firearm records). */
export const needsSerial = (cat) => ['Firearm', 'Electronics'].includes(cat);

/** '12.50' / '$1,200' -> cents; null if not a valid amount. */
export function parseMoney(s) {
  const t = String(s ?? '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export const fmtMoney = (c) => (c == null ? '—' : (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));

/**
 * Starting status for a new item. Collateral stays collateral. Anything the shop owns goes ON HOLD
 * until the resale hold is cleared; while the legal hold length is unverified (null) it stays on hold
 * for the owner to release manually. Never guess a hold period.
 */
export function initialStatus(source, today = todayET(), days = CONFIG.compliance.resaleHoldDays) {
  if (source === 'pawn-collateral') return { status: 'collateral-active', holdUntil: null };
  if (days == null) return { status: 'on-hold', holdUntil: null };
  if (days === 0) return { status: 'for-sale', holdUntil: null };
  const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
  return { status: 'on-hold', holdUntil: d.toISOString().slice(0, 10) };
}
