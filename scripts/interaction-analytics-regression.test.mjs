import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(
  new URL('../components/InteractionAnalytics.js', import.meta.url),
  'utf8'
)
const keyEvents = JSON.parse(
  fs.readFileSync(
    new URL('../analytics/ga4-key-events.json', import.meta.url),
    'utf8'
  )
)
const mailchimpSource = fs.readFileSync(
  new URL('../lib/plugins/mailchimp.js', import.meta.url),
  'utf8'
)
const subscribeSource = fs.readFileSync(
  new URL('../pages/api/subscribe.js', import.meta.url),
  'utf8'
)
const visitorStoreSource = fs.readFileSync(
  new URL('../lib/analytics/visitor-store.js', import.meta.url),
  'utf8'
)
const blobReportSource = fs.readFileSync(
  new URL('../scripts/analytics-blob-report.mjs', import.meta.url),
  'utf8'
)
const paidCtaSource = fs.readFileSync(
  new URL('../themes/heo/components/PaidIntentCta.js', import.meta.url),
  'utf8'
)
const rechargeContactSource = fs.readFileSync(
  new URL('../components/RechargeContactCard.js', import.meta.url),
  'utf8'
)
const rechargeInquirySource = fs.readFileSync(
  new URL('../components/RechargeInquiryForm.js', import.meta.url),
  'utf8'
)
const checkoutStatusSource = fs.readFileSync(
  new URL('../components/CheckoutStatusNotice.js', import.meta.url),
  'utf8'
)
const claudeRechargePageSource = fs.readFileSync(
  new URL('../pages/chongzhi.js', import.meta.url),
  'utf8'
)
const gptRechargePageSource = fs.readFileSync(
  new URL('../pages/gptchongzhi.js', import.meta.url),
  'utf8'
)

test('content analytics emits page-type and reading-depth events', () => {
  for (const eventName of [
    'home_viewed',
    'page_intent_viewed',
    'article_viewed',
    'search_viewed',
    'tag_viewed',
    'category_viewed',
    'post_list_viewed'
  ]) {
    assert.match(source, new RegExp(eventName))
    assert.ok(
      keyEvents.supportingEvents.includes(eventName),
      `${eventName} should be listed as a GA4 supporting event`
    )
  }

  assert.match(source, /new Set\(\[50, 90\]\)/)
  assert.match(source, /`article_read_\$\{threshold\}`/)
  assert.ok(keyEvents.supportingEvents.includes('article_read_50'))
  assert.ok(keyEvents.supportingEvents.includes('article_read_90'))
  assert.match(source, /useRouter/)
  assert.match(source, /\[router\.asPath\]/)
})

test('content analytics tracks outbound and internal article clicks', () => {
  assert.match(source, /outbound_link_clicked/)
  assert.match(source, /article_link_clicked/)
  assert.match(source, /url\.hostname !== window\.location\.hostname/)
})

test('content analytics keeps first-touch attribution and skips sync for static export', () => {
  assert.match(source, /FIRST_TOUCH_STORAGE_KEY/)
  assert.match(source, /landing_page/)
  assert.match(source, /utm_source/)
  assert.match(source, /gclid/)
  assert.match(source, /app_user_id/)
  assert.match(source, /NEXT_PUBLIC_ANALYTICS_SYNC_ENDPOINT/)
  assert.match(source, /window\.__NEXT_DATA__\?\.nextExport/)
  assert.match(source, /\/api\/analytics\/sync/)
})

