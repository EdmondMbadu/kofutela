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

## Account creation and setup

1. `/signup`: enter a name, valid email, unique password of at least 10 characters, and acknowledge the pilot terms/privacy notice. The account is saved before the verification email is sent; a failed email can be resent without creating another account.
2. Email verification: Firebase's hosted email-action page validates the email link. The original Kofutela tab checks every five seconds while visible and on focus; the manual verification button also refreshes the ID token before entering the app. Resends have a 60-second cooldown. Expired links can be replaced with a resend.
3. `/app`: a new owner creates a named portfolio in USD or CDF. A saved five-step checklist then opens the existing property, lease, and invitation forms in order. Vacant properties can stop before adding a lease. Setup progress comes from saved records and survives reloads.
4. Tenant path: `/join?token=…` carries its invitation through signup, verification, login and password recovery. The tenant signs in with the invited email and accepts the invitation instead of creating a portfolio. A different account can be selected without losing the invitation. Invitations expire after seven days and are email-bound and single-use.
5. Returning users: verified login/signup sessions resume the requested private route automatically. Password recovery remains accessible even when the current account is unverified. External redirect destinations are rejected.

Protected calls synchronize both the Firebase user record and the ID token's `email_verified` claim. A saved verified profile alone is insufficient for Firestore/Storage access. The server also checks the authoritative Auth record when an older valid token still says unverified, while rejecting unverified, disabled, or email-mismatched records. Verification failures can refresh and retry once with the same command UUID; other errors are not retried automatically.

Authenticated document downloads allow the four production origins and development at `http://localhost:4200` / `http://127.0.0.1:4200`. `storage.cors.json` records those origins; `npm run storage:cors` merges missing origins without removing existing CORS rules and verifies the live bucket. The Storage predeploy hook runs it automatically. This does not make document bytes public.

### UI action map

| UI control | Backend operation | Result |
| --- | --- | --- |
| Create portfolio | `createWorkspace` | Organization, owner membership, profile, saved setup progress |
| Add/edit property; add unit | `createProperty`, `updateProperty`, `createUnit` | Persisted properties/units; refreshed list |
| Add lease; end lease | `createLease`, `endLease` | Available unit only; rent/currency prefill; schedule or historical termination |
| Invite tenant; accept invitation | `createInvite`, `acceptInvite` | Private email-bound link; tenant membership |
| Record/correct receipt | `recordReceipt`, `voidReceipt` | Integer minor units; correct charge/receipt ID; immutable history |
| New/update maintenance | `createMaintenance`, `updateMaintenance` | Scoped lease and ticket; allowed status transition |
| Send message; switch conversation | `sendMessage`, scoped message query | Correct lease; draft/request ID reset on conversation change |
| Upload/download document | `prepareDocument`, Storage upload, `finalizeDocument`; authenticated download | File validation and private lease access |
| Edit name/portfolio | `updateProfile`, `updateWorkspace` | Saved settings and refreshed session |
| Support request/reply | `createSupport`, `updateSupport` | Private ticket and reply; works before portfolio creation |
| Platform access | `setPlatformRole`, `adminOverview` | Server-enforced administrator permissions |
| Month/currency/report export | Scoped queries and `exportCsv` | Separate currencies and formula-safe CSV |
| Portfolio selector; refresh; logout | Membership query, scoped data reload, Firebase sign-out | Stale loads discarded; account errors surfaced |

`test:ui-actions` extracts every dialog action from the actual template, builds its production payload, and validates it against the exact server schema. Component tests also exercise record IDs, form retries, unit defaults, support loading, and verification mismatches.

Verification and recovery links return to the originating host, including the development port. Authorized hosts are `localhost`, `127.0.0.1`, `kofutela.web.app`, `kofutela.firebaseapp.com`, `kofutela.com`, and `www.kofutela.com`. Hostnames have no protocol, port, slash, or trailing dot. Authorizing a custom domain does not configure its DNS or Hosting certificate.

`firebase-tools` 15.8 deploys Auth providers but **ignores** `auth.authorizedDomains`. The Auth predeploy hook runs `npm run auth:domains` to merge the configured hosts into the live allowlist, preserve other existing hosts, and read back the result. It reuses the installed CLI's existing authenticated client (or application default credentials); it never prints tokens. Run `npm run auth:domains` independently to repair or verify live domains. The helper uses internal CLI APIs, so verify it when upgrading `firebase-tools`.

## Verification

### French interface terminology

