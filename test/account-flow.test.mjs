import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  applyActionCode,
  reload,
  getIdTokenResult,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

// Isolated, disposable emulator accounts only. Never read production credentials.
const projectId = 'demo-kofutela';
assert.match(projectId, /^demo-/);
const host = 'http://127.0.0.1:9099';
async function emailAction(email, type) {
  const response = await fetch(`${host}/emulator/v1/projects/${projectId}/oobCodes`);
  assert.equal(response.status, 200);
  const body = await response.json();
  const action = body.oobCodes
    .filter((code) => code.email === email && code.requestType === type)
    .at(-1);
  assert.ok(action, `Expected ${type} for the test account`);
  return action;
}

test(
  'new account verifies its email, creates a portfolio, and recovers its password',
  { timeout: 30000 },
  async () => {
    const app = initializeApp(
      { projectId, apiKey: 'demo-api-key' },
      `account-${crypto.randomUUID()}`,
    );
    const auth = getAuth(app);
    connectAuthEmulator(auth, host, { disableWarnings: true });
    const functions = getFunctions(app, 'us-central1');
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;
    const email = `signup-${crypto.randomUUID()}@example.test`;
    const password = 'Local-test-only-123!';
    const destination = '/join?token=fictional-invitation';
    const continueUrl = `http://localhost:4200/login?returnTo=${encodeURIComponent(destination)}`;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: 'Signup Test' });
      assert.equal(user.emailVerified, false);
      assert.equal(user.displayName, 'Signup Test');
      const empty = await call('session', {});
      assert.equal(empty.memberships.length, 0);
      const request = {
        action: 'createWorkspace',
        requestId: crypto.randomUUID(),
        payload: { name: 'Signup portfolio', displayName: 'Signup Test', currency: 'USD' },
      };
      await assert.rejects(call('command', request), /Verify your email/);

      await sendEmailVerification(user, { url: continueUrl });
      const verification = await emailAction(email, 'VERIFY_EMAIL');
      const link = new URL(verification.oobLink);
      assert.equal(
        new URL(link.searchParams.get('continueUrl')).searchParams.get('returnTo'),
        destination,
      );
      assert.equal(user.emailVerified, false);
      await applyActionCode(auth, verification.oobCode);
      await reload(user);
      const token = await getIdTokenResult(user, true);
      assert.equal(user.emailVerified, true);
      assert.equal(token.claims.email_verified, true);

      const portfolio = await call('command', request);
      assert.equal(portfolio.id, user.uid);
      assert.deepEqual(await call('command', request), portfolio);
      const session = await call('session', {});
      assert.equal(session.memberships.length, 1);
      assert.equal(session.memberships[0].role, 'owner');
      assert.equal(session.profile.displayName, 'Signup Test');
      await signOut(auth);
      await signInWithEmailAndPassword(auth, email, password);
      assert.equal((await call('session', {})).memberships[0].id, portfolio.id);

      await sendPasswordResetEmail(auth, email, { url: continueUrl });
      const recovery = await emailAction(email, 'PASSWORD_RESET');
      assert.equal(new URL(recovery.oobLink).searchParams.get('continueUrl'), continueUrl);
      assert.equal(await verifyPasswordResetCode(auth, recovery.oobCode), email);
      const newPassword = 'Changed-local-test-456!';
      await confirmPasswordReset(auth, recovery.oobCode, newPassword);
      await assert.rejects(confirmPasswordReset(auth, recovery.oobCode, newPassword));
      await signOut(auth);
      await signInWithEmailAndPassword(auth, email, newPassword);
      assert.equal((await call('session', {})).memberships[0].id, portfolio.id);
    } finally {
      await signOut(auth);
      await deleteApp(app);
    }
  },
);
