# CharliiAI storage availability fix — 2026-10-20

## Scope and root cause

Production Pages deployment `52f82099-4617-462f-ab1a-83da9ce61a83` reports commit
`ac34e2f67ca8d0dbec60c4570b556826585d147a`. This branch starts at that commit.

Blocking all Storage methods reproduces a startup failure even with the growth
SDK disabled. Storage call stacks identify three independent application paths:

- The inline document theme script and React theme initialization read `darkMode`.
- Interaction analytics reads session deduplication keys directly; its safe
  helpers also receive storage objects whose getters can throw before the helper.
- Every article reads saved password candidates, including public articles.

## Changes

- Theme reads fall back to existing default/system behavior; writes become optional.
- Analytics resolves storage objects inside its existing exception handlers.
  Events requiring session deduplication are skipped when storage is unavailable.
- Article password candidates still include explicit URL input when storage is
  blocked. Remembering a verified password is optional. The existing password
  comparison and locked state remain in place.

No global Storage replacement, memory persistence, or changes to analytics consent.

## Verification

- New tests reproduced the failures before source changes.
- Five suites / 20 tests pass: unavailable getter/methods, theme preference,
  analytics route deduplication, password candidates and article unlock behavior,
  and existing first-touch attribution tests.
- A component test waits for rejection of a wrong password and acceptance of a
  correct password while the localStorage getter throws.
- Changed files pass ESLint with zero errors and one existing `_document` warning.
  The full repository has 34 lint errors and 283 warnings; all error paths are
  unchanged by this branch. `git diff --check` passes.
- In an isolated Chromium browser, exact source-equivalent patches to production
  responses pass 5 desktop cases with blocked Storage methods and 4 mobile cases
  with blocked localStorage/sessionStorage getters. Runtime and console errors
  are zero, article bodies remain readable, and no horizontal overflow occurs.
  Desktop theme controls switch in both directions; the mobile control is hidden
  and was not exercised. These browser tests use simulated candidate responses,
  not a built preview deployment or a production release.
- All business/auth/email/collector requests and third-party resources except the
  reviewed growth SDK are intercepted. Service workers are disabled for QA.
  No live account, email, payment, or conversion was submitted.

Full production build and real authenticated/password-protected production flows
have not been verified. Local existing dependencies were reused.

## Deployment blocker

Do not deploy an incomplete static export from this branch. Production has 12
Pages Functions routing entries, including authentication, newsletter subscription,
confirmation/unsubscription, synchronization, and middleware. This source commit
contains no Functions files. Pages routing metadata does not provide their original
deployed source. The available GitHub artifacts are GA4/GSC reports, not a Pages
deployment bundle. The local September 20 worker bundle predates production.

A complete production-equivalent Functions bundle, bindings, special routing files
and content are required before preview and production deployment. Production Pages
is preserved; this document and branch do not claim the storage fix is live.

Evidence and reproducible browser script are in the local growth agent repository:
`/Users/Yuki/Projects/ai-website-growth-agent`, with
`scripts/diagnose-charliiai-storage-20261020.mjs`,
`data/charliiai-storage-isolated-final-2026-10-20.log`,
`data/charliiai-storage-qa-*-2026-10-20.json`, and
`data/charliiai-storage-deployment-preservation-2026-10-20.json`.
