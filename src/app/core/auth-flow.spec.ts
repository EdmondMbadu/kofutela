import { accountContinueUrl, accountDestination } from './auth-flow';

describe('Account destinations', () => {
  it('preserves private destinations, queries, invitation tokens and fragments', () => {
    for (const path of [
      '/app/rent?month=2026-10',
      '/join?token=a_b-c',
      '/admin',
      '/super-admin',
      '/app#setup',
    ]) {
      expect(accountDestination(path)).toBe(path);
    }
  });
  it('rejects external, malformed and traversal destinations', () => {
    for (const path of [
      null,
      '',
      '//evil.test/app',
      'https://evil.test/app',
      '/\\evil.test/app',
      '/app/../../login',
      '/app/../join/../../evil',
      '/application',
      '/signup',
      '/app\n',
    ]) {
      expect(accountDestination(path)).toBe('/app');
    }
  });
  it('returns email links to the same origin and preserves invitations', () => {
    for (const origin of [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://kofutela.web.app',
      'https://kofutela.com',
    ]) {
      const url = new URL(accountContinueUrl(origin, '/join?token=private-invitation'));
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('returnTo')).toBe('/join?token=private-invitation');
    }
  });
});
