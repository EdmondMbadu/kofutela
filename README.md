# Kofutela

A rental-management pilot for Kinshasa and landlords abroad. **Record keeping only: no payment processing, custody, transfers or independent payment verification.**

## Stack and design

- Angular 20 standalone components, signals, lazy routes and static prerendering. Classic Firebase Hosting; no always-on web server or App Hosting backend.
- White surfaces, black typography and WhatsApp-style green (`#25D366`). No terracotta, beige or alternate brand accents. Responsive navigation, native accessible dialogs, labelled forms, reduced-motion support and self-hosted DM Sans.
- Firebase Auth (email/password + email verification), Firestore Standard, Functions gen2 / Node 22 and private Storage, all regional data services in `us-central1`.
- Project `kofutela` / `741712459601`, web app `1:741712459601:web:56d073405b16150c4a4570`. Web API configuration is public; no service-account key is bundled.

## Implemented pilot

Marketing pages, help, pilot privacy/terms, login/signup/reset/verification, account onboarding, owner portfolio selection, properties/units, leases, email-bound tenant invitations, monthly charges, partial receipts, immutable correction history, maintenance lifecycle, lease conversations, private documents, monthly CSV export, settings, support inbox, administrator and super-administrator controls. `/demo` has fictional interactive data and never initializes Firebase.

The first verified account matching `KOFUTELA_OWNER_EMAIL` receives super-admin access once. Its immutable server-only bootstrap marker prevents client self-grants. The ignored `functions/.env.kofutela` currently configures the project owner's email. Sign up and verify that email, then open `/admin`. Never commit secrets or place role grants in client configuration.

## Local development

Node 22 and Java 21+ are required for all local tests.

```sh
npm ci
npm --prefix functions ci
npm --prefix functions run build
KOFUTELA_OWNER_EMAIL=platform@example.test npm run emulators
```

In another terminal:

```sh
npm start
```

Open `http://localhost:4200/login?emulator=1` to explicitly opt into the local demo Firebase project. The flag persists for that browser tab and is ignored on non-loopback hosts. Without it, login connects to the real Firebase project. The `/demo` visual sandbox is separate and needs no Firebase services.

## Verification

```sh
npm run test:domain
npm run test:rules
npm run test:workflows
npm run build
npm run test:seo
```

Rules and workflow tests require running emulators. They use **only** `demo-kofutela` and fictional `@example.test` accounts. The workflow suite replaces only its test owner's emulator portfolio on reruns. Do not point tests at production. Rule tests intentionally generate permission-denied logs. The test platform bootstrap uses `platform@example.test`; export that environment variable when starting emulators. `npm test -- --watch=false --browsers=ChromeHeadless` runs the Angular component smoke tests when Chrome is available.

## Access and integrity

All Firestore client writes are denied. Bounded Zod-validated callable commands enforce ownership, verified email and lease membership inside transactions. Currency uses integer minor units (two decimal places), never floating-point ledger arithmetic. UUID request receipts deduplicate retried operations; concurrent receipts cannot over-allocate. Corrections retain the original entry and reason. Ending a lease preserves past records and cancels later unpaid charges. Overlapping leases are rejected.

Tenants can query only their leases and related records. User profiles and support requests stay account-private. Platform admins see counts and support, **not** unrestricted portfolio data. Storage creates require owner identity and server-prepared exact path, size and MIME metadata. Files become readable only after server finalization. Overwrite/delete/list are denied. The app uses authenticated byte downloads, not public token links. CORS allows only Kofutela Hosting/custom-domain origins.

## Deployment

```sh
npm run build
npx -y firebase-tools@latest deploy --project kofutela --only firestore,auth,storage,functions,hosting
```

Blaze is enabled. The default document bucket is `kofutela.firebasestorage.app` in `US-CENTRAL1`. The ignored Functions environment file must exist before deployment. A one-day Artifact Registry cleanup policy removes old generated deployment images; it does not remove running Functions or application data.

Functions use `minInstances: 0`, `maxInstances: 3`, 256 MiB, a 30-second timeout and per-account command throttling. Marketing and demo navigation use no database or Functions calls. Firebase modules load only for account workflows. There are no scheduled jobs, external search services, SMS login, analytics or AI API calls.

Low pilot usage can fit within free allowances, but **$0–2 is a target, not a hard cap or guarantee**. Builds, artifact storage, Firestore reads, file downloads, logs and abuse can incur charges. `maxInstances` and budget alerts are not spending caps. Set project-specific billing alerts at $1/$2/$5 before inviting users. No automatic shutoff or billing alert is currently claimed as configured.

## Connecting kofutela.com later

DNS has not been changed. The domain remains at GoDaddy. When ready:

1. Add `kofutela.com` and `www.kofutela.com` in Firebase Hosting → Custom domain.
2. Add **only the exact DNS values Firebase provides** at GoDaddy. Preserve mail/MX and unrelated records. Choose a primary host and redirect the other.
3. Wait for ownership verification and Firebase-managed TLS.
4. Change `SITE_URL` in `src/app/core/site.ts`, and origins in `public/sitemap.xml`, `public/robots.txt`, `public/llms.txt`, and the SEO test to `https://kofutela.com`; rebuild and deploy.
5. Verify Auth authorized domains, password-reset/verification redirects, authenticated document CORS, canonical URLs and a real device login. Submit the sitemap to Search Console. Do not point canonical URLs at the custom domain before it works.

Public pages contain full static HTML, unique titles, descriptions, canonical/Open Graph tags and WebSite structured data. Private routes and the demo are `noindex`; Firebase rules—not robots.txt—protect private data. OAI-SearchBot may crawl public pages. GPTBot training crawling is separately disallowed. `llms.txt` is informational and not a guarantee of indexing or an access control.

## Deliberate pilot boundaries / next refinements

- English interface; French localization remains to be added. No native mobile app, offline mutations or push/email notification system. Messages/replies are refreshed on demand.
- One owned portfolio per account; tenant membership in other portfolios is supported. No delegated property-manager role yet.
- Leases cover at most 24 calendar months, full monthly charges, due days 1–28, no automatic prorating. Future-dated lease terminations are not supported. Monthly reports are not a full accounting ledger.
- Views are bounded at 500 records, with totals disabled if the limit is exceeded. Larger portfolio pagination/aggregate dashboards must be implemented before expanding beyond the pilot.
- Document uploads support PDF/JPEG/PNG/WebP up to 10 MB. Failed uploads can leave a pending metadata record; retry as a new upload. No malware scanner, file removal UI, property photos or automated retention policy yet. Do not upload identity documents during the pilot.
- Contact support is currently authenticated/in-app. Final operator identity, public contact details and jurisdiction-reviewed privacy/terms are required before broad commercial launch. Current pages disclose this.
- App Check enforcement, recovery/backups, automated account deletion, stronger production abuse monitoring, and operator incident procedures should be finished before broad launch. No compliance or availability certification is claimed.

See `firestore.rules`, `storage.rules`, `functions/src/domain.ts`, `functions/src/index.ts` and the tests for the implemented guarantees. A detailed local query/security analysis is maintained in ignored `.local/security-design.md`.
