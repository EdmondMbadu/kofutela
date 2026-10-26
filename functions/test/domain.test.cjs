const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSchedule,
  initialSchedule,
  rentPeriod,
  guaranteeTotal,
  nextReceived,
  date,
  schemas,
} = require('../lib/domain.js');

test('lease schedule crosses years and keeps dates inside the term', () => {
  assert.deepEqual(buildSchedule('2026-12-15', '2027-02-03', 5), [
    { period: '2026-12', dueDate: '2026-12-15' },
    { period: '2027-01', dueDate: '2027-01-05' },
    { period: '2027-02', dueDate: '2027-02-03' },
  ]);
});
test('invalid calendar dates, reversed terms and invalid due days are rejected', () => {
  assert.equal(date.safeParse('2026-02-30').success, false);
  assert.throws(() => buildSchedule('2026-09-01', '2026-08-01', 5));
  assert.equal(buildSchedule('2026-01-01', '2030-01-01', 5).length, 49);
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

test('ongoing rentals and multi-decade rentals have bounded creation and correct later months', () => {
  assert.equal(initialSchedule('2020-01-15', null, 5, '2026-10-25').length, 13);
  assert.deepEqual(rentPeriod('2020-01-15', null, 5, '2050-07'), {
    period: '2050-07',
    dueDate: '2050-07-05',
  });
  assert.equal(initialSchedule('2026-01-01', '2099-12-31', 5, '2026-10-25').length, 12);
  assert.equal(rentPeriod('2026-01-15', '2026-02-03', 5, '2026-03'), null);
  assert.equal(rentPeriod('2026-01-15', null, 5, '2025-12'), null);
  assert.deepEqual(rentPeriod('2026-01-15', '2026-02-03', 5, '2026-02'), {
    period: '2026-02',
    dueDate: '2026-02-03',
  });
  assert.throws(() => rentPeriod('2026-01-01', null, 5, '2026-13'));
});
test('guarantee total is an exact integer amount separate from received rent', () => {
  assert.equal(guaranteeTotal(10025, 3), 30075);
  assert.equal(guaranteeTotal(800000, 6), 4800000);
  assert.equal(guaranteeTotal(10000, 0), 0);
  for (const months of [-1, 0.5, NaN, Infinity]) assert.throws(() => guaranteeTotal(10000, months));
  assert.throws(() => guaranteeTotal(100_000_000_000, 2));
  assert.equal(schemas.createLease.shape.endDate.parse(undefined), null);
});
