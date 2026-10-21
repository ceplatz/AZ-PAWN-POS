// Single source of truth for shop-specific settings. Every legal/regulatory value
// is a config field flagged VERIFY: confirm with the owner (Regan), a CT attorney,
// and ATF (firearms) before relying on it. Nothing here is a confirmed legal value.
export const CONFIG = {
  shop: {
    name: 'AZ Pawn of Salem', // VERIFY exact legal/business name
    address: '', licenseNumbers: { pawn: '', ffl: '' }, // owner to supply
    timezone: 'America/New_York', locale: 'en-US', currency: 'USD',
  },
  loan: {
    monthlyRate: 0.25,            // VERIFY against current CT statute
    termMonths: 2,                // owner: "60 days"; his Nov 1 -> Jan 1 example is 2 calendar months. VERIFY
    accrualMode: 'per-completed-month', // 'per-completed-month' | 'per-started-month' | 'per-diem'. VERIFY
    graceDays: 0,                 // item forfeits the day AFTER maturity + graceDays. VERIFY
    forfeitureCostBasis: 'principal', // 'principal' | 'principal+fees'. VERIFY
    renewalsAllowed: null,        // null = unknown; engine allows renewals until set. VERIFY
    rounding: 'half-up',          // applied to cents. VERIFY
  },
  ticket: {
    firstNumber: 1001,
    disclosureText: '',           // REQUIRED state disclosures: owner/attorney supplies the exact text. VERIFY
  },
  compliance: {
    resaleHoldDays: null,         // VERIFY CT/municipal hold length; null = not confirmed
    policeReporting: { vendor: null }, // LeadsOnline / BWI / local PD. VERIFY
    verified: false,              // never show "compliant" labels while false
  },
  roles: ['owner', 'manager', 'staff'],
};