test('interaction events and lead submissions are mirrored server-side', () => {
  assert.match(source, /syncAnalyticsState\(\{/)
  assert.match(source, /event_name: eventName/)
  assert.match(source, /properties: payload/)
  assert.match(mailchimpSource, /visitor_id: getOrCreateVisitorId\(\)/)
  assert.match(mailchimpSource, /first_touch: getFirstTouch\(\)/)
  assert.match(subscribeSource, /event_name: 'lead_submitted'/)
  assert.match(subscribeSource, /analytics_synced/)
  assert.match(subscribeSource, /product: lead\.product/)
  assert.match(subscribeSource, /contact_method: lead\.contactMethod/)
  assert.match(subscribeSource, /has_message: Boolean\(lead\.message\)/)
  assert.match(rechargeInquirySource, /subscribeToNewsletter/)
  assert.match(rechargeInquirySource, /trackInteractionEvent\('lead_submitted'/)
  assert.match(rechargeInquirySource, /product/)
  assert.match(rechargeInquirySource, /contact_method/)
  assert.match(visitorStoreSource, /MAX_STORED_EVENTS = 100/)
  assert.match(visitorStoreSource, /UPSTASH_REDIS_REST_URL/)
  assert.match(visitorStoreSource, /KV_REST_API_URL/)
  assert.match(visitorStoreSource, /BLOB_READ_WRITE_TOKEN/)
  assert.match(visitorStoreSource, /createHash\('sha256'\)/)
  assert.match(visitorStoreSource, /BLOB_LIST_LIMIT/)
  assert.match(visitorStoreSource, /getBlobRecordPath/)
  assert.match(visitorStoreSource, /record_type: 'event'/)
  assert.match(visitorStoreSource, /record_type: 'first_touch'/)
  assert.match(
    visitorStoreSource,
    /cache_key: existing\.cache_key \|\| cacheKey/
  )
  assert.match(visitorStoreSource, /return 'blob'/)
  assert.match(visitorStoreSource, /eventStored/)
  assert.match(blobReportSource, /BLOB_READ_WRITE_TOKEN/)
  assert.match(blobReportSource, /analytics\/visitors\//)
  assert.match(blobReportSource, /include-smoke/)
  assert.match(blobReportSource, /isTestVisitor/)
  assert.match(blobReportSource, /visitors\.csv/)
  assert.match(blobReportSource, /events\.csv/)
})

test('paid intent surfaces are explicitly tracked through the funnel', () => {
  assert.match(source, /PAID_INTENT_PAGES/)
  assert.match(source, /chongzhi/)
  assert.match(source, /gptchongzhi/)
  assert.match(source, /getManualAnalyticsEvent/)
  assert.match(source, /data-analytics-event/)
  assert.match(source, /charliiai:pricing/)
  assert.ok(keyEvents.supportingEvents.includes('plan_selected'))
  assert.match(blobReportSource, /'plan_selected'/)
  assert.match(source, /pricing_viewed/)
  assert.match(source, /checkout_started/)
  assert.match(source, /checkout_cancelled/)
  assert.ok(keyEvents.supportingEvents.includes('checkout_cancelled'))
  assert.match(blobReportSource, /'checkout_cancelled'/)
  assert.match(paidCtaSource, /data-analytics-event': 'plan_selected'/)
  assert.match(paidCtaSource, /claudecode_recharge/)
  assert.match(paidCtaSource, /gpt_recharge/)
  assert.doesNotMatch(rechargeContactSource, /buy\.stripe\.com/)
  assert.doesNotMatch(rechargeContactSource, /stripe_payment_link/)
  assert.doesNotMatch(rechargeContactSource, /getStripePaymentLink/)
  assert.doesNotMatch(rechargeContactSource, /checkout_started/)
  assert.doesNotMatch(rechargeContactSource, /checkoutType/)
  assert.doesNotMatch(rechargeContactSource, /data-analytics-checkout-type/)
  assert.match(rechargeContactSource, /eventName = 'demo_requested'/)
  assert.match(claudeRechargePageSource, /RechargeInquiryForm/)
  assert.match(claudeRechargePageSource, /claudecode_recharge_inquiry/)
  assert.doesNotMatch(
    claudeRechargePageSource,
    /NEXT_PUBLIC_[A-Z0-9_]*PAYMENT_LINK/
  )
  assert.doesNotMatch(claudeRechargePageSource, /paymentLink/)
  assert.doesNotMatch(claudeRechargePageSource, /buy\.stripe\.com/)
  assert.match(gptRechargePageSource, /RechargeInquiryForm/)
  assert.match(gptRechargePageSource, /gpt_recharge_inquiry/)
  assert.doesNotMatch(
    gptRechargePageSource,
    /NEXT_PUBLIC_[A-Z0-9_]*PAYMENT_LINK/
  )
  assert.doesNotMatch(gptRechargePageSource, /paymentLink/)
  assert.doesNotMatch(gptRechargePageSource, /buy\.stripe\.com/)
  assert.match(checkoutStatusSource, /checkout-success/)
  assert.match(checkoutStatusSource, /checkout-cancelled/)
  assert.match(checkoutStatusSource, /success_delivery_email/)
  assert.match(checkoutStatusSource, /cancelled_email/)
  assert.match(blobReportSource, /product: properties\.product/)
  assert.match(blobReportSource, /checkout_type: properties\.checkout_type/)
})
