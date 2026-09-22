import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class DemoSession {
  data: Record<string, any[]> | null = null;
  tenant = false;
  month = '';
  name = 'The Garden Portfolio';
}
export function demoData(month: string) {
  const properties = [
    {
      id: 'p1',
      name: 'Maison du Jardin',
      address: 'Avenue des Palmiers',
      city: 'Gombe, Kinshasa',
      type: 'building',
      notes: 'A quiet corner with room to grow.',
    },
    {
      id: 'p2',
      name: 'Résidence Lumière',
      address: 'Avenue de la Paix',
      city: 'Ngaliema, Kinshasa',
      type: 'house',
      notes: 'A bright family home.',
    },
  ];
  const units = [
    {
      id: 'u1',
      propertyId: 'p1',
      label: 'Garden apartment',
      rentMinor: 65000,
      currency: 'USD',
      activeLeaseId: 'l1',
    },
    {
      id: 'u2',
      propertyId: 'p1',
      label: 'Courtyard studio',
      rentMinor: 35000,
      currency: 'USD',
      activeLeaseId: 'l2',
    },
    {
      id: 'u3',
      propertyId: 'p1',
      label: 'Upper apartment',
      rentMinor: 55000,
      currency: 'USD',
      activeLeaseId: null,
    },
    {
      id: 'u4',
      propertyId: 'p2',
      label: 'Main home',
      rentMinor: 85000,
      currency: 'USD',
      activeLeaseId: 'l3',
    },
  ];
  const leases = [
    {
      id: 'l1',
      unitId: 'u1',
      propertyId: 'p1',
      propertyName: 'Maison du Jardin',
      unitLabel: 'Garden apartment',
      tenantName: 'Amara M.',
      tenantEmail: 'amara@example.com',
      tenantUid: 'demo-tenant',
      rentMinor: 65000,
      currency: 'USD',
    },
    {
      id: 'l2',
      unitId: 'u2',
      propertyId: 'p1',
      propertyName: 'Maison du Jardin',
      unitLabel: 'Courtyard studio',
      tenantName: 'Daniel K.',
      tenantEmail: 'daniel@example.com',
      tenantUid: 'demo-2',
      rentMinor: 35000,
      currency: 'USD',
    },
    {
      id: 'l3',
      unitId: 'u4',
      propertyId: 'p2',
      propertyName: 'Résidence Lumière',
      unitLabel: 'Main home',
      tenantName: 'Sarah N.',
      tenantEmail: 'sarah@example.com',
      tenantUid: null,
      rentMinor: 85000,
      currency: 'USD',
    },
  ].map((l) => ({
    ...l,
    status: 'active',
    startDate: `${month.slice(0, 4)}-01-01`,
    endDate: `${month.slice(0, 4)}-12-31`,
    dueDay: 5,
  }));
  const charges = leases.map((l, i) => ({
    ...l,
    id: `c${i + 1}`,
    leaseId: l.id,
    amountMinor: l.rentMinor,
    receivedMinor: i === 0 ? 65000 : i === 1 ? 20000 : 0,
    cancelled: false,
    period: month,
    dueDate: `${month}-05`,
  }));
  const receipts = charges
    .filter((c) => c.receivedMinor)
    .map((c) => ({
      id: `r${c.id}`,
      chargeId: c.id,
      leaseId: c.leaseId,
      tenantName: c.tenantName,
      currency: c.currency,
      amountMinor: c.receivedMinor,
      period: month,
      receivedOn: `${month}-03`,
      method: 'bank',
      reference: 'Illustrative entry',
      note: '',
      voided: false,
    }));
  return {
    properties,
    units,
    leases,
    charges,
    receipts,
    maintenance: [
      {
        id: 'm1',
        leaseId: 'l1',
        title: 'Kitchen tap needs attention',
        description: 'The kitchen tap has a slow leak. A morning visit would work well.',
        status: 'acknowledged',
        priority: 'normal',
        propertyName: 'Maison du Jardin',
        unitLabel: 'Garden apartment',
        tenantName: 'Amara M.',
        latestNote: 'Thanks for letting us know. We’re arranging a visit.',
      },
    ],
    documents: [],
    messages: [
      {
        id: 'msg1',
        leaseId: 'l1',
        body: 'Welcome to your home’s shared space. You can find your rent records and let me know if anything needs attention here.',
        authorName: 'Your landlord',
        authorUid: 'demo-owner',
      },
      {
        id: 'msg2',
        leaseId: 'l1',
        body: 'Thank you! It’s helpful to have everything together.',
        authorName: 'Amara M.',
        authorUid: 'demo-tenant',
      },
    ],
    activity: [
      { id: 'a1', detail: 'Maintenance request acknowledged', action: 'updateMaintenance' },
      { id: 'a2', detail: 'Partial rent receipt recorded', action: 'recordReceipt' },
    ],
    support: [],
  };
}
