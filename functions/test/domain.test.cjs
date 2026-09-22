const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSchedule, nextReceived, date, schemas } = require('../lib/domain.js');

test('lease schedule crosses years and keeps dates inside the term', () => {
  assert.deepEqual(buildSchedule('2026-12-15', '2027-02-03', 5), [
    { period: '2026-12', dueDate: '2026-12-15' },
    { period: '2027-01', dueDate: '2027-01-05' },
    { period: '2027-02', dueDate: '2027-02-03' },
  ]);
});
test('invalid calendar dates, reversed terms and unbounded leases are rejected', () => {
  assert.equal(date.safeParse('2026-02-30').success, false);
  assert.throws(() => buildSchedule('2026-09-01', '2026-08-01', 5));
  assert.throws(() => buildSchedule('2026-01-01', '2030-01-01', 5));
  assert.throws(() => buildSchedule('2026-01-01', '2026-12-01', 31));
});
test('partial receipts use integers and never over-allocate', () => {
  assert.equal(nextReceived(30000, 10000, 15000), 25000);
  assert.equal(nextReceived(30000, 25000, 5000), 30000);
  assert.throws(() => nextReceived(30000, 25000, 5001));
  assert.throws(() => nextReceived(30000, 0, 1.5));
  assert.throws(() => nextReceived(30000, 0, -100));
});
test('user input is bounded and path references cannot traverse collections', () => {
  assert.equal(schemas.createInvite.safeParse({ leaseId: '../other' }).success, false);
  assert.equal(
    schemas.sendMessage.safeParse({ leaseId: 'a', body: 'x'.repeat(4001) }).success,
    false,
  );
  assert.equal(
    schemas.prepareDocument.safeParse({
      leaseId: 'a',
      title: 'Lease',
      fileName: '../file.pdf',
      contentType: 'application/pdf',
      size: 100,
    }).success,
    false,
  );
});
