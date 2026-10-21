import test from 'node:test';
import assert from 'node:assert/strict';
import { hoursBetween, hoursByEmployee, openEntry, fmtHours, suspicious } from '../js/timeclock-logic.js';
import { countTotal, expectedCash, variance, openingFloat, DENOMS } from '../js/cash-logic.js';
import { visibleTo, unreadCount, audienceFor } from '../js/messages-logic.js';
import { nowET, dueReminders, validReminder, logKey } from '../js/reminders-logic.js';
import { pending, reportCsv } from '../js/compliance-logic.js';

test('time clock hours, open shifts, fmt', () => {
  assert.equal(hoursBetween('2026-11-02T13:00:00Z', '2026-11-02T21:30:00Z'), 8.5);
  const e = [{ employeeUid: 'u1', employeeEmail: 'a@x', date: '2026-11-02', inAt: '2026-11-02T13:00:00Z', outAt: '2026-11-02T21:00:00Z' }, { employeeUid: 'u1', employeeEmail: 'a@x', date: '2026-11-03', inAt: '2026-11-03T13:00:00Z', outAt: null }, { employeeUid: 'u2', employeeEmail: 'b@x', date: '2026-10-01', inAt: '2026-10-01T13:00:00Z', outAt: '2026-10-01T14:00:00Z' }];
  const r = hoursByEmployee(e, '2026-11-01', '2026-11-30', '2026-11-03T17:00:00Z');
  assert.deepEqual(r, [{ email: 'a@x', hours: 12, shifts: 2, open: true }]); assert.equal(openEntry(e, 'u1').date, '2026-11-03'); assert.equal(openEntry(e, 'u2'), null);
  assert.equal(fmtHours(8.5), '8h 30m'); assert.equal(fmtHours(0.1), '0h 06m'); assert.equal(suspicious(e, '2026-11-04T13:00:00Z').length, 1);
});
test('cash: denominations, expected, variance, opening float', () => {
  assert.equal(countTotal({ 10000: 2, 2000: 3, 25: 4, 1: 7 }), 20000 + 6000 + 100 + 7); assert.equal(countTotal({ 100: -3, 5: 'x' }), 0); assert.equal(DENOMS.length, 10);
  const day = { cash: { net: 4500 } };
  assert.equal(expectedCash(20000, day), 24500); assert.equal(expectedCash(null, day), null);
  assert.deepEqual(variance(24400, 24500), { amount: -100, status: 'short' }); assert.equal(variance(24500, 24500).status, 'balanced'); assert.equal(variance(24600, 24500).status, 'over'); assert.equal(variance(1, null), null);
  const counts = [{ date: '2026-11-01', kind: 'close', total: 30000, at: 'b' }, { date: '2026-11-01', kind: 'close', total: 29000, at: 'a' }, { date: '2026-10-30', kind: 'close', total: 1, at: 'a' }, { date: '2026-11-02', kind: 'open', total: 31000, at: 'a' }];
  assert.deepEqual(openingFloat(counts, '2026-11-02'), { total: 31000, source: 'opening count today' });
  assert.deepEqual(openingFloat(counts.slice(0, 3), '2026-11-02'), { total: 30000, source: 'closing count on 2026-11-01' }); assert.equal(openingFloat([], '2026-11-02').total, null);
});
test('messages: audience and unread', () => {
  const m = [{ audience: 'all', fromUid: 'o', readBy: [] }, { audience: 'managers', fromUid: 'o', readBy: [] }, { audience: 'all', fromUid: 's', readBy: [] }, { audience: 'all', fromUid: 'o', readBy: ['s'] }];
  assert.equal(unreadCount(m, 's', 'staff'), 1); assert.equal(unreadCount(m, 'o', 'owner'), 1); assert.equal(visibleTo(m[1], 'staff'), false); assert.equal(visibleTo(m[1], 'manager'), true);
  assert.equal(audienceFor('staff', 'all'), 'all'); assert.equal(audienceFor('staff', undefined), 'managers'); assert.equal(audienceFor('owner', 'managers'), 'managers'); assert.equal(audienceFor('owner', ''), 'all');
});
test('reminders: Eastern time, weekday, acknowledgement', () => {
  const n = nowET(new Date('2026-11-02T14:05:00Z')); // Mon 9:05 EST
  assert.deepEqual(n, { date: '2026-11-02', time: '09:05', weekday: 1 }); assert.equal(nowET(new Date('2026-11-02T05:00:00Z')).time, '00:00');
  const rs = [{ id: 'a', text: 'Open safe', time: '09:00', days: [1, 2] }, { id: 'b', text: 'Later', time: '17:00', days: [] }, { id: 'c', text: 'Sunday', time: '08:00', days: [0] }, { id: 'd', text: 'Off', time: '08:00', active: false }, { id: 'e', text: 'Done', time: '08:00' }];
  assert.deepEqual(dueReminders(rs, [logKey('2026-11-02', 'e')], n).map((r) => r.id), ['a']);
  assert.equal(validReminder({ text: ' ', time: '09:00' }), 'Enter the reminder text.'); assert.equal(validReminder({ text: 'x', time: '9:00' }), 'Choose a time.'); assert.equal(validReminder({ text: 'x', time: '09:00' }), null);
});
test('police queue and CSV', () => {
  const purchases = [{ policeReport: { status: 'pending' }, receiptNumber: 5001, date: '2026-11-02', customerId: 'c1', customerName: 'Jane Doe', total: 17500, itemSummaries: [{ title: 'Saw', category: 'Tools', serial: 'S1', brand: 'DeWalt', model: 'X' }, { title: 'Drill "pro"', category: 'Tools', serial: '' }] }, { policeReport: { status: 'reported' } }];
  const loans = [{ policeReport: { status: 'pending' }, ticketNumber: 1001, issuedDate: '2026-11-01', customerId: 'c1', customerName: 'Jane Doe', principal: 10000, itemSummaries: [{ title: 'Ring', category: 'Jewelry', serial: '' }] }, { ticketNumber: 9 }];
  const p = pending(purchases, loans); assert.deepEqual(p.map((x) => x.ref), ['Ticket 1001', 'Receipt 5001']);
  const csv = reportCsv(p, { c1: { firstName: 'Jane', lastName: 'Doe', dob: '1985-03-15', address: { street: '1 A St', city: 'Salem', state: 'CT', zip: '06420' }, ids: { idType: 'DL', idNumber: 'D1', idState: 'CT' } } });
  const lines = csv.split('\r\n'); assert.equal(lines.length, 1 + 3); assert.ok(lines[2].includes('"Purchase","Receipt 5001","2026-11-02","175.00","Doe","Jane"')); assert.ok(csv.includes('"Drill ""pro"""'));
});
