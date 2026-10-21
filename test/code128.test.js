import test from 'node:test';
import assert from 'node:assert/strict';
import { codeValues, widths, barcodeSvg } from '../js/code128.js';

test('Code 128B known values: start, data, checksum, stop', () => {
  // "PJJ123C" is the standard worked example for subset B (check = 54... computed by hand below).
  const v = codeValues('Hi'); // H=40, i=73 -> sum = 104 + 40*1 + 73*2 = 290 -> 290 % 103 = 84
  assert.deepEqual(v, [104, 40, 73, 84, 106]);
  assert.deepEqual(codeValues('A'), [104, 33, (104 + 33) % 103, 106]);
});
test('every symbol is 11 modules wide, stop is 13', () => {
  const w = widths('item12345'), total = w.reduce((a, b) => a + b, 0), symbols = codeValues('item12345').length;
  assert.equal(total, (symbols - 1) * 11 + 13); assert.equal(w.length, (symbols - 1) * 6 + 7);
});
test('rejects characters it cannot encode and renders svg', () => {
  assert.throws(() => codeValues('é')); assert.throws(() => codeValues('a\tb'));
  const svg = barcodeSvg('AB12'); assert.ok(svg.startsWith('<svg') && svg.includes('<rect') && svg.includes('Barcode AB12'));
});
