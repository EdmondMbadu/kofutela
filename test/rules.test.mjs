import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env;
const verified = { email_verified: true };
const firestore = (uid) =>
  uid
    ? env.authenticatedContext(uid, verified).firestore()
    : env.unauthenticatedContext().firestore();
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kofutela',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: readFileSync('storage.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const records = {
      'organizations/one': { name: 'One', ownerUid: 'owner' },
      'organizations/two': { name: 'Two', ownerUid: 'stranger' },
      'organizations/one/members/owner': { role: 'owner' },
      'organizations/one/members/tenant': { role: 'tenant' },
      'organizations/one/members/otherTenant': { role: 'tenant' },
      'organizations/two/members/stranger': { role: 'owner' },
      'organizations/one/properties/p': { name: 'Private home' },
      'organizations/one/units/u': { propertyId: 'p' },
      'organizations/one/leases/lease': { tenantUid: 'tenant' },
      'organizations/one/leases/other': { tenantUid: 'otherTenant' },
      'organizations/one/charges/charge': { leaseId: 'lease', period: '2026-09' },
      'organizations/one/charges/other': { leaseId: 'other', period: '2026-09' },
      'organizations/one/receipts/receipt': { leaseId: 'lease' },
      'organizations/one/maintenance/ticket': { leaseId: 'lease' },
      'organizations/one/messages/message': { leaseId: 'lease', body: 'Private message' },
      'organizations/one/documents/file': {
        leaseId: 'lease',
        status: 'ready',
        path: 'organizations/one/documents/file/lease.pdf',
        size: 5,
        contentType: 'application/pdf',
      },
      'organizations/one/documents/pending': {
        leaseId: 'lease',
        status: 'uploading',
        uploadedBy: 'owner',
        path: 'organizations/one/documents/pending/lease.pdf',
        size: 5,
        contentType: 'application/pdf',
      },
      'organizations/one/activity/log': { detail: 'Private log' },
      'users/tenant': { email: 'tenant@example.test' },
      'users/owner': { email: 'owner@example.test' },
      'users/tenant/memberships/one': { role: 'tenant' },
      'platformAdmins/admin': { role: 'admin' },
      'platformAdmins/super': { role: 'superadmin' },
      'invitations/token': { email: 'tenant@example.test' },
      'supportTickets/ticket': { uid: 'tenant', body: 'Private support' },
    };
    await Promise.all(Object.entries(records).map(([path, data]) => setDoc(doc(db, path), data)));
    await uploadBytes(
      ref(context.storage(), 'organizations/one/documents/file/lease.pdf'),
      new Uint8Array(5),
      { contentType: 'application/pdf' },
    );
  });
});
after(async () => env?.cleanup());

