// CORS permits authenticated browser downloads; Storage rules still enforce lease access.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { getProjectDefaultAccount, setActiveAccount } = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
async function main() {
  const root = resolve(__dirname, '..');
  const project =
    process.env.GCLOUD_PROJECT ||
    JSON.parse(readFileSync(resolve(root, '.firebaserc'), 'utf8')).projects.default;
  const expected = JSON.parse(readFileSync(resolve(root, 'storage.cors.json'), 'utf8'));
  const options = { project, nonInteractive: true };
  const account = getProjectDefaultAccount(root);
  if (account) setActiveAccount(options, account);
  await requireAuth(options);
  const client = new Client({ urlPrefix: 'https://storage.googleapis.com', auth: true });
  const path = `/storage/v1/b/${project}.firebasestorage.app`;
  const read = async () =>
    (await client.get(path, { queryParams: { fields: 'cors' } })).body.cors || [];
  const current = await read();
  const covered = (rules, origin) =>
    rules.some((rule) => rule.origin?.includes(origin) && rule.method?.includes('GET'));
  const additions = expected
    .map((rule) => ({ ...rule, origin: rule.origin.filter((origin) => !covered(current, origin)) }))
    .filter((rule) => rule.origin.length);
  if (additions.length) await client.patch(path, { cors: [...current, ...additions] });
  const actual = await read();
  if (expected.some((rule) => rule.origin.some((origin) => !covered(actual, origin))))
    throw new Error('Storage did not retain all required download origins.');
  console.log(`Verified authenticated document download origins for ${project}.`);
}
main().catch((error) => {
  console.error(`Storage CORS synchronization failed: ${error.message}`);
  process.exitCode = 1;
});
