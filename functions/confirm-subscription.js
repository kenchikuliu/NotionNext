import { sendGrowthFormSubmit } from './_shared/growth-attribution.js'
import { sendGrowthEmail } from './_shared/growth-email.js'

const TOKEN_PATTERN = /^[a-f0-9]{64}$/

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function page(
  title,
  message,
  { token = '', unsubscribeUrl = '', status = 200, locale = 'en-US' } = {}
) {
  const isZh = locale === 'zh-CN'
  const form = token
    ? `<form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">${isZh ? '确认订阅' : 'Confirm subscription'}</button></form>`
    : ''
  const unsubscribe = unsubscribeUrl
    ? `<p><a href="${escapeHtml(unsubscribeUrl)}">${isZh ? '退订' : 'Unsubscribe'}</a></p>`
    : ''
  return new Response(
    `<!doctype html><html lang="${isZh ? 'zh-CN' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f3f4f6;color:#111827;font:16px/1.6 system-ui}main{max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}button{border:0;border-radius:7px;padding:12px 18px;background:#0f766e;color:#fff;font-weight:700}a{color:#0f766e}</style><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${form}${unsubscribe}</main></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff'
      }
    }
  )
}

async function tokenFromRequest(request) {
  if (request.method === 'GET') {
    return new URL(request.url).searchParams.get('token') || ''
  }
  const form = await request.formData().catch(() => new FormData())
  return String(form.get('token') || '')
}

async function findPendingSubscriber(env, token) {
  if (!env?.AUTH_KV || !TOKEN_PATTERN.test(token)) return null
  const key = await env.AUTH_KV.get(`newsletter:verify:${token}`)
  if (!key) return null
  const subscriber = await env.AUTH_KV.get(key, 'json')
  if (
    !subscriber ||
    subscriber.verificationToken !== token ||
    subscriber.status !== 'pending_confirmation' ||
    subscriber.expiresAt <= Date.now()
  )
    return null
  return { key, subscriber }
}

export async function onRequestGet({ request, env }) {
  const token = await tokenFromRequest(request)
  const match = await findPendingSubscriber(env, token)
  if (!match)
    return page(
      'Link expired',
      'Request a new verification email from the website.',
      { status: 400 }
    )
  return page(
    match.subscriber.locale === 'zh-CN'
      ? '确认订阅 Charlii AI 更新'
      : 'Confirm Charlii AI updates',
    match.subscriber.locale === 'zh-CN'
      ? '请确认你希望通过邮件接收 Charlii AI 更新。'
      : 'Confirm that you want to receive Charlii AI updates at your email address.',
    { token, locale: match.subscriber.locale }
  )
}

export async function onRequestPost({ request, env, context }) {
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  ) {
    return page(
      'Invalid request',
      'Please open the verification link in your browser.',
      { status: 403 }
    )
  }
  const token = await tokenFromRequest(request)
  const match = await findPendingSubscriber(env, token)
  if (!match)
    return page(
      'Link expired',
      'Request a new verification email from the website.',
      { status: 400 }
    )

  const subscriber = {
    ...match.subscriber,
    status: 'subscribed',
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verificationToken: null,
    expiresAt: null,
    analyticsContext: null
  }
  try {
    await env.AUTH_KV.put(match.key, JSON.stringify(subscriber))
    await env.AUTH_KV.delete(`newsletter:verify:${token}`)
  } catch {
    return page(
      'Unavailable',
      'We could not save your subscription. Please try again later.',
      { status: 503 }
    )
  }

  const notify = async () => {
    try {
      await sendGrowthEmail(env, {
        eventId: `newsletter:${subscriber.subscriptionId}:owner`,
        templateId: 'contact_notification',
        to: String(env.LEAD_OWNER_EMAIL || 'kenchikuliu@outlook.com').trim(),
        input: {
          reference: `CHARLII-SUB-${subscriber.subscriptionId}`,
          requester_email: subscriber.email,
          product: 'Verified newsletter subscription',
          message: `Source: ${subscriber.source}\nPage: ${subscriber.pageUrl}\nConsent at: ${subscriber.consentAt}`
        }
      })
    } catch {
      console.error('verified subscriber owner notification failed')
    }
    const blocksAnalytics =
      request.headers.get('sec-gpc') === '1' ||
      request.headers.get('dnt') === '1'
    await sendGrowthFormSubmit(
      env,
      blocksAnalytics ? null : match.subscriber.analyticsContext,
      {
        eventKey: `newsletter:${subscriber.subscriptionId}`,
        url: subscriber.pageUrl,
        element: 'newsletter_subscription'
      }
    )
  }
  if (context?.waitUntil) context.waitUntil(notify())
  else await notify()
  const isZh = subscriber.locale === 'zh-CN'
  return page(
    isZh ? '订阅已确认' : 'Subscription confirmed',
    isZh
      ? '你已订阅 Charlii AI 更新，可以随时退订。'
      : 'You are subscribed to Charlii AI updates. You can unsubscribe at any time.',
    { unsubscribeUrl: subscriber.unsubscribeUrl, locale: subscriber.locale }
  )
}
