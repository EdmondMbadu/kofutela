import { initializeApp } from 'firebase-admin/app';
import {
  DocumentReference,
  FieldValue,
  getFirestore,
  Timestamp,
  Transaction,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Action, buildSchedule, id, maintenanceTransitions, nextReceived, schemas } from './domain';

const app = initializeApp();
// New Firebase buckets use firebasestorage.app; the emulator's legacy default
// would otherwise point finalizeDocument at a different bucket than the client.
const documentBucket = `${app.options.projectId || process.env['GCLOUD_PROJECT'] || 'kofutela'}.firebasestorage.app`;
setGlobalOptions({
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 3,
  memory: '256MiB',
  timeoutSeconds: 30,
});
const db = getFirestore();
const now = () => FieldValue.serverTimestamp();
const fail = (message: string): never => {
  throw new HttpsError('failed-precondition', message);
};
const deny = (): never => {
  throw new HttpsError('permission-denied', 'You do not have access to this action.');
};
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kinshasa' }).format(new Date());

function identity(request: CallableRequest, verified = true) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  if (verified && request.auth.token.email_verified !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Verify your email before managing your portfolio.',
    );
  }
  return {
    uid: request.auth.uid,
    email: String(request.auth.token.email || '').toLowerCase(),
    name: String(request.auth.token.name || 'Member').slice(0, 160),
  };
}

async function existing(tx: Transaction, ref: DocumentReference) {
  const snapshot = await tx.get(ref);
  if (!snapshot.exists)
    throw new HttpsError('not-found', 'This record no longer exists. Refresh and try again.');
  return snapshot.data()!;
}

async function member(tx: Transaction, orgId: string, uid: string, ownerOnly = false) {
  id.parse(orgId);
  const org = db.doc(`organizations/${orgId}`);
  const [orgSnap, memberSnap] = await Promise.all([
    tx.get(org),
    tx.get(org.collection('members').doc(uid)),
  ]);
  if (
    !orgSnap.exists ||
    !memberSnap.exists ||
    (ownerOnly && memberSnap.data()!['role'] !== 'owner')
  )
    deny();
  return { org, data: orgSnap.data()!, role: memberSnap.data()!['role'] as 'owner' | 'tenant' };
}

async function leaseAccess(
  tx: Transaction,
  org: DocumentReference,
  leaseId: string,
  uid: string,
  role: string,
) {
  const ref = org.collection('leases').doc(leaseId);
  const data = await existing(tx, ref);
  if (role !== 'owner' && data['tenantUid'] !== uid) deny();
  return { ref, data };
}

function audit(
  tx: Transaction,
  org: DocumentReference,
  uid: string,
  action: string,
  entityId: string,
  detail: string,
) {
  tx.create(org.collection('activity').doc(), {
    actorUid: uid,
    action,
    entityId,
    detail: detail.slice(0, 300),
    createdAt: now(),
  });
}

