import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAcquisition, validateTransfer, multipleHandgunAlert, needsAd, adToCsv } from '../js/firearms-logic.js';

const cfg = { handgunTypes: ['Pistol', 'Revolver'], checklist: ['CT eligibility verified', 'Waiting period done'], minAgeHandgun: null, minAgeLongGun: null, multipleHandgunDays: null, require4473Image: false };
const acq = { date: '2026-11-01', sourceType: 'customer', sourceName: 'Jane Doe', sourceAddress: '1 A St, Salem CT', manufacturer: 'Ruger', model: '10/22', serial: 'S1', type: 'Rifle', caliber: '.22 LR' };

test('acquisition requires every A&D field; dealer needs FFL', () => {
  assert.equal(validateAcquisition(acq).ok, true);
  for (const k of ['date', 'sourceName', 'sourceAddress', 'manufacturer', 'model', 'serial', 'type', 'caliber']) assert.equal(validateAcquisition({ ...acq, [k]: ' ' }).ok, false, k);
  assert.equal(validateAcquisition({ ...acq, sourceType: 'dealer' }).ok, false);
  assert.equal(validateAcquisition({ ...acq, sourceType: 'dealer', sourceFfl: '1-23' }).ok, true);
  assert.equal(validateAcquisition({ ...acq, sourceType: 'nope' }).ok, false);
});

const base = { idVerified: true, form4473Done: true, checks: [true, true], nicsResult: 'Proceed', nicsNumber: 'N123' };
const ctx = { cfg, today: '2026-11-01', buyer: { dob: '1990-01-01' }, ids: { idNumber: 'X', idExpiry: '2030-01-01' }, item: { firearmType: 'Rifle' }, hasAd: true };
test('a complete transfer has no errors and no block', () => assert.deepEqual(validateTransfer(base, ctx), { errors: [], block: null }));
test('every missing step is reported', () => {
  assert.equal(validateTransfer({ ...base, idVerified: false }, ctx).errors.length, 1);
  assert.equal(validateTransfer({ ...base, form4473Done: false }, ctx).errors.length, 1);
  assert.equal(validateTransfer({ ...base, checks: [true, false] }, ctx).errors[0], 'Required step not confirmed: Waiting period done');
  assert.equal(validateTransfer({ ...base, nicsNumber: ' ' }, ctx).errors.length, 1);
  assert.equal(validateTransfer(base, { ...ctx, hasAd: false }).errors.length, 1);
  assert.equal(validateTransfer(base, { ...ctx, buyer: null }).errors[0], 'Choose the buyer.');
  assert.equal(validateTransfer(base, { ...ctx, ids: { idNumber: 'X', idExpiry: '2026-01-01' } }).errors.length, 1);
  assert.equal(validateTransfer(base, { ...ctx, cfg: { ...cfg, require4473Image: true } }).errors.length, 1);
});
test('anything but Proceed is a hard block', () => {
  for (const r of ['Delayed', 'Denied', 'Cancelled']) assert.match(validateTransfer({ ...base, nicsResult: r }, ctx).block, new RegExp(r));
  assert.equal(validateTransfer({ ...base, nicsResult: '' }, ctx).errors.length, 1);
});
test('age limits apply only when configured, by firearm type', () => {
  const kid = { ...ctx, buyer: { dob: '2007-06-01' } }; // 19 on 2026-11-01
  assert.equal(validateTransfer(base, kid).block, null);
  const c2 = { ...cfg, minAgeHandgun: 21, minAgeLongGun: 18 };
  assert.match(validateTransfer(base, { ...kid, cfg: c2, item: { firearmType: 'Pistol' } }).block, /minimum age of 21/);
  assert.equal(validateTransfer(base, { ...kid, cfg: c2, item: { firearmType: 'Rifle' } }).block, null);
  assert.match(validateTransfer(base, { ...kid, cfg: c2, buyer: {} }).block, /minimum age/);
});
test('multiple-handgun alert is off until configured, then counts recent handguns only', () => {
  const tr = [{ buyerId: 'b', firearmType: 'Pistol', date: '2026-10-30' }, { buyerId: 'b', firearmType: 'Rifle', date: '2026-10-31' }, { buyerId: 'x', firearmType: 'Pistol', date: '2026-10-31' }, { buyerId: 'b', firearmType: 'Pistol', date: '2026-09-01' }];
  const call = (c, type = 'Revolver') => multipleHandgunAlert({ transfers: tr, buyerId: 'b', itemType: type, today: '2026-11-01', cfg: c });
  assert.equal(call(cfg), null);
  assert.match(call({ ...cfg, multipleHandgunDays: 7 }), /already received 1 handgun/);
  assert.equal(call({ ...cfg, multipleHandgunDays: 7 }, 'Rifle'), null);
  assert.equal(call({ ...cfg, multipleHandgunDays: 1 }), null);
});
test('queue and CSV', () => {
  assert.equal(needsAd([{ isFirearm: true }, { isFirearm: true, adEntryId: 'a' }, { isFirearm: false }, { isFirearm: true, status: 'scrapped' }]).length, 1);
  const csv = adToCsv([{ entryNumber: 1, acq: { ...acq, sourceName: 'Jane "JD" Doe' }, disp: null }]);
  assert.equal(csv.split('\r\n').length, 2); assert.ok(csv.includes('"Jane ""JD"" Doe"'));
});
