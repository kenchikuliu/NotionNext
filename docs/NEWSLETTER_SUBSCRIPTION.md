# Charlii AI newsletter subscription

Status: deployed to Cloudflare Pages production on 2026-09-23. Active deployment: `69739e68-42cd-425c-a025-50d438ec344e` (`charliiai-main`, branch `main`). The site was deployed from the current uncommitted worktree; it has not been committed or pushed to Git.

- Contact / transactional sender: `hello@charliiai.com` via the Website Growth Collector's Cloudflare Email Service. Owner notifications go to `kenchikuliu@outlook.com` after a verified opt-in.
- Inbound `hello@charliiai.com` routing is separate from the outbound sender; this change does not alter routing.
- `AUTH_KV` stores a pending request after explicit marketing consent. A one-day verification link requires a user-confirmed POST before the address becomes `subscribed`. GET never activates. Duplicate pending or active submissions do not create another subscription. Unsubscribe changes the KV status and invalidates any pending verification token. A new opt-in after unsubscribe starts a new subscription cycle.
- The browser's analytics consent is independent of marketing consent. Only a verified opt-in with consented anonymous `_wga_visitor` and `_wga_session` sends the server `form_submit` event; QA requests using `_wga_traffic=validation` must not count as production conversions. The Growth event never includes email or a verification token.
- The separate marketing provider has a verified `charliiai.com` domain, but newsletter campaigns are NOT enabled. Before sending any campaign, synchronize only verified `subscribed` addresses with the marketing audience and propagate `unsubscribed` and complaint/bounce suppression statuses both ways. Never use the transactional Cloudflare Email Service to bulk-send newsletters.
- A protected production endpoint at `/api/admin/newsletter-sync` can synchronize the `AUTH_KV` ledger with the Resend `Learn.CharliiAI` segment. It defaults to dry-run; `commit: true` is required for writes. It never sends a Broadcast, never imports pending addresses, and never clears an existing Resend global suppression.

Production QA on 2026-09-23:

- `https://www.charliiai.com/` served the new build; `/sign-in`, `/en-US`, and `/sitemap.xml` returned 200. Invalid confirmation and unsubscribe links returned 400.
- The Pages production secret `GROWTH_SERVER_TOKEN` was set from the existing site-specific Collector key. Pages required a second deployment after the secret was configured before the Functions could use it.
- A controlled, consenting subscription request to `kenchikuliu@outlook.com` returned 200. The branded verification email appeared in the owner's Outlook inbox, and the KV record was `pending_confirmation` before confirmation. GET displayed the confirmation form; POST changed the record to `subscribed`. GET and POST on the unsubscribe link changed it to `unsubscribed`. The QA address remains unsubscribed.
- The controlled request did not include analytics consent. No conversion or production Lead is claimed. The owner notification path had one historical failure caused by a dynamic reply-to address; that parameter was removed, the same event was retried successfully, and the fix is deployed. The Growth Agent's trusted server-attribution release remains unchanged until a real consented event is observed.
- Resend was checked on 2026-09-23: `charliiai.com` is verified, the `Learn.CharliiAI` segment exists, and the audience contained no contacts. The production sync dry-run and commit run both found zero eligible subscribers; the controlled QA address was preserved as suppressed and was not imported.

Release follow-ups:

1. The owner notification is attempted asynchronously on confirmation, but neither provider acceptance nor mailbox delivery has been independently verified. Check both before calling that notification delivered.
2. Verify a real consented `form_submit` at the Growth Collector before adding `charliiai.com` to `server-attribution-releases.json`. The controlled QA above intentionally had no analytics consent.
3. Before sending newsletters, run the protected sync endpoint and verify its result, then honor unsubscribes, complaints, and bounces on both sides. Do not use Cloudflare Email Service for campaigns. No Broadcast has been created or sent.
