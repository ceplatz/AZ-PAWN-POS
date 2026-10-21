import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAamva, normDate } from '../js/aamva.js';

// Builds a barcode string with correct offsets (synthetic data only, not a real person).
function build(elements, { ver = '10', jur = '00' } = {}) {
  const sub = 'DL' + elements.join('\n') + '\r';
  const hdr = `@\n\x1e\rANSI 636006${ver}${jur}01DL`;
  const off = hdr.length + 8;
  return hdr + String(off).padStart(4, '0') + String(sub.length).padStart(4, '0') + sub;
}
const base = ['DAQD12345678', 'DCSDOE', 'DACJANE', 'DADQ', 'DBB03151985', 'DBA03152030', 'DAG12 MAIN ST', 'DAISALEM', 'DAJCT', 'DAK064200000', 'DCGUSA', 'DBC2'];

test('parses a standard AAMVA barcode', () => {
  const r = parseAamva(build(base));
  assert.equal(r.ok, true);
  assert.deepEqual(r.fields, { firstName: 'Jane', middleName: 'Q', lastName: 'Doe', dob: '1985-03-15', idExpiry: '2030-03-15', issued: '',
    idNumber: 'D12345678', street: '12 Main St', city: 'Salem', state: 'CT', zip: '06420', sex: 'F', country: 'USA' });
});

test('Canadian dates are CCYYMMDD', () => {
  const r = parseAamva(build(base.map((e) => e === 'DBB03151985' ? 'DBB19850315' : e === 'DCGUSA' ? 'DCGCAN' : e)));
  assert.equal(r.fields.dob, '1985-03-15');
});

test('older v1 full-name field and scanners that mangle the header', () => {
  const r = parseAamva('DAQ555\nDAADOE,JOHN,ROBERT\nDBB01022000\nDAJCT\nDCGUSA\n');
  assert.equal(r.fields.lastName, 'Doe'); assert.equal(r.fields.firstName, 'John'); assert.equal(r.fields.middleName, 'Robert');
  assert.equal(r.fields.dob, '2000-01-02');
});

test('garbage input is rejected, not guessed', () => {
  assert.equal(parseAamva('hello world').ok, false);
  assert.equal(parseAamva('').ok, false);
  assert.equal(normDate('123'), '');
});
