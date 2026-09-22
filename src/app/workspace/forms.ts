export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  options?: { value: string; label: string }[];
  hint?: string;
};
export type FormSpec = { title: string; description: string; fields: Field[]; submit?: string };
const t = (key: string, label: string, extra: Partial<Field> = {}): Field => ({
  key,
  label,
  required: true,
  ...extra,
});
const currencies = [
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CDF', label: 'CDF — Congolese franc' },
];
const amount = t('amount', 'Amount', { type: 'number', min: 0.01, max: 1000000000, step: '0.01' });
const money = [
  t('rent', 'Monthly rent', { type: 'number', min: 0.01, max: 1000000000, step: '0.01' }),
  t('currency', 'Currency', { type: 'select', options: currencies }),
];
export function formSpec(
  action: string,
  options: { units: any[]; properties: any[]; leases: any[]; status?: string; owner: boolean },
): FormSpec {
  const lease = t('leaseId', 'Lease / tenant', {
    type: 'select',
    options: options.leases.map((l) => ({
      value: l.id,
      label: `${l.tenantName} · ${l.propertyName} / ${l.unitLabel}`,
    })),
  });
  const status: Record<string, string[]> = {
    new: ['acknowledged'],
    acknowledged: ['in_progress'],
    in_progress: ['resolved'],
    resolved: ['closed', 'in_progress'],
    closed: ['in_progress'],
  };
  const forms: Record<string, FormSpec> = {
    createWorkspace: {
      title: 'Your portfolio starts here.',
      description: 'Give your space a name. You can add properties and invite tenants next.',
      fields: [
        t('displayName', 'Your name'),
        t('name', 'Portfolio name'),
        t('currency', 'Default currency', { type: 'select', options: currencies }),
      ],
    },
    createProperty: {
      title: 'Make room for a property.',
      description: 'Start with the essentials. Every rentable space gets its own unit.',
      fields: [
        t('name', 'Property name'),
        t('type', 'Property type', {
          type: 'select',
          options: ['apartment', 'house', 'building', 'commercial'].map((value) => ({
            value,
            label: value,
          })),
        }),
        t('address', 'Street address'),
        t('city', 'City / commune'),
        t('unitCount', 'Number of units', { type: 'number', min: 1, max: 30, step: '1' }),
        ...money,
        t('notes', 'Notes', { type: 'textarea', required: false, max: 2000 }),
      ],
    },
    updateProperty: {
      title: 'A little update.',
      description: 'Edit this property’s details. Historical lease labels remain unchanged.',
      fields: [
        t('name', 'Property name'),
        t('address', 'Street address'),
        t('city', 'City / commune'),
        t('notes', 'Notes', { type: 'textarea', required: false, max: 2000 }),
      ],
    },
    createUnit: {
      title: 'A new space to call home.',
      description: 'Add a rentable unit to an existing property.',
      fields: [
        t('propertyId', 'Property', {
          type: 'select',
          options: options.properties.map((p) => ({ value: p.id, label: p.name })),
        }),
        t('label', 'Unit name'),
        ...money,
      ],
    },
    createLease: {
      title: 'Start a new chapter.',
      description:
        'Monthly charges cover every calendar month in the term, at the full rent amount. No automatic prorating. Maximum 24 months; due day 1–28.',
      fields: [
        t('unitId', 'Available unit', {
          type: 'select',
          options: options.units
            .filter((u) => !u.activeLeaseId)
            .map((u) => ({
              value: u.id,
              label: `${options.properties.find((p) => p.id === u.propertyId)?.name || 'Property'} · ${u.label}`,
            })),
        }),
        t('tenantName', 'Tenant name'),
        t('tenantEmail', 'Tenant email', { type: 'email', max: 254 }),
        t('startDate', 'Lease start', { type: 'date' }),
        t('endDate', 'Lease end', { type: 'date' }),
        t('dueDay', 'Rent due day', { type: 'number', min: 1, max: 28, step: '1' }),
        ...money,
      ],
    },
    endLease: {
      title: 'Close this chapter.',
      description:
        'Ends the lease today or earlier and cancels later unpaid charges. Existing history stays intact. Correct later receipts before shortening a lease. Future terminations are not yet supported.',
      fields: [
        t('endDate', 'Final lease date', { type: 'date' }),
        t('reason', 'Reason for ending the lease', { type: 'textarea', min: 3, max: 500 }),
      ],
      submit: 'End lease',
    },
    recordReceipt: {
      title: 'A clear record of rent.',
      description:
        'Record money already received outside Kofutela. No money is collected or transferred here. Partial receipts are welcome.',
      fields: [
        amount,
        t('receivedOn', 'Date received', { type: 'date' }),
        t('method', 'How it was received', {
          type: 'select',
          options: [
            { value: 'cash', label: 'Cash' },
            { value: 'bank', label: 'Bank transfer' },
            { value: 'mobile_money', label: 'Mobile money' },
            { value: 'other', label: 'Other' },
          ],
        }),
        t('reference', 'External reference', { required: false, max: 200 }),
        t('note', 'Note', { type: 'textarea', required: false, max: 500 }),
      ],
      submit: 'Record receipt',
    },
    voidReceipt: {
      title: 'Correct a receipt.',
      description:
        'This reverses the recorded amount and restores the balance. The original receipt remains visible with your reason. No money is refunded by Kofutela.',
      fields: [t('reason', 'Reason for correction', { type: 'textarea', min: 3, max: 500 })],
      submit: 'Reverse receipt',
    },
    createMaintenance: {
      title: 'Let’s look after it.',
      description:
        'Describe the issue and keep the next steps in one place. For immediate danger, contact local emergency services directly.',
      fields: [
        lease,
        t('title', 'What needs attention?'),
        t('priority', 'Priority', {
          type: 'select',
          options: [
            { value: 'normal', label: 'Normal' },
            { value: 'urgent', label: 'Urgent' },
          ],
        }),
        t('description', 'Tell us what is happening', { type: 'textarea', min: 5, max: 4000 }),
      ],
    },
    updateMaintenance: {
      title: 'Keep everyone in the loop.',
      description:
        'Record the next step. Tenants can confirm a resolution or reopen a resolved request.',
      fields: [
        t('status', 'Next status', {
          type: 'select',
          options: (options.owner
            ? status[options.status || 'new'] || []
            : options.status === 'resolved'
              ? ['closed', 'in_progress']
              : []
          ).map((value) => ({ value, label: value.replace('_', ' ') })),
        }),
        t('note', 'Update note', { type: 'textarea', required: false, max: 1000 }),
      ],
    },
    uploadDocument: {
      title: 'Everything in its place.',
      description:
        'Share a document with the tenant on this lease. PDF, JPG, PNG or WebP, up to 10 MB. Avoid identity documents during the pilot.',
      fields: [lease, t('title', 'Document title'), t('file', 'Choose a file', { type: 'file' })],
      submit: 'Upload document',
    },
    createSupport: {
      title: 'How can we help?',
      description:
        'Send a private request to the platform operator. Never include passwords or payment credentials.',
      fields: [
        t('subject', 'Subject'),
        t('body', 'Your message', { type: 'textarea', min: 10, max: 4000 }),
      ],
      submit: 'Send request',
    },
    updateProfile: {
      title: 'Make yourself known.',
      description: 'Update the name used in your account and new messages.',
      fields: [t('displayName', 'Your name')],
    },
    updateWorkspace: {
      title: 'Your space, your name.',
      description: 'Update the name of your portfolio.',
      fields: [t('name', 'Portfolio name')],
    },
  };
  return forms[action];
}
