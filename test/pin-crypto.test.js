import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecord, checkPin, nextState, lockedMs, validPin, MAX_FAILS, LOCK_MS } from '../js/pin-crypto.js';

test('correct PIN verifies, wrong PIN fails, plain PIN is not stored', async () => {
  const rec = await makeRecord('123456', 1000);
  assert.equal(await checkPin('123456', rec), true);
  assert.equal(await checkPin('123457', rec), false);
  assert.ok(!JSON.stringify(rec).includes('123456'));
});

test('same PIN gets different salts and hashes', async () => {
  const a = await makeRecord('123456', 1000), b = await makeRecord('123456', 1000);
  assert.notEqual(a.salt, b.salt); assert.notEqual(a.hash, b.hash);
});

test('PIN must be exactly 6 digits', async () => {
  assert.equal(validPin('12345'), false); assert.equal(validPin('12345a'), false); assert.equal(validPin('123456'), true);
  await assert.rejects(makeRecord('1234'));
});

test('lockout after repeated failures, reset on success', () => {
  let rec = { fails: 0, lockedUntil: 0 };
  for (let i = 0; i < MAX_FAILS - 1; i++) { rec = nextState(rec, false, 1000); assert.equal(rec.lockedUntil, 0); }
  rec = nextState(rec, false, 1000);
  assert.equal(rec.lockedUntil, 1000 + LOCK_MS);
  assert.equal(lockedMs(rec, 1000 + 1000), LOCK_MS - 1000);
  assert.equal(lockedMs(rec, 1000 + LOCK_MS + 1), 0);
  assert.deepEqual(nextState({ fails: 3 }, true), { fails: 0, lockedUntil: 0 });
});
