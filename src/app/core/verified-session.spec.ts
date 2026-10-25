import type { User } from 'firebase/auth';
import { verifiedSession } from './verified-session';

describe('Verified session', () => {
  function account(profileVerified: boolean, tokenVerified: boolean, savedVerified: boolean) {
    const user = {
      emailVerified: profileVerified,
      reload: jasmine.createSpy('reload').and.callFake(async () => {
        user.emailVerified = savedVerified;
      }),
      getIdTokenResult: jasmine
        .createSpy('getIdTokenResult')
        .and.callFake(async (force = false) => ({
          claims: { email_verified: force ? savedVerified : tokenVerified },
        })),
    };
    return user;
  }
  it('refreshes a stale token even when the UI already shows a verified profile', async () => {
    const user = account(true, false, true);
    expect(await verifiedSession(user as unknown as User)).toBeTrue();
    expect(user.reload).toHaveBeenCalledTimes(1);
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
  });
  it('reloads verification performed in a different tab', async () => {
    const user = account(false, false, true);
    expect(await verifiedSession(user as unknown as User)).toBeTrue();
    expect(user.emailVerified).toBeTrue();
  });
  it('keeps genuinely unverified accounts blocked', async () => {
    const user = account(false, false, false);
    expect(await verifiedSession(user as unknown as User)).toBeFalse();
  });
  it('requires both the profile and token to be verified', async () => {
    const user = account(true, false, false);
    expect(await verifiedSession(user as unknown as User)).toBeFalse();
  });
  it('reuses valid verified tokens without an extra network refresh', async () => {
    const user = account(true, true, true);
    expect(await verifiedSession(user as unknown as User)).toBeTrue();
    expect(user.reload).not.toHaveBeenCalled();
  });
  it('exposes refresh failures so mutations cannot continue', async () => {
    const user = account(true, false, true);
    user.reload.and.rejectWith(new Error('Offline'));
    await expectAsync(verifiedSession(user as unknown as User)).toBeRejectedWithError('Offline');
  });
});
