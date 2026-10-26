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
  return Array.from({ length: count }, (_, i) => {
    const month = new Date(Date.UTC(sy, sm - 1 + i, 1)).toISOString().slice(0, 7);
    const candidate = `${month}-${String(dueDay).padStart(2, '0')}`;
    const dueDate = candidate < startDate ? startDate : candidate > endDate ? endDate : candidate;
    return { period: month, dueDate };
  });
}

/** Derive one month from saved rental terms; never from client-supplied charge amounts. */
export function rentPeriod(
  startDate: string,
  endDate: string | null,
  dueDay: number,
  period: string,
) {
  date.parse(startDate);
  if (endDate) date.parse(endDate);
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(period))
    throw new Error('Choose a valid rent month.');
  if (endDate && endDate < startDate) throw new Error('The lease end must follow its start.');
  if (period < startDate.slice(0, 7) || (endDate && period > endDate.slice(0, 7))) return null;
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28)
    throw new Error('Due day must be between 1 and 28.');
  const candidate = `${period}-${String(dueDay).padStart(2, '0')}`;
  return {
    period,
    dueDate:
      candidate < startDate ? startDate : endDate && candidate > endDate ? endDate : candidate,
  };
}

/** Keep creation bounded; later months are materialized idempotently when consulted. */
export function initialSchedule(
  startDate: string,
  endDate: string | null,
  dueDay: number,
  currentDate: string,
) {
  date.parse(startDate);
  const [year, month] = startDate.split('-').map(Number);
  const firstYearEnd = [
    new Date(Date.UTC(year, month + 11, 0)).toISOString().slice(0, 10),
    '2199-12-31',
  ].sort()[0];
  const rows = buildSchedule(
    startDate,
    endDate && endDate < firstYearEnd ? endDate : firstYearEnd,
    dueDay,
  );
  const current = rentPeriod(startDate, endDate, dueDay, currentDate.slice(0, 7));
  if (current && !rows.some((r) => r.period === current.period)) rows.push(current);
  return rows;
}

export function guaranteeTotal(rentMinor: number, months: number) {
  money.parse(rentMinor);
  if (!Number.isSafeInteger(months) || months < 0)
    throw new Error('Enter a whole number of guarantee months, zero or more.');
  const total = rentMinor * months;
  if (!Number.isSafeInteger(total) || total > 100_000_000_000)
    throw new Error('The guarantee total is too large. Check the rent and number of months.');
  return total;
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
    type: z.enum(['apartment', 'house', 'building', 'commercial']).optional(),
    name: shortText,
    address: shortText,
    city: shortText,
    notes: text(),
  }),
  createUnit: z.object({ propertyId: id, label: shortText, rentMinor: money, currency }),
  updateUnit: z.object({ unitId: id, label: shortText, rentMinor: money, currency }),
  deleteUnit: z.object({ unitId: id }),
  restoreUnit: z.object({ unitId: id }),
  deleteProperty: z.object({ propertyId: id }),
  restoreProperty: z.object({ propertyId: id }),
  createLease: z.object({
    unitId: id,
    tenantName: shortText,
    tenantEmail: z.string().trim().toLowerCase().email().max(254),
    startDate: date,
    endDate: date.nullable().optional().default(null),
    guaranteeMonths: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
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
