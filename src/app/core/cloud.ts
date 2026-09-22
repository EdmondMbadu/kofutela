import { Injectable, signal } from '@angular/core';
import type { User, Auth } from 'firebase/auth';
import type { Firestore, QueryConstraint } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';
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
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is not correct.',
    'auth/email-already-in-use': 'An account already uses this email. Try signing in.',
    'auth/weak-password': 'Choose a stronger password with at least 10 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
    'auth/network-request-failed':
      'Unable to connect. Check your internet connection and try again.',
    'auth/invalid-email': 'Enter a valid email address.',
    'permission-denied': 'You do not have access to these records.',
    unavailable: 'The service is temporarily unavailable. Please try again.',
  };
  return (
    messages[error.code || ''] ||
    error.message?.replace(/^Firebase: /, '').replace(/\s*\(auth\/.*\)\.?$/, '') ||
    'Something went wrong. Please try again.'
  );
}
@Injectable({ providedIn: 'root' })
export class Cloud {
  user = signal<User | null>(null);
  session = signal<Row>(null);
  auth!: Auth;
  db!: Firestore;
  functions!: Functions;
  storage!: FirebaseStorage;
  private started?: Promise<void>;
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
    const { httpsCallable } = await import('firebase/functions');
    return (await httpsCallable(this.functions, name)(data)).data;
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
    const r = await a.signInWithEmailAndPassword(this.auth, email, password);
    this.user.set(r.user);
  }
  async signup(email: string, password: string, displayName: string) {
    const a = await import('firebase/auth');
    const r = await a.createUserWithEmailAndPassword(this.auth, email, password);
    await a.updateProfile(r.user, { displayName });
    this.user.set(r.user);
    await this.sendVerification();
  }
  async sendVerification() {
    const a = await import('firebase/auth');
    if (this.auth.currentUser)
      await a.sendEmailVerification(this.auth.currentUser, { url: `${location.origin}/login` });
  }
  async checkVerification() {
    const a = await import('firebase/auth');
    if (this.auth.currentUser) {
      await a.reload(this.auth.currentUser);
      await a.getIdToken(this.auth.currentUser, true);
      this.user.set(this.auth.currentUser);
    }
    return this.auth.currentUser?.emailVerified;
  }
  async reset(email: string) {
    const a = await import('firebase/auth');
    await a.sendPasswordResetEmail(this.auth, email, { url: `${location.origin}/login` });
  }
  async logout() {
    const a = await import('firebase/auth');
    await a.signOut(this.auth);
    this.session.set(null);
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
