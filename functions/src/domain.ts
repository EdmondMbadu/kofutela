import { z } from 'zod';

export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const currency = z.enum(['USD', 'CDF']);
export const money = z.number().int().positive().max(100_000_000_000);
export const shortText = z.string().trim().min(1).max(160);
export const date = z
  .string()
  .regex(/^(19|20|21)\d{2}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date.');
export const text = (max = 2000) => z.string().trim().max(max).default('');

export function buildSchedule(startDate: string, endDate: string, dueDay: number) {
  date.parse(startDate);
  date.parse(endDate);
  if (startDate > endDate) throw new Error('The lease end must follow its start.');
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28)
    throw new Error('Due day must be between 1 and 28.');
  const [sy, sm] = startDate.split('-').map(Number);
  const [ey, em] = endDate.split('-').map(Number);
  const count = (ey - sy) * 12 + em - sm + 1;
  if (count > 24)
    throw new Error('For the pilot, enter a lease of no more than 24 calendar months.');
  return Array.from({ length: count }, (_, i) => {
    const month = new Date(Date.UTC(sy, sm - 1 + i, 1)).toISOString().slice(0, 7);
    const candidate = `${month}-${String(dueDay).padStart(2, '0')}`;
    const dueDate = candidate < startDate ? startDate : candidate > endDate ? endDate : candidate;
    return { period: month, dueDate };
  });
}

export function nextReceived(amountMinor: number, receivedMinor: number, receiptMinor: number) {
  money.parse(amountMinor);
  money.parse(receiptMinor);
  if (
    !Number.isSafeInteger(receivedMinor) ||
    receivedMinor < 0 ||
    receivedMinor + receiptMinor > amountMinor
  ) {
    throw new Error('The receipt is larger than the outstanding rent. Record only the amount due.');
  }
  return receivedMinor + receiptMinor;
}

export const maintenanceTransitions: Record<string, string[]> = {
  new: ['acknowledged'],
  acknowledged: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
};

export const schemas = {
  createWorkspace: z.object({ name: shortText, currency, displayName: shortText }),
  updateProfile: z.object({ displayName: shortText }),
  updateWorkspace: z.object({ name: shortText }),
  createProperty: z.object({
    name: shortText,
    address: shortText,
    city: shortText,
    type: z.enum(['apartment', 'house', 'building', 'commercial']),
    notes: text(),
    unitCount: z.number().int().min(1).max(30),
    rentMinor: money,
    currency,
  }),
  updateProperty: z.object({
    propertyId: id,
    name: shortText,
    address: shortText,
    city: shortText,
    notes: text(),
  }),
  createUnit: z.object({ propertyId: id, label: shortText, rentMinor: money, currency }),
  createLease: z.object({
    unitId: id,
    tenantName: shortText,
    tenantEmail: z.string().trim().toLowerCase().email().max(254),
    startDate: date,
    endDate: date,
    dueDay: z.number().int().min(1).max(28),
    rentMinor: money,
    currency,
  }),
  endLease: z.object({ leaseId: id, endDate: date, reason: z.string().trim().min(3).max(500) }),
  createInvite: z.object({ leaseId: id }),
  acceptInvite: z.object({
    token: z.string().regex(/^[A-Za-z0-9_-]{32,80}$/),
    displayName: shortText,
  }),
  recordReceipt: z.object({
    chargeId: id,
    amountMinor: money,
    receivedOn: date,
    method: z.enum(['cash', 'bank', 'mobile_money', 'other']),
    reference: text(200),
    note: text(500),
  }),
  voidReceipt: z.object({ receiptId: id, reason: z.string().trim().min(3).max(500) }),
  createMaintenance: z.object({
    leaseId: id,
    title: shortText,
    description: z.string().trim().min(5).max(4000),
    priority: z.enum(['normal', 'urgent']),
  }),
  updateMaintenance: z.object({
    ticketId: id,
    status: z.enum(['new', 'acknowledged', 'in_progress', 'resolved', 'closed']),
    note: text(1000),
  }),
  sendMessage: z.object({ leaseId: id, body: z.string().trim().min(1).max(4000) }),
  prepareDocument: z.object({
    leaseId: id,
    title: shortText,
    fileName: z
      .string()
      .min(1)
      .max(180)
      .regex(/^[^/\\]+$/),
    contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    size: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024),
  }),
  createSupport: z.object({ subject: shortText, body: z.string().trim().min(10).max(4000) }),
  updateSupport: z.object({
    ticketId: id,
    status: z.enum(['open', 'closed']),
    reply: z.string().trim().min(1).max(4000),
  }),
  setPlatformRole: z.object({ uid: id, role: z.enum(['admin', 'superadmin', 'none']) }),
} as const;

export type Action = keyof typeof schemas;
