// The shop's "today" is Eastern time, never the device's UTC date (otherwise evenings roll over a day early).
import { CONFIG } from './config.js';
export const todayET = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: CONFIG.shop.timezone });