test('unauthenticated and unverified accounts cannot access portfolio data', async () => {
  for (const db of [
    firestore(),
    env.authenticatedContext('owner', { email_verified: false }).firestore(),
  ]) {
    await assertFails(getDoc(doc(db, 'organizations/one')));
    await assertFails(getDoc(doc(db, 'organizations/one/charges/charge')));
  }
});
test('owners read only their own portfolio; admins have no blanket financial access', async () => {
  await assertSucceeds(getDoc(doc(firestore('owner'), 'organizations/one/properties/p')));
  for (const uid of ['stranger', 'admin', 'super'])
    await assertFails(getDoc(doc(firestore(uid), 'organizations/one/charges/charge')));
  await assertFails(getDoc(doc(firestore('owner'), 'organizations/two')));
});
test('tenants read their lease and its records but never another lease or owner data', async () => {
  const db = firestore('tenant');
  for (const path of [
    'leases/lease',
    'charges/charge',
    'receipts/receipt',
    'maintenance/ticket',
    'messages/message',
    'documents/file',
  ])
    await assertSucceeds(getDoc(doc(db, `organizations/one/${path}`)));
  for (const path of [
    'leases/other',
    'charges/other',
    'properties/p',
    'units/u',
    'activity/log',
    'documents/pending',
  ])
    await assertFails(getDoc(doc(db, `organizations/one/${path}`)));
});
test('queries must carry the tenant scope and ready-document status', async () => {
  const db = firestore('tenant');
  await assertSucceeds(
    getDocs(query(collection(db, 'organizations/one/leases'), where('tenantUid', '==', 'tenant'))),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(db, 'organizations/one/charges'),
        where('leaseId', '==', 'lease'),
        where('period', '==', '2026-09'),
      ),
    ),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(db, 'organizations/one/documents'),
        where('leaseId', '==', 'lease'),
        where('status', '==', 'ready'),
      ),
    ),
  );
  await assertFails(getDocs(collection(db, 'organizations/one/leases')));
  await assertFails(getDocs(collection(db, 'organizations/one/charges')));
  await assertFails(
    getDocs(query(collection(db, 'organizations/one/documents'), where('leaseId', '==', 'lease'))),
  );
});
test('every client mutation is denied including role escalation and forged financial fields', async () => {
  const paths = [
    'organizations/one',
    'organizations/one/members/owner',
    'organizations/one/charges/charge',
    'organizations/one/receipts/receipt',
    'users/owner',
    'platformAdmins/owner',
    'platformConfig/bootstrap',
    'invitations/token',
    'rateLimits/owner',
    'commandReceipts/forged',
  ];
  for (const uid of ['owner', 'tenant', 'admin', 'super'])
    for (const path of paths) {
      await assertFails(
        setDoc(doc(firestore(uid), path), {
          role: 'superadmin',
          receivedMinor: 999,
          tenantUid: uid,
        }),
      );
    }
  await assertFails(
    updateDoc(doc(firestore('owner'), 'organizations/one/charges/charge'), { receivedMinor: 100 }),
  );
  await assertFails(deleteDoc(doc(firestore('owner'), 'organizations/one/charges/charge')));
});
test('profile, invitation and support PII stay private', async () => {
  await assertSucceeds(getDoc(doc(firestore('tenant'), 'users/tenant')));
  await assertSucceeds(getDoc(doc(firestore('tenant'), 'supportTickets/ticket')));
  for (const path of ['users/owner', 'invitations/token', 'platformAdmins/super'])
    await assertFails(getDoc(doc(firestore('tenant'), path)));
  await assertFails(getDoc(doc(firestore('owner'), 'supportTickets/ticket')));
});
test('document bytes require lease access and immutable, exact uploads', async () => {
  const stored = 'organizations/one/documents/file/lease.pdf';
  for (const uid of ['owner', 'tenant'])
    await assertSucceeds(getBytes(ref(env.authenticatedContext(uid, verified).storage(), stored)));
  await assertFails(
    getBytes(ref(env.authenticatedContext('otherTenant', verified).storage(), stored)),
  );
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), stored)));
  const ownerStorage = env.authenticatedContext('owner', verified).storage();
  await assertFails(
    uploadBytes(ref(ownerStorage, stored), new Uint8Array(5), { contentType: 'application/pdf' }),
  );
  await assertFails(deleteObject(ref(ownerStorage, stored)));
  const pending = 'organizations/one/documents/pending/lease.pdf';
  await assertFails(
    uploadBytes(ref(ownerStorage, pending), new Uint8Array(6), { contentType: 'application/pdf' }),
  );
  await assertFails(
    uploadBytes(ref(ownerStorage, pending), new Uint8Array(5), { contentType: 'text/html' }),
  );
  await assertFails(
    uploadBytes(
      ref(env.authenticatedContext('tenant', verified).storage(), pending),
      new Uint8Array(5),
      { contentType: 'application/pdf' },
    ),
  );
  await assertSucceeds(
    uploadBytes(ref(ownerStorage, pending), new Uint8Array(5), { contentType: 'application/pdf' }),
  );
  await assertFails(getBytes(ref(ownerStorage, pending)));
});
