import type { User } from 'firebase/auth';

/** A profile's emailVerified flag and its cached ID token can disagree after an email action. */
export async function verifiedSession(user: User, forceRefresh = false): Promise<boolean> {
  let token = await user.getIdTokenResult();
  if (forceRefresh || !user.emailVerified || token.claims['email_verified'] !== true) {
    await user.reload();
    token = await user.getIdTokenResult(true);
  }
  return user.emailVerified && token.claims['email_verified'] === true;
}
