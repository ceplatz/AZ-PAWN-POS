// Pure firearms record logic (A&D book + transfer checks). This SUPPORTS recordkeeping; it does not make anything compliant.
// Every rule that is a legal determination comes from settings (CONFIG.firearms) and is blank/unenforced until the owner sets it.
import { ageOn } from './seller-check.js';

export const NICS_RESULTS = ['Proceed', 'Delayed', 'Denied', 'Cancelled'];
export const SOURCE_TYPES = { customer: 'Bought from a customer', pawn: 'Taken as pawn collateral', forfeited: 'Forfeited pawn', dealer: 'From another dealer (FFL)', other: 'Other' };

const t = (v) => String(v ?? '').trim();

/** A&D acquisition form -> { errors, value }. */
export function validateAcquisition(f) {
  const errors = [];
  if (!t(f.date)) errors.push('Acquisition date is required.');
  if (!SOURCE_TYPES[f.sourceType]) errors.push('Choose where the firearm came from.');
  for (const [k, label] of [['manufacturer', 'Manufacturer / importer'], ['model', 'Model'], ['serial', 'Serial number'], ['type', 'Type'], ['caliber', 'Caliber / gauge']]) if (!t(f[k])) errors.push(`${label} is required.`);
  if (!t(f.sourceName)) errors.push('Source name is required.');
  if (!t(f.sourceAddress)) errors.push('Source address is required.');
  if (f.sourceType === 'dealer' && !t(f.sourceFfl)) errors.push('The other dealer\'s FFL number is required.');
  const value = { date: t(f.date), sourceType: f.sourceType, sourceName: t(f.sourceName), sourceAddress: t(f.sourceAddress), sourceFfl: t(f.sourceFfl), sourceCustomerId: f.sourceCustomerId || null,
    manufacturer: t(f.manufacturer), importer: t(f.importer), model: t(f.model), serial: t(f.serial), type: t(f.type), caliber: t(f.caliber) };
  return { ok: errors.length === 0, errors, value };
}

/**
 * Transfer (sale or pawn return) checks. Returns { errors, block }.
 * `block` is a hard stop (NICS not Proceed, buyer under a configured age); `errors` are missing items to complete.
 */
export function validateTransfer(f, { cfg, today, buyer, ids = {}, item, hasAd }) {
  const errors = []; let block = null;
  if (!hasAd) errors.push('This firearm has no A&D book entry yet. Add it first.');
  if (!buyer) errors.push('Choose the buyer.');
  else {
    if (ids.idExpiry && ids.idExpiry < today) errors.push('The buyer\'s ID is expired.');
    if (!ids.idNumber) errors.push('The buyer has no ID on file.');
    const hand = cfg.handgunTypes.includes(item?.firearmType), min = hand ? cfg.minAgeHandgun : cfg.minAgeLongGun, age = ageOn(buyer.dob, today);
    if (min != null && (age == null || age < min)) block = `Buyer is under the minimum age of ${min} for this firearm type. Do not proceed.`;
  }
  if (!f.idVerified) errors.push('Confirm the buyer\'s ID was checked against the person.');
  if (!f.form4473Done) errors.push('Form 4473 must be completed and signed.');
  cfg.checklist.forEach((c, i) => { if (!f.checks?.[i]) errors.push(`Required step not confirmed: ${c}`); });
  if (!NICS_RESULTS.includes(f.nicsResult)) errors.push('Choose the NICS result.');
  else if (f.nicsResult !== 'Proceed') block = block || `NICS result is "${f.nicsResult}". This firearm cannot be transferred.`;
  if (!t(f.nicsNumber)) errors.push('Enter the NICS transaction number.');
  if (cfg.require4473Image && !f.hasImage) errors.push('Attach a photo of the completed Form 4473.');
  return { errors, block };
}

/** Alert (not a block) when this buyer would get another handgun within N days. Calendar days; VERIFY against the legal business-day rule. */
export function multipleHandgunAlert({ transfers, buyerId, itemType, today, cfg }) {
  if (cfg.multipleHandgunDays == null || !cfg.handgunTypes.includes(itemType)) return null;
  const from = new Date(today + 'T00:00:00Z'); from.setUTCDate(from.getUTCDate() - cfg.multipleHandgunDays); const cut = from.toISOString().slice(0, 10);
  const prior = transfers.filter((x) => x.buyerId === buyerId && cfg.handgunTypes.includes(x.firearmType) && x.date >= cut).length;
  return prior ? `This buyer already received ${prior} handgun(s) in the last ${cfg.multipleHandgunDays} days. A multiple-handgun-sale report may be required (VERIFY with ATF / counsel).` : null;
}

export const needsAd = (items) => items.filter((i) => i.isFirearm && !i.adEntryId && i.status !== 'scrapped');

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
/** Printable/exportable A&D book rows. */
export function adToCsv(entries) {
  const head = ['Entry #', 'Acq date', 'Source type', 'Source name', 'Source address', 'Source FFL', 'Manufacturer/importer', 'Model', 'Serial', 'Type', 'Caliber/gauge',
    'Disp date', 'Transferee', 'Transferee address', 'Transferee ID', 'NICS #', '4473 ref'];
  const rows = entries.map((e) => [e.entryNumber, e.acq.date, SOURCE_TYPES[e.acq.sourceType], e.acq.sourceName, e.acq.sourceAddress, e.acq.sourceFfl,
    [e.acq.manufacturer, e.acq.importer].filter(Boolean).join(' / '), e.acq.model, e.acq.serial, e.acq.type, e.acq.caliber,
    e.disp?.date, e.disp?.name, e.disp?.address, e.disp?.idRef, e.disp?.nicsNumber, e.disp?.transferId]);
  return [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
