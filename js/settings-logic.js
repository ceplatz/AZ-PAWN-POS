// Pure settings logic: validate form input and apply saved settings onto CONFIG. No Firebase here (unit tested).
export const ACCRUAL_MODES = { 'per-completed-month': 'Per completed month (matches the owner\'s Nov 1 example)', 'per-started-month': 'Per started month', 'per-diem': 'Per day (pro-rated)' };

const int = (s) => (/^\d+$/.test(String(s).trim()) ? Number(s) : null);
const num = (s) => (/^\d+(\.\d+)?$/.test(String(s).trim()) ? Number(s) : null);
const blankOrInt = (s) => (String(s ?? '').trim() === '' ? undefined : int(s));

/** input: raw strings/booleans from the form. Returns { ok, errors, value } where value has typed, normalized fields. */
export function validateSettings(i) {
  const errors = [];
  const bad = (m) => errors.push(m);
  const t = (k) => String(i[k] ?? '').trim();

  const ratePct = num(i.ratePct);
  if (ratePct === null || ratePct <= 0 || ratePct > 100) bad('Monthly interest must be a percent above 0 and at most 100.');
  const termMonths = int(i.termMonths);
  if (termMonths === null || termMonths < 1 || termMonths > 24) bad('Loan term must be 1 to 24 whole months.');
  const graceDays = int(i.graceDays);
  if (graceDays === null || graceDays > 60) bad('Grace days must be a whole number from 0 to 60.');
  if (!ACCRUAL_MODES[i.accrualMode]) bad('Choose how interest accrues.');
  const renewals = blankOrInt(i.renewalsAllowed);
  if (renewals === null || renewals > 50) bad('Renewals allowed must be blank (no limit) or a whole number up to 50.');
  const hold = blankOrInt(i.resaleHoldDays);
  if (hold === null || hold > 365) bad('Resale hold days must be blank (not set) or a whole number up to 365.');
  const minAge = blankOrInt(i.minSellerAge);
  if (minAge === null || minAge > 99) bad('Minimum seller age must be blank (not enforced) or a whole number up to 99.');
  const fwHand = blankOrInt(i.fwMinAgeHandgun), fwLong = blankOrInt(i.fwMinAgeLongGun), fwMult = blankOrInt(i.fwMultipleDays);
  if (fwHand === null || fwHand > 99) bad('Handgun minimum age must be blank or a whole number up to 99.');
  if (fwLong === null || fwLong > 99) bad('Long gun minimum age must be blank or a whole number up to 99.');
  if (fwMult === null || fwMult > 60) bad('Multiple-handgun alert window must be blank (off) or a whole number of days up to 60.');
  const checklist = String(i.fwChecklist ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (checklist.length > 20) bad('The firearm checklist can have at most 20 steps.');
  const taxPct = t('taxPct') === '' ? undefined : num(i.taxPct);
  if (taxPct === null || taxPct > 20) bad('Sales tax must be blank or a percent up to 20.');
  if (!t('name')) bad('Shop name is required.');
  if (t('state') && !/^[A-Za-z]{2}$/.test(t('state'))) bad('State must be 2 letters.');

  const ticketOk = !!(i.verifyTicket);
  if (ticketOk && (!t('pawnLicense') || !t('street') || !t('disclosureText') || !t('receiptStatement'))) bad('Tickets and receipts cannot be marked verified until the license number, shop address, ticket disclosure text and receipt statement are filled in.');

  const value = {
    shop: { name: t('name'), street: t('street'), city: t('city'), state: t('state').toUpperCase(), zip: t('zip'), phone: t('phone'), pawnLicense: t('pawnLicense'), fflNumber: t('fflNumber') },
    taxRate: taxPct === undefined ? null : Math.round(taxPct * 1e4) / 1e6,
    loan: { monthlyRate: Math.round((ratePct ?? 0) * 1e4) / 1e6, termMonths, accrualMode: i.accrualMode, graceDays, renewalsAllowed: renewals === undefined ? null : renewals, forfeitureCostBasis: 'principal' },
    ticket: { disclosureText: String(i.disclosureText ?? '').trim(), receiptStatement: String(i.receiptStatement ?? '').trim() },
    compliance: { minSellerAge: minAge === undefined ? null : minAge, resaleHoldDays: hold === undefined ? null : hold, policeVendor: t('policeVendor') },
    firearms: { checklist, minAgeHandgun: fwHand === undefined ? null : fwHand, minAgeLongGun: fwLong === undefined ? null : fwLong,
      multipleHandgunDays: fwMult === undefined ? null : fwMult, require4473Image: !!i.fwRequireImage, redemptionNeedsTransfer: i.fwRedemption === undefined ? true : !!i.fwRedemption },
    verified: { loan: !!i.verifyLoan, ticket: ticketOk, firearms: !!i.verifyFirearms },
  };
  return { ok: errors.length === 0, errors, value };
}

/** Writes saved settings onto the shared CONFIG object in place (modules read CONFIG at call time). */
export function applySettings(CONFIG, s) {
  if (!s) return CONFIG;
  const sh = s.shop || {};
  if (sh.name) CONFIG.shop.name = sh.name;
  CONFIG.shop.address = [sh.street, [sh.city, [sh.state, sh.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  CONFIG.shop.phone = sh.phone || '';
  CONFIG.shop.licenseNumbers = { pawn: sh.pawnLicense || '', ffl: sh.fflNumber || '' };
  if (s.taxRate !== undefined) CONFIG.shop.taxRate = s.taxRate;
  Object.assign(CONFIG.loan, s.loan || {});
  CONFIG.ticket.disclosureText = s.ticket?.disclosureText || '';
  CONFIG.ticket.receiptStatement = s.ticket?.receiptStatement || '';
  CONFIG.compliance.minSellerAge = s.compliance?.minSellerAge ?? null;
  CONFIG.compliance.resaleHoldDays = s.compliance?.resaleHoldDays ?? null;
  CONFIG.compliance.policeReporting.vendor = s.compliance?.policeVendor || null;
  CONFIG.compliance.loanTermsVerified = !!s.verified?.loan;
  CONFIG.compliance.firearmsVerified = !!s.verified?.firearms;
  if (s.firearms) Object.assign(CONFIG.firearms, s.firearms);
  // The ticket only counts as verified if the owner ticked it AND the required content is actually present.
  CONFIG.compliance.verified = !!(s.verified?.ticket && sh.pawnLicense && sh.street && CONFIG.ticket.disclosureText && CONFIG.ticket.receiptStatement);
  return CONFIG;
}

/** Inverse of validate: saved settings -> form strings. */
export function toForm(s, CONFIG) {
  const sh = s?.shop || {}, l = s?.loan || CONFIG.loan;
  return { name: sh.name ?? CONFIG.shop.name, street: sh.street ?? '', city: sh.city ?? '', state: sh.state ?? '', zip: sh.zip ?? '', phone: sh.phone ?? '',
    pawnLicense: sh.pawnLicense ?? '', fflNumber: sh.fflNumber ?? '', taxPct: s?.taxRate != null ? String(+(s.taxRate * 100).toFixed(4)) : '',
    ratePct: String(+(l.monthlyRate * 100).toFixed(4)), termMonths: String(l.termMonths), accrualMode: l.accrualMode, graceDays: String(l.graceDays),
    renewalsAllowed: l.renewalsAllowed == null ? '' : String(l.renewalsAllowed), disclosureText: s?.ticket?.disclosureText ?? '', receiptStatement: s?.ticket?.receiptStatement ?? '',
    minSellerAge: s?.compliance?.minSellerAge == null ? '' : String(s.compliance.minSellerAge),
    resaleHoldDays: s?.compliance?.resaleHoldDays == null ? '' : String(s.compliance.resaleHoldDays), policeVendor: s?.compliance?.policeVendor ?? '',
    fwChecklist: (s?.firearms?.checklist || []).join('\n'), fwMinAgeHandgun: s?.firearms?.minAgeHandgun == null ? '' : String(s.firearms.minAgeHandgun),
    fwMinAgeLongGun: s?.firearms?.minAgeLongGun == null ? '' : String(s.firearms.minAgeLongGun), fwMultipleDays: s?.firearms?.multipleHandgunDays == null ? '' : String(s.firearms.multipleHandgunDays),
    fwRequireImage: !!s?.firearms?.require4473Image, fwRedemption: s?.firearms?.redemptionNeedsTransfer ?? true,
    verifyLoan: !!s?.verified?.loan, verifyTicket: !!s?.verified?.ticket, verifyFirearms: !!s?.verified?.firearms };
}
