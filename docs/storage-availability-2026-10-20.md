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

## Production release — verified 2026-10-20

The missing release provenance was recovered from the original October 15 session:
production was an rsync snapshot of `/Users/Yuki/NotionNext`, with the subscription
handler and email helper restored from Git commit
`57ce692c939e6c6623a65b07659747592c7b819d`. The subscription handler SHA256 exactly
matches the recorded release hash. The remaining Functions source files predate
that deployment. Reconstructed Functions compile, all 12 routing entries match,
and 23 authentication/newsletter/synchronization tests pass with mocked providers.
This does not prove byte identity with the unavailable original deployed code.

A release was prepared from the complete original production asset manifest:

- 2,582 original paths retained; 466 public application HTML files receive guarded
  early theme reads and references to the new script URLs.
- Six scripts receive new content-specific URLs: theme/app, interaction analytics,
  two article chunks, webpack runtime and client build manifest. Original immutable
  script paths remain available for already-open pages.
- All 2,581 retrievable original files were downloaded and checked against their
  production Cloudflare asset hash. The protected dashboard HTML keeps its original
  hash without downloading it or bypassing authentication.
- Original headers, redirects, Functions, AUTH_KV binding, compatibility date/flags
  and production secret configuration are preserved. Sitemap and content are unchanged.
- The release contains 2,588 manifest entries and is an exact asset patch, not a full
  Next build from this source branch. Do not deploy this branch as a static-only export.

Final preview deployment: `08c9de9b-bb47-4861-9849-0ce120ddd86e`.
Production deployment: **`16d522f0-60a3-4100-8829-710730051d51`**.
Public origin: https://www.charliiai.com
Activation: `2026-10-20T15:46:31.843Z`.

Preview and direct production acceptance both pass 13 browser scenarios and 32 HTTP
checks. Production uses the real public origin and actual deployed responses without
candidate substitution. All six new script hashes were observed, and no old affected
scripts loaded. Cases cover blocked Storage methods on desktop (5), blocked getters
on mobile (4), normal storage and same-document navigation (4). Runtime/console
errors and horizontal overflow are zero. Desktop themes switch both ways; mobile
controls are hidden. HTTP checks cover public content, sitemap, redirects, anonymous
session/dashboard protection, and reviewed invalid/unauthorized API branches.

Business, auth, email, collector and third-party requests are intercepted in browser
QA. HTTP POST probes use invalid/unauthorized inputs returning before persistence or
mail delivery. No real account, email delivery, payment or protected article login was
triggered. These results do not establish growth or revenue gains.

Earlier failing previews (missing metadata/KV binding, encoded article references,
preview-host SDK behavior and intermittent resource failures) are recorded and were
not promoted. The final preview and production suites were fully rerun successfully.
The original deployment remains available for rollback.

The source PR stays draft: Docker build and language analysis pass, while a separate
CodeQL check and Vercel check fail. No merge or all-green CI claim is made.

Evidence and reproducible release scripts are in the local growth agent repository:
`/Users/Yuki/Projects/ai-website-growth-agent`:

- `data/charliiai-storage-release-2026-10-20.json`
- `data/charliiai-storage-release-provenance-2026-10-20.json`
- `data/charliiai-storage-functions-tests-2026-10-20.log`
- `data/charliiai-storage-production-*-2026-10-20.json`
- `scripts/prepare-charliiai-storage-release-20261020.mjs`
- `scripts/release-charliiai-storage-20261020.mjs`
- `scripts/verify-charliiai-storage-release-20261020.mjs`

Complete original/candidate artifacts and the preview gate are kept under the
ignored `data/charliiai-storage-release-artifacts-20261020/` directory.
