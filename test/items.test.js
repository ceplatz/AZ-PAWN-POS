import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, initialStatus, needsSerial } from '../js/item-logic.js';

test('parseMoney', () => {
  assert.equal(parseMoney('12.50'), 1250); assert.equal(parseMoney('$1,200'), 120000); assert.equal(parseMoney('0.1'), 10);
  assert.equal(parseMoney('abc'), null); assert.equal(parseMoney('1.234'), null); assert.equal(parseMoney(''), null);
});
test('unverified hold length keeps owned items on hold (never guesses)', () => {
  assert.deepEqual(initialStatus('bought', '2026-11-01', null), { status: 'on-hold', holdUntil: null, holdUntilMs: null });
  assert.deepEqual(initialStatus('bought', '2026-11-01', 30), { status: 'on-hold', holdUntil: '2026-12-01', holdUntilMs: Date.UTC(2026, 11, 1) + 5 * 3600 * 1000 });
  assert.deepEqual(initialStatus('bought', '2026-11-01', 0), { status: 'for-sale', holdUntil: null, holdUntilMs: null });
  assert.equal(initialStatus('pawn-collateral', '2026-11-01', null).status, 'collateral-active');
});
test('serial required for firearms and electronics', () => {
  assert.equal(needsSerial('Firearm'), true); assert.equal(needsSerial('Electronics'), true); assert.equal(needsSerial('Tools'), false);
});
