import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSettings, applySettings, toForm } from '../js/settings-logic.js';
import { CONFIG as base } from '../js/config.js';
import { payoff } from '../js/loan-engine.js';

const good = { name: 'AZ Pawn of Salem', street: '1 Main St', city: 'Salem', state: 'ct', zip: '06420', phone: '', pawnLicense: 'P-1', fflNumber: '',
  taxPct: '6.35', ratePct: '25', termMonths: '2', accrualMode: 'per-completed-month', graceDays: '0', renewalsAllowed: '', disclosureText: 'Terms...',
  resaleHoldDays: '', policeVendor: '', verifyLoan: false, verifyTicket: false };
const fresh = () => structuredClone(base);

test('valid input becomes typed values (percent -> fraction, blanks -> null)', () => {
  const r = validateSettings(good);
  assert.equal(r.ok, true, r.errors.join('|'));
  assert.equal(r.value.loan.monthlyRate, 0.25); assert.equal(r.value.taxRate, 0.0635);
  assert.equal(r.value.loan.renewalsAllowed, null); assert.equal(r.value.compliance.resaleHoldDays, null); assert.equal(r.value.shop.state, 'CT');
});
test('rejects nonsense instead of guessing', () => {
  for (const [k, v] of [['ratePct', '0'], ['ratePct', '250'], ['ratePct', 'abc'], ['termMonths', '0'], ['termMonths', '2.5'], ['graceDays', '-1'], ['accrualMode', 'x'],
    ['renewalsAllowed', 'two'], ['resaleHoldDays', '9999'], ['taxPct', '50'], ['name', ' '], ['state', 'Conn']]) {
    assert.equal(validateSettings({ ...good, [k]: v }).ok, false, `${k}=${v}`);
  }
});
test('ticket cannot be marked verified with missing license, address, or disclosure', () => {
  assert.equal(validateSettings({ ...good, verifyTicket: true }).ok, true);
  for (const k of ['pawnLicense', 'street', 'disclosureText']) assert.equal(validateSettings({ ...good, verifyTicket: true, [k]: '' }).ok, false, k);
});
test('applySettings updates CONFIG in place and the loan engine follows it', () => {
  const C = fresh(), v = validateSettings({ ...good, ratePct: '10', verifyTicket: true, resaleHoldDays: '30' }).value;
  applySettings(C, v);
  assert.equal(C.loan.monthlyRate, 0.1); assert.equal(C.shop.address, '1 Main St, Salem, CT 06420'); assert.equal(C.compliance.resaleHoldDays, 30);
  assert.equal(C.compliance.verified, true); assert.equal(C.shop.licenseNumbers.pawn, 'P-1');
  assert.equal(payoff({ principal: 10000, originDate: '2026-11-01' }, '2026-12-01', C.loan), 11000);
});
test('verified flag needs real content even if the box was ticked in stored data', () => {
  const C = fresh(); applySettings(C, { shop: { name: 'X' }, verified: { ticket: true }, ticket: { disclosureText: '' } });
  assert.equal(C.compliance.verified, false);
});
test('toForm round-trips', () => {
  const r = validateSettings({ ...good, resaleHoldDays: '14', renewalsAllowed: '3' }); assert.ok(r.ok);
  const back = toForm(r.value, base);
  assert.equal(back.ratePct, '25'); assert.equal(back.taxPct, '6.35'); assert.equal(back.resaleHoldDays, '14'); assert.equal(back.renewalsAllowed, '3');
  assert.equal(validateSettings(back).ok, true);
});
test('defaults before any settings are saved stay unverified', () => {
  const C = fresh(); applySettings(C, null);
  assert.equal(C.compliance.verified, false); assert.equal(C.compliance.resaleHoldDays, null);
});