Use French rental-management wording consistently across navigation, dialogs, status badges, errors, activity history and CSV exports:

| Concept | French wording |
| --- | --- |
| Property / properties | Propriété / propriétés |
| Portfolio | Parc immobilier |
| Rentable unit, including commercial space | Logement ou local |
| Tenant navigation and creating a rental | Locataires / ajouter un locataire |
| Rental period and ending a rental | Location; en cours / terminée; terminer la location |
| Actual contract document | Contrat de location |
| Rent records / scheduled rent | Suivi des loyers / loyer dû |
| Received payment entered by the landlord | Paiement enregistré |
| Outstanding rent / reverse a recorded payment | Reste à payer / annuler l’enregistrement |
| Maintenance request | Demande de réparation; signalée / prise en charge / en cours / résolue / fermée |

`translation-context.ts` separates rent, receipt, rental period, invitations, repair, support, occupancy, document, payment-method and role labels. Prefer everyday French over administrative wording: use « Locataires » in navigation and « Terminer la location » for the action. Reserve « contrat de location » for an actual agreement/document. Keep the existing English copy and stored field/action names unchanged. The UI does not call a payment entry a generated quittance. The interface uses `fr-CD` for localized dates and currency display. Stored property/unit names, addresses, people, messages and support text stay verbatim. Only explicitly marked, unchanged authored demo samples may be translated; editing them removes that presentation behavior. New French copy should follow this glossary and the rendered-screen regressions in `i18n.spec.ts`.

```sh
npm run test:domain
npm run test:rules
npm run test:workflows
npm run test:accounts
npm run test:ui-actions
npm run build
npm run test:seo
```

Rules, workflow, and account tests require running emulators. They use **only** `demo-kofutela` and fictional `@example.test` accounts. The workflow suite replaces only its test owner's emulator portfolio on reruns. Do not point tests at production. Rule tests intentionally generate permission-denied logs. The account suite exercises signup, email action links, verification/token refresh, portfolio persistence, and password recovery. The test platform bootstrap uses `platform@example.test`; export that environment variable when starting emulators. `npm test -- --watch=false --browsers=ChromeHeadless` runs the Angular component, account-flow, and setup regression tests when Chrome is available.

## Access and integrity

All Firestore client writes are denied. Bounded Zod-validated callable commands enforce ownership, verified email and lease membership inside transactions. Currency uses integer minor units (two decimal places), never floating-point ledger arithmetic. UUID request receipts deduplicate retried operations; concurrent receipts cannot over-allocate. Corrections retain the original entry and reason. Ending a lease preserves past records and cancels later unpaid charges. Overlapping leases are rejected.

Tenants can query only their leases and related records. User profiles and support requests stay account-private. Platform admins see counts and support, **not** unrestricted portfolio data. Storage creates require owner identity and server-prepared exact path, size and MIME metadata. Files become readable only after server finalization. Overwrite/delete/list are denied. The app uses authenticated byte downloads, not public token links. CORS allows Kofutela Hosting/custom-domain origins and the two explicit local development origins in `storage.cors.json`.

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

- English and French interfaces. No native mobile app, offline mutations or push/email notification system. Messages/replies are refreshed on demand.
- One owned portfolio per account; tenant membership in other portfolios is supported. No delegated property-manager role yet.
- Leases cover at most 24 calendar months, full monthly charges, due days 1–28, no automatic prorating. Future-dated lease terminations are not supported. Monthly reports are not a full accounting ledger.
- Views are bounded at 500 records, with totals disabled if the limit is exceeded. Larger portfolio pagination/aggregate dashboards must be implemented before expanding beyond the pilot.
- Document uploads support PDF/JPEG/PNG/WebP up to 10 MB. Failed uploads can leave a pending metadata record; retry as a new upload. No malware scanner, file removal UI, property photos or automated retention policy yet. Do not upload identity documents during the pilot.
- Contact support is currently authenticated/in-app. Final operator identity, public contact details and jurisdiction-reviewed privacy/terms are required before broad commercial launch. Current pages disclose this.
- App Check enforcement, recovery/backups, automated account deletion, stronger production abuse monitoring, and operator incident procedures should be finished before broad launch. No compliance or availability certification is claimed.

See `firestore.rules`, `storage.rules`, `functions/src/domain.ts`, `functions/src/index.ts` and the tests for the implemented guarantees. A detailed local query/security analysis is maintained in ignored `.local/security-design.md`.
