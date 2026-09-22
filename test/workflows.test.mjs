import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  terminate,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from 'firebase/storage';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
const { initializeApp: adminInit, deleteApp: adminDelete } = require('firebase-admin/app');
const { getAuth: adminAuth } = require('firebase-admin/auth');
const { getFirestore: adminFirestore } = require('firebase-admin/firestore');
const projectId = 'demo-kofutela';
assert.match(projectId, /^demo-/, 'This suite must never target production');
const admin = adminInit(
  { projectId, storageBucket: `${projectId}.firebasestorage.app` },
  'workflow-tests',
);
const password = 'Local-test-only-123!';
const clients = [];
async function client(name, verified = true) {
  const email = `${name}@example.test`;
  let user;
  try {
    user = await adminAuth(admin).getUserByEmail(email);
  } catch {
    user = await adminAuth(admin).createUser({
      email,
      password,
      emailVerified: verified,
      displayName: name,
    });
  }
  const app = initializeApp(
    { projectId, apiKey: 'demo-api-key', storageBucket: `${projectId}.firebasestorage.app` },
    name,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email, password);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fn = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  const c = {
    app,
    auth,
    db,
    fn,
    storage,
    uid: user.uid,
    call: async (name, payload) => (await httpsCallable(fn, name)(payload)).data,
  };
  c.command = (action, payload, orgId, requestId = crypto.randomUUID()) =>
    c.call('command', { action, payload, ...(orgId ? { orgId } : {}), requestId });
  clients.push(c);
  return c;
}
const rejected = async (promise, pattern) => {
  await assert.rejects(promise, pattern);
};
test(
  'complete landlord, tenant, document and platform workflows with isolation and idempotency',
  { timeout: 120000 },
  async (t) => {
    const owner = await client('owner');
    const tenant = await client('tenant');
    const stranger = await client('stranger');
    const unverified = await client('unverified', false);
    const platform = await client('platform');
    let org, property, unit, lease, charge, receipt, invite, ticket, document;
    try {
      await t.test('verified owner bootstrap and private sessions', async () => {
        for (const c of clients) await c.call('session', {});
        const session = await platform.call('session', {});
        assert.equal(session.platformRole, 'superadmin');
        await rejected(owner.call('adminOverview', {}), /access/);
        await rejected(
          unverified.command('createWorkspace', {
            name: 'Rejected',
            currency: 'USD',
            displayName: 'Unverified',
          }),
          /Verify/,
        );
      });
      await t.test('onboarding, property and unit creation', async () => {
        // Re-runnable only in this isolated demo project; use a fresh owner portfolio if absent.
        const existing = await adminFirestore(admin).doc(`organizations/${owner.uid}`).get();
        if (existing.exists) await adminFirestore(admin).recursiveDelete(existing.ref);
        org = (
          await owner.command('createWorkspace', {
            name: 'Test portfolio',
            currency: 'USD',
            displayName: 'Test owner',
          })
        ).id;
        property = (
          await owner.command(
            'createProperty',
            {
              name: 'Test home',
              address: 'Fictional test address',
              city: 'Kinshasa',
              type: 'house',
              unitCount: 1,
              rentMinor: 65000,
              currency: 'USD',
            },
            org,
          )
        ).id;
        unit = (
          await getDocs(
            query(
              collection(owner.db, `organizations/${org}/units`),
              where('propertyId', '==', property),
            ),
          )
        ).docs[0].id;
        await rejected(
          stranger.command(
            'createUnit',
            { propertyId: property, label: 'Intrusion', rentMinor: 100, currency: 'USD' },
            org,
          ),
          /access/,
        );
        await rejected(
          setDoc(doc(owner.db, `organizations/${org}/units/forged`), { role: 'owner' }),
          /permission/i,
        );
      });
      await t.test('validated lease produces bounded monthly charges', async () => {
        const payload = {
          unitId: unit,
          tenantName: 'Test tenant',
          tenantEmail: 'tenant@example.test',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          dueDay: 5,
          rentMinor: 65000,
          currency: 'USD',
        };
        await rejected(
          owner.command('createLease', { ...payload, endDate: '2028-12-31' }, org),
          /24/,
        );
        lease = (await owner.command('createLease', payload, org)).id;
        const charges = await getDocs(
          query(
            collection(owner.db, `organizations/${org}/charges`),
            where('leaseId', '==', lease),
          ),
        );
        assert.equal(charges.size, 12);
        charge = `${lease}_2026-09`;
        await rejected(owner.command('createLease', payload, org), /active lease/);
      });
      await t.test('invitation is email-bound, single-use and revocable', async () => {
        const old = await owner.command('createInvite', { leaseId: lease }, org);
        invite = await owner.command('createInvite', { leaseId: lease }, org);
        await rejected(
          tenant.command('acceptInvite', { token: old.token, displayName: 'Tenant' }),
          /expired/,
        );
        await rejected(
          stranger.command('acceptInvite', { token: invite.token, displayName: 'Stranger' }),
          /access/,
        );
        assert.equal(
          (
            await tenant.command('acceptInvite', {
              token: invite.token,
              displayName: 'Test tenant',
            })
          ).id,
          org,
        );
        await rejected(
          tenant.command('acceptInvite', { token: invite.token, displayName: 'Test tenant' }),
          /expired/,
        );
        assert.equal(
          (await getDoc(doc(tenant.db, `organizations/${org}/leases/${lease}`))).data().tenantUid,
          tenant.uid,
        );
        await rejected(
          getDoc(doc(stranger.db, `organizations/${org}/leases/${lease}`)),
          /permission/i,
        );
      });
      await t.test(
        'partial receipts, retries and parallel writes preserve the ledger',
        async () => {
          const payload = {
            chargeId: charge,
            amountMinor: 10000,
            receivedOn: '2026-09-01',
            method: 'cash',
          };
          const requestId = crypto.randomUUID();
          receipt = (await owner.command('recordReceipt', payload, org, requestId)).id;
          assert.equal((await owner.command('recordReceipt', payload, org, requestId)).id, receipt);
          await rejected(
            owner.command('recordReceipt', { ...payload, amountMinor: 9000 }, org, requestId),
            /identifier/,
          );
          await rejected(tenant.command('recordReceipt', payload, org), /access/);
          await rejected(
            owner.command('recordReceipt', { ...payload, amountMinor: 65001 }, org),
            /larger/,
          );
          await rejected(
            owner.command('recordReceipt', { ...payload, amountMinor: 1.2 }, org),
            /integer|int/i,
          );
          const parallel = await Promise.allSettled([
            owner.command('recordReceipt', { ...payload, amountMinor: 40000 }, org),
            owner.command('recordReceipt', { ...payload, amountMinor: 40000 }, org),
          ]);
          assert.equal(parallel.filter((r) => r.status === 'fulfilled').length, 1);
          assert.equal(
            (await getDoc(doc(owner.db, `organizations/${org}/charges/${charge}`))).data()
              .receivedMinor,
            50000,
          );
          assert.equal(
            (await getDoc(doc(tenant.db, `organizations/${org}/charges/${charge}`))).data()
              .receivedMinor,
            50000,
          );
          await owner.command(
            'voidReceipt',
            { receiptId: receipt, reason: 'Test correction with history' },
            org,
          );
          assert.equal(
            (await getDoc(doc(owner.db, `organizations/${org}/charges/${charge}`))).data()
              .receivedMinor,
            40000,
          );
          await rejected(
            owner.command('voidReceipt', { receiptId: receipt, reason: 'Again' }, org),
            /already/,
          );
        },
      );
      await t.test('maintenance and messaging follow lease permissions', async () => {
        ticket = (
          await tenant.command(
            'createMaintenance',
            {
              leaseId: lease,
              title: 'Test repair',
              description: 'Fictional tap needs attention',
              priority: 'normal',
            },
            org,
          )
        ).id;
        await rejected(
          tenant.command('updateMaintenance', { ticketId: ticket, status: 'resolved' }, org),
          /status change/,
        );
        for (const status of ['acknowledged', 'in_progress', 'resolved'])
          await owner.command(
            'updateMaintenance',
            { ticketId: ticket, status, note: 'Test update' },
            org,
          );
        await tenant.command(
          'updateMaintenance',
          { ticketId: ticket, status: 'closed', note: 'Confirmed' },
          org,
        );
        await rejected(
          stranger.command('sendMessage', { leaseId: lease, body: 'Intrusion' }, org),
          /access/,
        );
        await tenant.command(
          'sendMessage',
          { leaseId: lease, body: 'Thank you for the update.' },
          org,
        );
        assert.equal(
          (
            await getDocs(
              query(
                collection(owner.db, `organizations/${org}/messages`),
                where('leaseId', '==', lease),
              ),
            )
          ).size,
          1,
        );
      });
      await t.test('private upload, finalization, download and cross-user denial', async () => {
        const bytes = new TextEncoder().encode('%PDF-1.4\nTest-only fixture.\n%%EOF');
        document = await owner.command(
          'prepareDocument',
          {
            leaseId: lease,
            title: 'Test document',
            fileName: 'test.pdf',
            contentType: 'application/pdf',
            size: bytes.length,
          },
          org,
        );
        await uploadBytes(ref(owner.storage, document.path), bytes, {
          contentType: 'application/pdf',
        });
        await owner.call('finalizeDocument', { orgId: org, documentId: document.id });
        assert.equal((await getBytes(ref(tenant.storage, document.path))).byteLength, bytes.length);
        await rejected(getBytes(ref(stranger.storage, document.path)), /permission|unauthorized/i);
        await rejected(
          uploadBytes(ref(owner.storage, document.path), bytes, { contentType: 'application/pdf' }),
          /permission|unauthorized/i,
        );
      });
      await t.test('support and platform roles do not grant financial access', async () => {
        const support = await tenant.command('createSupport', {
          subject: 'Test request',
          body: 'A fictional support request for verification.',
        });
        await platform.command('updateSupport', {
          ticketId: support.id,
          reply: 'Test response',
          status: 'closed',
        });
        assert.equal(
          (await getDoc(doc(tenant.db, `supportTickets/${support.id}`))).data().reply,
          'Test response',
        );
        await rejected(
          owner.command('setPlatformRole', { uid: owner.uid, role: 'superadmin' }),
          /access/,
        );
        await platform.command('setPlatformRole', { uid: stranger.uid, role: 'admin' });
        assert.equal((await stranger.call('adminOverview', {})).role, 'admin');
        await rejected(
          stranger.command('setPlatformRole', { uid: owner.uid, role: 'superadmin' }),
          /access/,
        );
        await rejected(
          getDoc(doc(stranger.db, `organizations/${org}/charges/${charge}`)),
          /permission/i,
        );
        await platform.command('setPlatformRole', { uid: stranger.uid, role: 'none' });
        await rejected(
          platform.command('setPlatformRole', { uid: platform.uid, role: 'none' }),
          /own platform role/,
        );
      });
      await t.test(
        'ending a lease preserves past records and cancels later unpaid rent',
        async () => {
          await owner.command(
            'endLease',
            { leaseId: lease, endDate: '2026-09-20', reason: 'Test lease completion' },
            org,
          );
          assert.equal(
            (await getDoc(doc(owner.db, `organizations/${org}/charges/${lease}_2026-10`))).data()
              .cancelled,
            true,
          );
          assert.equal(
            (await getDoc(doc(owner.db, `organizations/${org}/charges/${charge}`))).data()
              .receivedMinor,
            40000,
          );
          assert.equal(
            (await getDoc(doc(owner.db, `organizations/${org}/units/${unit}`))).data()
              .activeLeaseId,
            null,
          );
        },
      );
    } finally {
      for (const c of clients) {
        await signOut(c.auth);
        await terminate(c.db);
        await deleteApp(c.app);
      }
      await adminDelete(admin);
    }
  },
);
