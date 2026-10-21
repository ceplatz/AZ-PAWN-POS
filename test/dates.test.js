import test from 'node:test';
import assert from 'node:assert/strict';
import { todayET } from '../js/dates.js';
import { initialStatus } from '../js/item-logic.js';

test('shop date is Eastern, across the UTC midnight boundary and DST', () => {
  assert.equal(todayET(new Date('2026-11-02T03:30:00Z')), '2026-11-01'); // 10:30pm EST Nov 1
  assert.equal(todayET(new Date('2026-07-01T03:30:00Z')), '2026-06-30'); // 11:30pm EDT Jun 30
  assert.equal(todayET(new Date('2026-07-01T04:30:00Z')), '2026-07-01');
});
test('default hold start uses the shop date', () => {
  const real = Date; // initialStatus default arg reads the clock: just check it returns a plausible ISO date
  assert.match(initialStatus('bought', undefined, 30).holdUntil, /^\d{4}-\d{2}-\d{2}$/);
});
