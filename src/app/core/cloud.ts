import { Injectable, signal } from '@angular/core';
import type { User, Auth } from 'firebase/auth';
import type { Firestore, QueryConstraint } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';
import { accountContinueUrl } from './auth-flow';
import { verifiedSession } from './verified-session';
export type Row = any;
export const firebaseConfig = {
  projectId: 'kofutela',
  appId: '1:741712459601:web:56d073405b16150c4a4570',
  storageBucket: 'kofutela.firebasestorage.app',
  apiKey: 'AIzaSyDermbH2Z0GwdP-GhMxXg5Ie80Vyriq9Y0',
  authDomain: 'kofutela.firebaseapp.com',
  messagingSenderId: '741712459601',
};
export function errorMessage(e: unknown): string {
  const error = e as { code?: string; message?: string };
  const code = error.code?.replace(/^functions\//, '') || '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is not correct.',
    'auth/email-already-in-use': 'An account already uses this email. Try signing in.',
    'auth/weak-password': 'Choose a stronger password with at least 10 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
    'auth/network-request-failed':
      'Unable to connect. Check your internet connection and try again.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/unauthorized-continue-uri':
      'Email links are not configured for this address yet. Please contact support.',
    'auth/unauthorized-domain':
      'Sign-in is not configured for this address yet. Please contact support.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-token-expired': 'Your session has expired. Please sign in again.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    'auth/email-not-verified': 'Verify your email before managing your portfolio.',
    'auth/login-required': 'Sign in to continue.',
    'permission-denied': 'You do not have access to these records.',
    unavailable: 'The service is temporarily unavailable. Please try again.',
  };
  return (
    messages[code] ||
    error.message
      ?.replace(/^Firebase: /, '')
      .replace(/\s*\(auth\/.*\)\.?$/, '')
      .replace(/\s*\[\d{3}\]\s*$/, '') ||
    'Something went wrong. Please try again.'
  );
}
@Injectable({ providedIn: 'root' })
export class Cloud {
  // Firebase mutates User instances in place when reloading an email verification.
  user = signal<User | null>(null, { equal: () => false });
  session = signal<Row>(null);
  auth!: Auth;
  db!: Firestore;
  functions!: Functions;
  storage!: FirebaseStorage;
  private started?: Promise<void>;
  private verificationCheck?: Promise<boolean>;
  start(): Promise<void> {
    return (this.started ||= this.initialize().catch((e) => {
      this.started = undefined;
      throw e;
    }));
  }
  private async initialize() {
    const [a, auth, fs, fn, storage] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
      import('firebase/functions'),
      import('firebase/storage'),
    ]);
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    const emulator =
      local &&
      (new URLSearchParams(location.search).get('emulator') === '1' ||
        sessionStorage.getItem('kf-emulator') === '1');
    const app =
      a.getApps()[0] ||
      a.initializeApp(
        emulator
          ? {
              ...firebaseConfig,
              projectId: 'demo-kofutela',
              storageBucket: 'demo-kofutela.firebasestorage.app',
              apiKey: 'demo-api-key',
            }
          : firebaseConfig,
      );
    this.auth = auth.getAuth(app);
    this.db = fs.getFirestore(app);
    this.functions = fn.getFunctions(app, 'us-central1');
    this.storage = storage.getStorage(app);
    // Opt-in emulator mode is restricted to loopback origins and never enabled on Hosting.
    if (emulator) {
      sessionStorage.setItem('kf-emulator', '1');
      auth.connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fs.connectFirestoreEmulator(this.db, '127.0.0.1', 8080);
      fn.connectFunctionsEmulator(this.functions, '127.0.0.1', 5001);
      storage.connectStorageEmulator(this.storage, '127.0.0.1', 9199);
    }
    await new Promise<void>((resolve) => {
      let first = true;
      auth.onAuthStateChanged(this.auth, (user) => {
        this.user.set(user);
        if (!user) this.session.set(null);
        if (first) {
          first = false;
          resolve();
        }
      });
    });
  }
  async refreshSession() {
    const result = await this.call('session', {});
    this.session.set(result);
    return result;
  }
  async call(name: string, data: Row): Promise<Row> {
    await this.start();
    const verified = await this.checkVerification(false);
    if (!this.auth.currentUser) throw { code: 'auth/login-required' };
    if (name !== 'session' && !verified) throw { code: 'auth/email-not-verified' };
    const { httpsCallable } = await import('firebase/functions');
    const invoke = () => httpsCallable(this.functions, name)(data);
    try {
      return (await invoke()).data;
    } catch (error) {
      // This rejection happens before any command writes. Keep the original UUID
      // when retrying so a recovered session cannot duplicate an operation.
      const failure = error as { code?: string; details?: { reason?: string }; message?: string };
      if (
        failure.code === 'functions/failed-precondition' &&
        (failure.details?.reason === 'email-verification-required' ||
          failure.message?.startsWith('Verify your email before managing your portfolio.')) &&
        (await this.checkVerification(true))
      )
        return (await invoke()).data;
      throw error;
    }
  }
  async command(
    action: string,
    payload: Row,
    orgId?: string,
    requestId: string = crypto.randomUUID(),
  ) {
    return this.call('command', { action, payload, ...(orgId ? { orgId } : {}), requestId });
  }
  async login(email: string, password: string) {
    const a = await import('firebase/auth');
    const r = await a.signInWithEmailAndPassword(this.auth, email.trim(), password);
    this.user.set(r.user);
  }
  async signup(email: string, password: string, displayName: string, returnTo?: string) {
    if (!displayName.trim()) throw new Error('Please enter your name.');
    if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
    const a = await import('firebase/auth');
    const r = await a.createUserWithEmailAndPassword(this.auth, email.trim(), password);
    await a.updateProfile(r.user, { displayName: displayName.trim() });
    this.user.set(r.user);
    await this.sendVerification(returnTo);
  }
  async sendVerification(returnTo?: string) {
    const a = await import('firebase/auth');
    if (!this.auth.currentUser) throw new Error('Please sign in again to verify your email.');
    await a.sendEmailVerification(this.auth.currentUser, {
      url: accountContinueUrl(location.origin, returnTo),
    });
  }
  async checkVerification(forceRefresh = true): Promise<boolean> {
    await this.start();
    if (this.verificationCheck) return this.verificationCheck;
    const current = this.auth.currentUser;
    if (!current) {
      this.user.set(null);
      return false;
    }
    this.verificationCheck = verifiedSession(current, forceRefresh)
      .then((verified) => {
        if (this.auth.currentUser?.uid !== current.uid) return false;
        this.user.set(current);
        return verified;
      })
      .finally(() => {
        this.verificationCheck = undefined;
      });
    return this.verificationCheck;
  }
  async reset(email: string, returnTo?: string) {
    const a = await import('firebase/auth');
    try {
      await a.sendPasswordResetEmail(this.auth, email.trim(), {
        url: accountContinueUrl(location.origin, returnTo),
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    }
  }
  async logout() {
    const a = await import('firebase/auth');
    await a.signOut(this.auth);
    this.user.set(null);
    this.session.set(null);
    localStorage.removeItem('kf-workspace');
  }
  async syncRent(orgId: string, period: string, leaseId?: string) {
    let after: string | null = null;
    do {
      const result: any = await this.call('syncRent', {
        orgId,
        period,
        ...(leaseId ? { leaseId } : {}),
        ...(after ? { after } : {}),
      });
      after = result.after;
    } while (after);
  }
  async rows(
    path: string,
    filters: [string, unknown][] = [],
    max = 501,
    order?: string,
  ): Promise<Row[]> {
    const f = await import('firebase/firestore');
    const clauses: QueryConstraint[] = filters.map(([field, value]) => f.where(field, '==', value));
    if (order) clauses.push(f.orderBy(order, 'desc'));
    clauses.push(f.limit(max));
    return (await f.getDocs(f.query(f.collection(this.db, path), ...clauses))).docs.map((d) => ({
      ...d.data(),
      id: d.id,
    }));
  }
  async document(path: string): Promise<Row> {
    const f = await import('firebase/firestore');
    const d = await f.getDoc(f.doc(this.db, path));
    return d.exists() ? { ...d.data(), id: d.id } : null;
  }
  async upload(file: File, orgId: string, leaseId: string, title: string) {
    const s = await import('firebase/storage');
    const prepared = await this.command(
      'prepareDocument',
      { leaseId, title, fileName: file.name, contentType: file.type, size: file.size },
      orgId,
    );
    await s.uploadBytes(s.ref(this.storage, prepared.path), file, {
      contentType: file.type,
      cacheControl: 'private, max-age=0',
    });
    await this.call('finalizeDocument', { orgId, documentId: prepared.id });
  }
  async download(doc: Row) {
    const s = await import('firebase/storage');
    const blob = await s.getBlob(s.ref(this.storage, doc.path), 10 * 1024 * 1024);
    this.saveBlob(blob, doc.fileName);
  }
  saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
