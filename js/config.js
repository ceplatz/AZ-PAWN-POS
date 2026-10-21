// Single source of truth for shop-specific settings. Every legal/regulatory value
// is a config field flagged VERIFY: confirm with the owner (Regan), a CT attorney,
// and ATF (firearms) before relying on it. Nothing here is a confirmed legal value.
export const CONFIG = {
  shop: {
    name: 'AZ Pawn of Salem', // VERIFY exact legal/business name
    address: '', licenseNumbers: { pawn: '', ffl: '' }, // owner to supply
    phone: '', taxRate: null,   // taxRate is a fraction (0.0635 = 6.35%). VERIFY
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
    receiptStatement: '',         // seller's ownership statement on purchase receipts: owner/attorney supplies. VERIFY
    firstBuyNumber: 5001,
    firstSaleNumber: 9001,
  },
  compliance: {
    minSellerAge: null,           // minimum age to pawn/sell to the shop; null = not enforced. VERIFY
    resaleHoldDays: null,         // VERIFY CT/municipal hold length; null = not confirmed
    policeReporting: { vendor: null }, // LeadsOnline / BWI / local PD. VERIFY
    verified: false,              // ticket content verified (set from Settings); never show "compliant" labels while false
    firearmsVerified: false,      // firearms settings verified with ATF guidance / firearms attorney
    loanTermsVerified: false,     // loan rate/term verified by owner/counsel (set from Settings)
  },
  // Firearms (FFL). EVERY value here is VERIFY with ATF guidance / a firearms attorney. Nothing is assumed compliant.
  firearms: {
    types: ['Pistol', 'Revolver', 'Rifle', 'Shotgun', 'Receiver / frame', 'Other'],   // VERIFY against the A&D book format you must use
    handgunTypes: ['Pistol', 'Revolver'],
    checklist: [],                 // owner-defined required steps at transfer (e.g. CT permit/eligibility, waiting period). VERIFY
    minAgeHandgun: null, minAgeLongGun: null,   // null = not enforced. VERIFY
    multipleHandgunDays: null,     // alert when the same buyer gets a 2nd handgun within N days; null = off. VERIFY
    require4473Image: false,       // require a photo/scan of the completed 4473
    redemptionNeedsTransfer: true, // pawned firearms returned to the customer go through the transfer flow. VERIFY (conservative default)
  },
  // Business (not legal) defaults for the alert engine and markdown suggestions. Tunable; not VERIFY items.
  alerts: { maturingDays: 5, agingThresholds: [30, 60, 90, 180, 365] },
  markdown: [   // minDays = item age on the floor; pct = suggested markdown off the asking price
    { minDays: 0, label: '0-30 days', action: 'Hold price', pct: 0 },
    { minDays: 31, label: '31-60 days', action: 'Watch', pct: 0 },
    { minDays: 61, label: '61-90 days', action: 'Consider a small markdown', pct: 5 },
    { minDays: 91, label: '91-180 days', action: 'Recommend markdown', pct: 15 },
    { minDays: 181, label: '181-365 days', action: 'Aggressive markdown', pct: 30 },
    { minDays: 366, label: '365+ days', action: 'Dead stock: move or liquidate', pct: 50 },
  ],
  roles: ['owner', 'manager', 'staff'],
};
