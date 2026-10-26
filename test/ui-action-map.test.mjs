import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { formSpec, formPayload } from '../src/app/workspace/forms.ts';
const require = createRequire(import.meta.url);
const { schemas } = require('../functions/lib/domain.js');
const template = readFileSync(
  new URL('../src/app/workspace/workspace.html', import.meta.url),
  'utf8',
);
const actions = [
  ...new Set([...template.matchAll(/open\('([A-Za-z]+)'/g)].map((match) => match[1])),
];
const options = {
  properties: [{ id: 'property-1', name: 'Fictional home' }],
  units: [{ id: 'unit-1', propertyId: 'property-1', label: 'Main home', activeLeaseId: null }],
  leases: [
    {
      id: 'lease-1',
      tenantName: 'Test Tenant',
      propertyName: 'Fictional home',
      unitLabel: 'Main home',
    },
  ],
  status: 'new',
  owner: true,
};
const values = {
  confirmed: true,
  displayName: 'Test Owner',
  name: 'Test Portfolio',
  currency: 'USD',
  type: 'house',
  address: 'Fictional address',
  city: 'Kinshasa',
  unitCount: '1',
  rent: '450.25',
  notes: '',
  propertyId: 'property-1',
  label: 'Second unit',
  unitId: 'unit-1',
  tenantName: 'Test Tenant',
  tenantEmail: 'tenant@example.test',
  startDate: '2026-01-01',
  termType: 'fixed',
  guaranteeMonths: '3',
  endDate: '2026-12-31',
  dueDay: '5',
  leaseId: 'lease-1',
  amount: '123.45',
  receivedOn: '2026-10-01',
  method: 'cash',
  reference: '',
  note: '',
  chargeId: 'charge-1',
  receiptId: 'receipt-1',
  ticketId: 'ticket-1',
  reason: 'Fictional correction',
  title: 'Fictional document or repair',
  description: 'A fictional repair description.',
  priority: 'normal',
  status: 'acknowledged',
  subject: 'Test support request',
  body: 'A fictional support request with enough detail.',
};

test('every workspace dialog button maps to an exact backend payload contract', async (t) => {
  assert.deepEqual(
    actions.slice().sort(),
    [
      'createWorkspace',
      'createProperty',
      'updateProperty',
      'createUnit',
      'updateUnit',
      'deleteUnit',
      'restoreUnit',
      'deleteProperty',
      'restoreProperty',
      'createLease',
      'endLease',
      'recordReceipt',
      'voidReceipt',
      'createMaintenance',
      'updateMaintenance',
      'uploadDocument',
      'createSupport',
      'updateProfile',
      'updateWorkspace',
    ].sort(),
  );
  for (const action of actions)
    await t.test(action, () => {
      const spec = formSpec(action, options);
      assert.ok(spec, `${action} has no form`);
      const payload = formPayload(action, spec, values);
      if (action === 'uploadDocument') {
        assert.deepEqual(Object.keys(payload).sort(), ['leaseId', 'title']);
        schemas.prepareDocument.strict().parse({
          ...payload,
          fileName: 'fixture.pdf',
          contentType: 'application/pdf',
          size: 100,
        });
      } else {
        assert.ok(schemas[action], `${action} has no backend command`);
        schemas[action].strict().parse(payload);
      }
    });
});

test('dialog mapping validates values and converts currency amounts to integer minor units', () => {
  const receipt = formSpec('recordReceipt', options);
  assert.equal(formPayload('recordReceipt', receipt, values).amountMinor, 12345);
  const property = formSpec('createProperty', options);
  assert.equal(formPayload('createProperty', property, values).rentMinor, 45025);
  assert.throws(
    () =>
      formPayload('createWorkspace', formSpec('createWorkspace', options), {
        ...values,
        name: '   ',
      }),
    /Portfolio name/,
  );
  assert.throws(
    () => formPayload('createProperty', property, { ...values, unitCount: '1.5' }),
    /Number of units/,
  );
  assert.throws(
    () => formPayload('createLease', formSpec('createLease', { ...options, units: [] }), values),
    /Available unit/,
  );
});

test('deletion needs explicit confirmation and sends only the selected record reference', () => {
  for (const [action, reference] of [
    ['deleteUnit', 'unitId'],
    ['deleteProperty', 'propertyId'],
  ]) {
    const spec = formSpec(action, options);
    assert.throws(
      () => formPayload(action, spec, { ...values, confirmed: false }),
      /Confirm deletion/,
    );
    assert.deepEqual(formPayload(action, spec, values), { [reference]: values[reference] });
  }
});

test('ongoing rentals discard stale end dates and validate guarantee months and amounts', () => {
  const spec = formSpec('createLease', options);
  const ongoing = formPayload('createLease', spec, { ...values, termType: 'ongoing', endDate: '' });
  schemas.createLease.strict().parse(ongoing);
  assert.equal(ongoing.endDate, null);
  assert.equal(ongoing.guaranteeMonths, 3);
  assert.equal('termType' in ongoing, false);
  assert.equal(
    formPayload('createLease', spec, { ...values, termType: 'ongoing', endDate: '2020-01-01' })
      .endDate,
    null,
  );
  assert.equal(
    formPayload('createLease', spec, { ...values, endDate: '2050-12-31' }).endDate,
    '2050-12-31',
  );
  for (const guaranteeMonths of [-1, 1.5, NaN, Infinity])
    assert.throws(() => formPayload('createLease', spec, { ...values, guaranteeMonths }));
  assert.throws(
    () => formPayload('createLease', spec, { ...values, rent: 1000000000, guaranteeMonths: 2 }),
    /guarantee total/,
  );
  assert.throws(
    () => formPayload('createLease', spec, { ...values, endDate: '2020-01-01' }),
    /end date/,
  );
});
