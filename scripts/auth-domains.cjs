// firebase-tools 15.8 provisions providers but ignores auth.authorizedDomains.
// Reuse the installed CLI's authenticated API client; never read or print tokens.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { getProjectDefaultAccount, setActiveAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { getAuthDomains, updateAuthDomains } = require('firebase-tools/lib/gcp/auth');

async function main() {
  const root = resolve(__dirname, '..');
  const config = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
  const project =
    process.env.GCLOUD_PROJECT ||
    JSON.parse(readFileSync(resolve(root, '.firebaserc'), 'utf8')).projects.default;
  const required = config.auth.authorizedDomains;
  if (
    !required.length ||
    required.some(
      (domain) => typeof domain !== 'string' || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(domain),
    )
  ) {
    throw new Error('Auth domains must be hostnames without protocols, ports or trailing dots.');
  }
  const options = { project, nonInteractive: true };
  const account = getProjectDefaultAccount(root);
  if (account) setActiveAccount(options, account);
  await requireAuth(options);
  const current = await getAuthDomains(project);
  const merged = [...new Set([...current, ...required])];
  if (merged.length !== current.length) await updateAuthDomains(project, merged);
  const actual = await getAuthDomains(project);
  if (required.some((domain) => !actual.includes(domain))) {
    throw new Error('Firebase did not retain every required authorized domain.');
  }
  console.log(`Verified Firebase Auth domains for ${project}: ${actual.join(', ')}`);
}
main().catch((error) => {
  console.error(`Auth domain synchronization failed: ${error.message}`);
  process.exitCode = 1;
});
