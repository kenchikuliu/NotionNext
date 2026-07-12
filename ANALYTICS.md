# Analytics

CharliiAI sends interaction and conversion events to GA4 when the Google Analytics snippet is enabled, and also mirrors the same custom events to Plausible/OpenPanel when those globals exist.

## Attribution Binding

The browser stores first-touch attribution in `localStorage` and attaches it to all interaction events:

- `landing_page`, `landing_path`, `landing_url`
- `referrer`, `referrer_host`
- `traffic_source`, `traffic_medium`, `traffic_campaign`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `gclid`, `fbclid`, `msclkid`

Signed-in users are also bound to GA4 through `user_id` and mirrored as `app_user_id` event properties.

`/api/analytics/sync` persists visitor/user first-touch state when the site is deployed as a server-capable Next.js app. It writes to `REDIS_URL` when configured and falls back to an in-memory acknowledgement when Redis is unavailable, so analytics sync failures do not break the client. Static exports automatically skip this endpoint through `window.__NEXT_DATA__?.nextExport`, and it can also be disabled with `NEXT_PUBLIC_ANALYTICS_SYNC_ENDPOINT=disabled`.

The sync endpoint also stores a capped event timeline for each visitor. Browser events are mirrored to the endpoint with `event_name`, `occurred_at`, `source`, and sanitized properties; the most recent 100 events are retained per visitor record. `/api/subscribe` also writes a server-side `lead_submitted` event after the lead pipeline succeeds, binding the lead to `visitor_id`, first-touch attribution, source page, and delivery/storage status.

If production responses show `"storage":"memory"`, the endpoint is acknowledging events but not persistently storing them across serverless instances. Configure one durable store in Vercel: `REDIS_URL`, Upstash/Vercel KV REST variables (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` + `KV_REST_API_TOKEN`), or `BLOB_READ_WRITE_TOKEN`. The current fallback order is Redis -> Redis REST -> Vercel Blob -> memory. Blob object names use a SHA-256 hash of the visitor cache key; the original key is retained inside JSON records as `cache_key`. Blob writes are append-only per visitor under `analytics/visitors/<hash>/records/` so fast consecutive browser and form events do not overwrite each other while Blob reads catch up.

## Current Events

| Event Name           | When it fires                                                     | Key properties                                                                                       |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `home_viewed`        | Homepage is viewed                                                | `result_path`, attribution properties                                                                |
| `page_intent_viewed` | Static intent page is viewed                                      | `result_path`, attribution properties                                                                |
| `cta_clicked`        | Generic high-intent link/button click                             | `intent`, `label`, `href`, `surface`, `page_path`                                                    |
| `signup_started`     | User clicks signup/register/start CTA                             | `intent`, `label`, `href`, `surface`, `page_path`                                                    |
| `login_started`      | User clicks login/sign-in CTA                                     | `intent`, `label`, `href`, `surface`, `page_path`                                                    |
| `trial_clicked`      | User clicks free-trial CTA                                        | `intent`, `label`, `href`, `surface`, `page_path`                                                    |
| `demo_requested`     | User clicks contact/demo CTA                                      | `intent`, `label`, `href`, `surface`, `page_path`                                                    |
| `plan_selected`      | User chooses a paid recharge/product CTA                          | `intent`, `product`, `label`, `href`, `surface`, `cta_position`, `page_path`                         |
| `pricing_viewed`     | User clicks pricing/upgrade CTA                                   | `intent`, `label`, `href`, `surface`, `page_path`                                                    |
| `checkout_started`   | Legacy Stripe Payment Link or buy/pay/subscribe CTA is clicked    | `intent`, `product`, `service`, `checkout_type`, `provider`, `label`, `href`, `surface`, `page_path` |
| `checkout_cancelled` | URL return indicates Stripe checkout was cancelled or interrupted | `source`, `provider`, `plan`, `order_no`, `session_id`, `page_path`                                  |
| `form_submitted`     | Any form submit starts                                            | `form_name`, `page_path`                                                                             |
| `lead_submitted`     | Newsletter/lead/recharge inquiry form succeeds                    | `form_name`, `source`, `product`, `service`, `contact_method`, `has_message`, `page_path`            |
| `signup_completed`   | URL success return indicates registration succeeded               | `source`, `method`, `page_path`                                                                      |
| `login_success`      | URL success return indicates login succeeded                      | `source`, `method`, `page_path`                                                                      |
| `payment_succeeded`  | URL success return indicates checkout/payment succeeded           | `source`, `provider`, `plan`, `order_no`, `session_id`, `page_path`                                  |

## GA4 Key Events

The source of truth is:

- [analytics/ga4-key-events.json](/Users/Yuki/NotionNext/analytics/ga4-key-events.json)

Create or verify the GA4 key events after DebugView confirms the events are firing:

```bash
npm run ga4:key-events -- --dry-run
GA4_PROPERTY_ID="123456789" GOOGLE_API_ACCESS_TOKEN="ya29..." npm run ga4:key-events
```

Keep click-intent events such as `cta_clicked`, `plan_selected`, `pricing_viewed`, and `checkout_started` as funnel context unless the site does not yet have enough true success volume.

## Manual Recharge Inquiries

CharliiAI currently uses manual inquiry capture on `/chongzhi` and `/gptchongzhi`. Do not configure Stripe products, Payment Links, or public payment environment variables for this project unless the owner explicitly asks to enable payment later.

The recharge pages submit to `/api/subscribe` through `RechargeInquiryForm`. The lead payload includes `product`, `service`, `contact_method`, and a free-form `message`; the server mirrors the lead into Notion/email notifications when those integrations are configured, and records a server-side `lead_submitted` event after a successful capture.

The direct email fallback remains visible, but it is tracked as `demo_requested` with `provider=email`, not as a payment attempt.

GSC remains page/query-level only. Use GSC for search opportunity, GA4 events for session behavior, and the analytics sync endpoint or lead database for visitor-to-inquiry attribution.

For lead attribution, use this chain:

1. GSC query/page aggregate identifies the landing opportunity.
2. GA4 shows the landing session and interaction events.
3. `/api/analytics/sync` stores the visitor first-touch and event timeline.
4. `/api/subscribe` stores the server-side `lead_submitted` event and mirrors first-touch metadata into the lead record.

## Server-Side Funnel Report

Use the Blob report when you need the visitor-level event timeline that GA4 and GSC cannot provide:

```bash
vercel env pull /tmp/charlii.env
set -a; . /tmp/charlii.env; set +a
npm run analytics:blob-report
rm -f /tmp/charlii.env
```

The report writes:

- `tmp/analytics-blob-report/latest-summary.json`
- `tmp/analytics-blob-report/latest-report.md`
- `tmp/analytics-blob-report/<timestamp>/visitors.csv`
- `tmp/analytics-blob-report/<timestamp>/events.csv`

By default the report excludes `codex-*` and `*smoke*` test traffic. Use `npm run analytics:blob-report -- --include-smoke` only when verifying test events.