async function rateLimit(uid: string) {
  const ref = db.doc(`rateLimits/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const start = snap.data()?.['windowStart']?.toMillis?.() || 0;
    const fresh = Date.now() - start >= 60_000;
    const count = fresh ? 0 : Number(snap.data()?.['count'] || 0);
    if (count >= 60)
      throw new HttpsError('resource-exhausted', 'Please wait a minute before trying again.');
    tx.set(ref, {
      count: count + 1,
      windowStart: fresh ? Timestamp.now() : snap.data()!['windowStart'],
    });
  });
}

function mappedError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof z.ZodError)
    throw new HttpsError(
      'invalid-argument',
      error.issues[0]?.message || 'Check the form and try again.',
    );
  const detail = error as { name?: string; code?: string; message?: string };
  console.error('Kofutela operation failed', {
    name: detail.name,
    code: detail.code,
    message: detail.message,
  });
  throw new HttpsError('internal', 'We could not complete this action. Please try again.');
}

export const session = onCall(async (request) => {
  try {
    const who = identity(request, false);
    await rateLimit(who.uid);
    const profileRef = db.doc(`users/${who.uid}`);
    const profile = await db.runTransaction(async (tx) => {
      const [snap, bootstrap] = await Promise.all([
        tx.get(profileRef),
        tx.get(db.doc('platformConfig/bootstrap')),
      ]);
      const profileData = snap.data() || { displayName: who.name, email: who.email };
      if (!snap.exists)
        tx.create(profileRef, { ...profileData, createdAt: now(), updatedAt: now() });
      // Set once by the deployment operator. Never supplied or modified by a client.
      const ownerEmail = process.env['KOFUTELA_OWNER_EMAIL']?.toLowerCase();
      if (
        !bootstrap.exists &&
        ownerEmail &&
        who.email === ownerEmail &&
        request.auth!.token.email_verified === true
      ) {
        tx.create(db.doc(`platformAdmins/${who.uid}`), {
          role: 'superadmin',
          createdAt: now(),
          updatedAt: now(),
          grantedBy: 'project-owner-bootstrap',
        });
        tx.create(db.doc('platformConfig/bootstrap'), { uid: who.uid, createdAt: now() });
      }
      return profileData;
    });
    const [memberships, admin] = await Promise.all([
      profileRef.collection('memberships').limit(100).get(),
      db.doc(`platformAdmins/${who.uid}`).get(),
    ]);
    return {
      profile,
      memberships: memberships.docs.map((s) => ({ id: s.id, ...s.data() })),
      platformRole: admin.data()?.['role'] || null,
    };
  } catch (error) {
    return mappedError(error);
  }
});

const envelope = z.object({
  action: z.enum(Object.keys(schemas) as [Action, ...Action[]]),
  orgId: id.optional(),
  requestId: z.string().uuid(),
  payload: z.unknown(),
});

export const command = onCall(async (request) => {
  try {
    const who = identity(request);
    const input = envelope.parse(request.data);
    // Every branch consumes a bounded, validated schema from domain.ts.
    const payload: any = schemas[input.action].parse(input.payload);
    const fingerprint = sha(JSON.stringify({ action: input.action, orgId: input.orgId, payload }));
    await rateLimit(who.uid);
    return await db.runTransaction(async (tx) => {
      const requestRef = db.doc(`commandReceipts/${who.uid}_${input.requestId}`);
      const previous = await tx.get(requestRef);
      if (previous.exists) {
        if (previous.data()!['fingerprint'] !== fingerprint)
          fail('This request identifier has already been used.');
        return previous.data()!['result'];
      }
      const result = await perform(tx, who, input.action, input.orgId, payload);
      tx.create(requestRef, { uid: who.uid, fingerprint, result, createdAt: now() });
      return result;
    });
  } catch (error) {
    return mappedError(error);
  }
});

type Identity = ReturnType<typeof identity>;
async function perform(
  tx: Transaction,
  who: Identity,
  action: Action,
  orgId: string | undefined,
  p: any,
): Promise<Record<string, unknown>> {
  if (action === 'createWorkspace') {
    const ref = db.doc(`organizations/${who.uid}`);
    if ((await tx.get(ref)).exists)
      fail('You already have a personal portfolio. Select it from the workspace menu.');
    tx.create(ref, {
      name: p.name,
      ownerUid: who.uid,
      currency: p.currency,
      timeZone: 'Africa/Kinshasa',
      createdAt: now(),
      updatedAt: now(),
    });
    tx.create(ref.collection('members').doc(who.uid), { role: 'owner', createdAt: now() });
    tx.set(
      db.doc(`users/${who.uid}`),
      { displayName: p.displayName, email: who.email, updatedAt: now() },
      { merge: true },
    );
    tx.set(db.doc(`users/${who.uid}/memberships/${who.uid}`), {
      orgId: who.uid,
      name: p.name,
      role: 'owner',
      createdAt: now(),
    });
    audit(tx, ref, who.uid, action, ref.id, 'Portfolio created');
    return { id: ref.id };
  }
  if (action === 'updateProfile') {
    tx.set(
      db.doc(`users/${who.uid}`),
      { displayName: p.displayName, email: who.email, updatedAt: now() },
      { merge: true },
    );
    return { ok: true };
  }
  if (action === 'acceptInvite') {
    const inviteRef = db.doc(`invitations/${sha(p.token)}`);
    const invite = await existing(tx, inviteRef);
    if (invite['revoked'] || invite['usedBy'] || invite['expiresAt'].toMillis() < Date.now())
      fail(
        'This invitation has expired or has already been used. Ask your landlord for a new one.',
      );
    if (invite['email'] !== who.email) deny();
    const org = db.doc(`organizations/${invite['orgId']}`);
    const lease = org.collection('leases').doc(invite['leaseId']);
    const [orgData, leaseData, membership] = await Promise.all([
      existing(tx, org),
      existing(tx, lease),
      tx.get(org.collection('members').doc(who.uid)),
    ]);
    if (
      membership.data()?.['role'] === 'owner' ||
      leaseData['status'] !== 'active' ||
      (leaseData['tenantUid'] && leaseData['tenantUid'] !== who.uid)
    )
      fail('This lease cannot be joined with this account.');
    tx.set(
      org.collection('members').doc(who.uid),
      { role: 'tenant', createdAt: now() },
      { merge: true },
    );
    tx.set(db.doc(`users/${who.uid}/memberships/${org.id}`), {
      orgId: org.id,
      name: orgData['name'],
      role: 'tenant',
      createdAt: now(),
    });
    tx.set(
      db.doc(`users/${who.uid}`),
      { displayName: p.displayName, email: who.email, updatedAt: now() },
      { merge: true },
    );
    tx.update(lease, { tenantUid: who.uid, updatedAt: now() });
    tx.update(inviteRef, { usedBy: who.uid, usedAt: now() });
    audit(tx, org, who.uid, action, lease.id, 'Tenant accepted invitation');
    return { id: org.id };
  }
  if (action === 'createSupport') {
    const ref = db.collection('supportTickets').doc();
    tx.create(ref, {
      uid: who.uid,
      email: who.email,
      subject: p.subject,
      body: p.body,
      status: 'open',
      reply: '',
      createdAt: now(),
      updatedAt: now(),
    });
    return { id: ref.id };
  }
  if (action === 'updateSupport' || action === 'setPlatformRole') {
    const actor = await tx.get(db.doc(`platformAdmins/${who.uid}`));
    if (!actor.exists) deny();
    if (action === 'updateSupport') {
      const ref = db.doc(`supportTickets/${p.ticketId}`);
      await existing(tx, ref);
      tx.update(ref, { status: p.status, reply: p.reply, updatedAt: now(), repliedBy: who.uid });
      tx.create(db.collection('platformActivity').doc(), {
        actorUid: who.uid,
        action,
        entityId: ref.id,
        createdAt: now(),
      });
      return { ok: true };
    }
    if (actor.data()!['role'] !== 'superadmin') deny();
    if (p.uid === who.uid) fail('You cannot change your own platform role.');
    await existing(tx, db.doc(`users/${p.uid}`));
    const ref = db.doc(`platformAdmins/${p.uid}`);
    if (p.role === 'none') tx.delete(ref);
    else tx.set(ref, { role: p.role, grantedBy: who.uid, updatedAt: now(), createdAt: now() });
    tx.create(db.collection('platformActivity').doc(), {
      actorUid: who.uid,
      action,
      entityId: p.uid,
      role: p.role,
      createdAt: now(),
    });
    return { ok: true };
  }

  if (!orgId) fail('Select a portfolio to continue.');
  const ownerActions = [
    'updateWorkspace',
    'createProperty',
    'updateProperty',
    'createUnit',
    'createLease',
    'endLease',
    'createInvite',
    'recordReceipt',
    'voidReceipt',
    'prepareDocument',
  ];
  const ctx = await member(tx, orgId!, who.uid, ownerActions.includes(action));
  const org = ctx.org;
  let result: Record<string, unknown> = { ok: true };
  let entityId = org.id;
  let detail = '';

  switch (action) {
    case 'updateWorkspace': {
      tx.update(org, { name: p.name, updatedAt: now() });
      tx.update(db.doc(`users/${who.uid}/memberships/${org.id}`), { name: p.name });
      detail = 'Portfolio details updated';
      break;
    }
    case 'createProperty': {
      const ref = org.collection('properties').doc();
      tx.create(ref, {
        name: p.name,
        address: p.address,
        city: p.city,
        type: p.type,
        notes: p.notes,
        createdAt: now(),
        updatedAt: now(),
      });
      for (let n = 1; n <= p.unitCount; n++)
        tx.create(org.collection('units').doc(), {
          propertyId: ref.id,
          label: p.unitCount === 1 ? 'Main home' : `Unit ${String(n).padStart(2, '0')}`,
          rentMinor: p.rentMinor,
          currency: p.currency,
          activeLeaseId: null,
          createdAt: now(),
          updatedAt: now(),
        });
      entityId = ref.id;
      detail = `Added ${p.name}`;
      result = { id: ref.id };
      break;
    }
    case 'updateProperty': {
      const ref = org.collection('properties').doc(p.propertyId);
      await existing(tx, ref);
      tx.update(ref, {
        name: p.name,
        address: p.address,
        city: p.city,
        notes: p.notes,
        updatedAt: now(),
      });
      entityId = ref.id;
      detail = 'Property details updated';
      break;
    }
    case 'createUnit': {
      await existing(tx, org.collection('properties').doc(p.propertyId));
      const ref = org.collection('units').doc();
      tx.create(ref, {
        propertyId: p.propertyId,
        label: p.label,
        rentMinor: p.rentMinor,
        currency: p.currency,
        activeLeaseId: null,
        createdAt: now(),
        updatedAt: now(),
      });
      entityId = ref.id;
      detail = `Added ${p.label}`;
      result = { id: ref.id };
      break;
    }
    case 'createLease': {
      const unitRef = org.collection('units').doc(p.unitId);
      const unit = await existing(tx, unitRef);
      if (unit['activeLeaseId'])
        fail('This unit already has an active lease. End that lease before adding a new one.');
      const property = await existing(tx, org.collection('properties').doc(unit['propertyId']));
      const priorLeases = await tx.get(org.collection('leases').where('unitId', '==', p.unitId));
      if (
        priorLeases.docs.some(
          (s) => s.data()['startDate'] <= p.endDate && s.data()['endDate'] >= p.startDate,
        )
      )
        fail(
          'This lease overlaps an existing lease for this unit. Choose dates after the previous lease ends.',
        );
      let schedule;
      try {
        schedule = buildSchedule(p.startDate, p.endDate, p.dueDay);
      } catch (e) {
        fail((e as Error).message);
      }
      const ref = org.collection('leases').doc();
      tx.create(ref, {
        ...p,
        propertyId: unit['propertyId'],
        propertyName: property['name'],
        unitLabel: unit['label'],
        tenantUid: null,
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
      });
      tx.update(unitRef, {
        activeLeaseId: ref.id,
        rentMinor: p.rentMinor,
        currency: p.currency,
        updatedAt: now(),
      });
      for (const row of schedule!)
        tx.create(org.collection('charges').doc(`${ref.id}_${row.period}`), {
          ...row,
          leaseId: ref.id,
          unitId: p.unitId,
          propertyId: unit['propertyId'],
          propertyName: property['name'],
          unitLabel: unit['label'],
          tenantName: p.tenantName,
          amountMinor: p.rentMinor,
          receivedMinor: 0,
          currency: p.currency,
          cancelled: false,
          createdAt: now(),
          updatedAt: now(),
        });
      entityId = ref.id;
      detail = `Lease created for ${p.tenantName}`;
      result = { id: ref.id };
      break;
    }
    case 'endLease': {
      const leaseRef = org.collection('leases').doc(p.leaseId);
      const lease = await existing(tx, leaseRef);
      if (lease['status'] !== 'active') fail('This lease has already ended.');
      if (p.endDate > today())
        fail(
          'End a lease on or before today. Scheduled future terminations are not available in the pilot.',
        );
      if (p.endDate < lease['startDate'] || p.endDate > lease['endDate'])
        fail('Choose an end date within the lease term.');
      const charges = await tx.get(org.collection('charges').where('leaseId', '==', p.leaseId));
      const later = charges.docs.filter((s) => s.data()['dueDate'] > p.endDate);
      if (later.some((s) => s.data()['receivedMinor'] > 0))
        fail('Future rent has receipts. Correct those receipts before shortening the lease.');
      tx.update(leaseRef, {
        status: 'ended',
        endDate: p.endDate,
        endReason: p.reason,
        updatedAt: now(),
      });
      tx.update(org.collection('units').doc(lease['unitId']), {
        activeLeaseId: null,
        updatedAt: now(),
      });
      for (const charge of later) tx.update(charge.ref, { cancelled: true, updatedAt: now() });
      entityId = p.leaseId;
      detail = 'Lease ended; later unpaid charges cancelled';
      break;
    }
    case 'createInvite': {
      const leaseRef = org.collection('leases').doc(p.leaseId);
      const lease = await existing(tx, leaseRef);
      if (lease['tenantUid'] || lease['status'] !== 'active')
        fail('Only an unlinked, active lease can be invited.');
      const token = randomBytes(32).toString('base64url');
      const hash = sha(token);
      if (lease['inviteHash'])
        tx.set(db.doc(`invitations/${lease['inviteHash']}`), { revoked: true }, { merge: true });
      tx.create(db.doc(`invitations/${hash}`), {
        orgId: org.id,
        leaseId: leaseRef.id,
        email: lease['tenantEmail'],
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400_000),
        revoked: false,
        usedBy: null,
        createdAt: now(),
      });
      tx.update(leaseRef, { inviteHash: hash, updatedAt: now() });
      entityId = leaseRef.id;
      detail = 'Tenant invitation created';
      result = { token, email: lease['tenantEmail'] };
      break;
    }
    case 'recordReceipt': {
      const chargeRef = org.collection('charges').doc(p.chargeId);
      const charge = await existing(tx, chargeRef);
      if (charge['cancelled']) fail('This charge is cancelled.');
      if (p.receivedOn > today()) fail('A receipt cannot be dated in the future.');
      let receivedMinor;
      try {
        receivedMinor = nextReceived(charge['amountMinor'], charge['receivedMinor'], p.amountMinor);
      } catch (e) {
        fail((e as Error).message);
      }
      const ref = org.collection('receipts').doc();
      tx.create(ref, {
        ...p,
        leaseId: charge['leaseId'],
        currency: charge['currency'],
        period: charge['period'],
        tenantName: charge['tenantName'],
        recordedBy: who.uid,
        voided: false,
        createdAt: now(),
      });
      tx.update(chargeRef, { receivedMinor, updatedAt: now() });
      entityId = ref.id;
      detail = `Receipt recorded for ${charge['period']}`;
      result = { id: ref.id };
      break;
    }
    case 'voidReceipt': {
      const ref = org.collection('receipts').doc(p.receiptId);
      const receipt = await existing(tx, ref);
      if (receipt['voided']) fail('This receipt has already been reversed.');
      const chargeRef = org.collection('charges').doc(receipt['chargeId']);
      const charge = await existing(tx, chargeRef);
      const receivedMinor = charge['receivedMinor'] - receipt['amountMinor'];
      if (receivedMinor < 0)
        fail('The rent history is inconsistent. Contact support before changing it.');
      tx.update(ref, { voided: true, voidReason: p.reason, voidedBy: who.uid, voidedAt: now() });
      tx.update(chargeRef, { receivedMinor, updatedAt: now() });
      entityId = ref.id;
      detail = 'Receipt reversed with a recorded reason';
      break;
    }
    case 'createMaintenance': {
      const lease = await leaseAccess(tx, org, p.leaseId, who.uid, ctx.role);
      if (lease.data['status'] !== 'active') fail('Maintenance requests require an active lease.');
      const ref = org.collection('maintenance').doc();
      tx.create(ref, {
        ...p,
        propertyName: lease.data['propertyName'],
        unitLabel: lease.data['unitLabel'],
        tenantName: lease.data['tenantName'],
        createdBy: who.uid,
        status: 'new',
        latestNote: '',
        createdAt: now(),
        updatedAt: now(),
      });
      entityId = ref.id;
      detail = `Maintenance: ${p.title}`;
      result = { id: ref.id };
      break;
    }
    case 'updateMaintenance': {
      const ref = org.collection('maintenance').doc(p.ticketId);
      const ticket = await existing(tx, ref);
      await leaseAccess(tx, org, ticket['leaseId'], who.uid, ctx.role);
      const allowed =
        ctx.role === 'owner'
          ? maintenanceTransitions[ticket['status']] || []
          : ticket['status'] === 'resolved'
            ? ['closed', 'in_progress']
            : [];
      if (!allowed.includes(p.status))
        fail('That status change is not available. Refresh the request first.');
      tx.update(ref, { status: p.status, latestNote: p.note, updatedAt: now() });
      tx.create(ref.collection('updates').doc(), {
        status: p.status,
        note: p.note,
        actorUid: who.uid,
        createdAt: now(),
      });
      entityId = ref.id;
      detail = `Maintenance moved to ${p.status.replace('_', ' ')}`;
      break;
    }
    case 'sendMessage': {
      await leaseAccess(tx, org, p.leaseId, who.uid, ctx.role);
      const profile = await existing(tx, db.doc(`users/${who.uid}`));
      const ref = org.collection('messages').doc();
      tx.create(ref, {
        leaseId: p.leaseId,
        body: p.body,
        authorUid: who.uid,
        authorName: profile['displayName'],
        createdAt: now(),
      });
      return { id: ref.id };
    }
    case 'prepareDocument': {
      await leaseAccess(tx, org, p.leaseId, who.uid, ctx.role);
      const ref = org.collection('documents').doc();
      const safeName = p.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `organizations/${org.id}/documents/${ref.id}/${safeName}`;
      tx.create(ref, { ...p, path, status: 'uploading', uploadedBy: who.uid, createdAt: now() });
      entityId = ref.id;
      detail = 'Document upload prepared';
      result = { id: ref.id, path };
      break;
    }
    default:
      throw new HttpsError('invalid-argument', 'Unknown action.');
  }
  audit(tx, org, who.uid, action, entityId, detail);
  return result;
}

export const finalizeDocument = onCall(async (request) => {
  try {
    const who = identity(request);
    const p = z.object({ orgId: id, documentId: id }).parse(request.data);
    await rateLimit(who.uid);
    const ref = db.doc(`organizations/${p.orgId}/documents/${p.documentId}`);
    const snap = await ref.get();
    const data = snap.data();
    if (!data || data['uploadedBy'] !== who.uid) deny();
    const [meta] = await getStorage().bucket(documentBucket).file(data!['path']).getMetadata();
    if (Number(meta.size) !== data!['size'] || meta.contentType !== data!['contentType'])
      fail('The uploaded file does not match its document record.');
    // Immutable storage objects prevent replacing the checked bytes after validation.
    await db.runTransaction(async (tx) => {
      const { org } = await member(tx, p.orgId, who.uid, true);
      const current = await existing(tx, ref);
      if (current['status'] === 'ready') return;
      tx.update(ref, { status: 'ready', readyAt: now() });
      audit(tx, org, who.uid, 'documentReady', ref.id, 'Document uploaded');
    });
    return { ok: true };
  } catch (error) {
    return mappedError(error);
  }
});

export const adminOverview = onCall(async (request) => {
  try {
    const who = identity(request);
    await rateLimit(who.uid);
    const role = (await db.doc(`platformAdmins/${who.uid}`).get()).data()?.['role'];
    if (!['admin', 'superadmin'].includes(role)) deny();
    const [orgs, users, tickets, admins, activity] = await Promise.all([
      db.collection('organizations').count().get(),
      db.collection('users').count().get(),
      db.collection('supportTickets').orderBy('updatedAt', 'desc').limit(50).get(),
      role === 'superadmin'
        ? db.collection('platformAdmins').limit(100).get()
        : Promise.resolve(null),
      db.collection('platformActivity').orderBy('createdAt', 'desc').limit(30).get(),
    ]);
    const serialize = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
      docs.map((s) => JSON.parse(JSON.stringify({ id: s.id, ...s.data() })));
    return {
      portfolios: orgs.data().count,
      accounts: users.data().count,
      tickets: serialize(tickets.docs),
      admins: admins ? serialize(admins.docs) : [],
      activity: serialize(activity.docs),
      role,
    };
  } catch (error) {
    return mappedError(error);
  }
});
