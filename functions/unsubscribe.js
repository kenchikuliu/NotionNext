function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function page(title, message, token = '', locale = 'en-US') {
  const isZh = locale === 'zh-CN'
  const action = token
    ? `<form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">${isZh ? '确认退订' : 'Confirm unsubscribe'}</button></form>`
    : ''
  return new Response(
    `<!doctype html><html lang="${isZh ? 'zh-CN' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f3f4f6;color:#111827;font:16px/1.6 system-ui}main{max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}button{border:0;border-radius:7px;padding:12px 18px;background:#0f766e;color:#fff;font-weight:700}</style><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${action}</main></html>`,
    {
      status: token || ['Unsubscribed', '已退订'].includes(title) ? 200 : 400,
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
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}))
    return String(body.token || '')
  }
  const form = await request.formData().catch(() => new FormData())
  return String(form.get('token') || '')
}

async function subscriberForToken(env, token) {
  if (!env?.AUTH_KV || !/^[a-f0-9]{64}$/.test(token)) return null
  const key = await env.AUTH_KV.get(`newsletter:unsubscribe:${token}`)
  if (!key) return null
  const subscriber = await env.AUTH_KV.get(key, 'json')
  if (!subscriber || subscriber.unsubscribeToken !== token) return null
  return { key, subscriber }
}

export async function onRequestGet({ request, env }) {
  const token = await tokenFromRequest(request)
  const match = await subscriberForToken(env, token)
  if (!match)
    return page('Invalid link', 'This unsubscribe link is invalid or expired.')
  if (match.subscriber.status === 'unsubscribed') {
    return page(
      match.subscriber.locale === 'zh-CN' ? '已退订' : 'Unsubscribed',
      match.subscriber.locale === 'zh-CN'
        ? '这个邮箱已经退订。'
        : 'This address is already unsubscribed.',
      '',
      match.subscriber.locale
    )
  }
  return page(
    match.subscriber.locale === 'zh-CN'
      ? '退订 Charlii AI 更新'
      : 'Unsubscribe from Charlii AI',
    match.subscriber.locale === 'zh-CN'
      ? '请确认你不再希望接收 Charlii AI 更新。'
      : 'Confirm that you no longer want to receive Charlii AI updates.',
    token,
    match.subscriber.locale
  )
}

export async function onRequestPost({ request, env }) {
  const token = await tokenFromRequest(request)
  const match = await subscriberForToken(env, token)
  if (!match)
    return page('Invalid link', 'This unsubscribe link is invalid or expired.')
  await env.AUTH_KV.put(
    match.key,
    JSON.stringify({
      ...match.subscriber,
      status: 'unsubscribed',
      verificationToken: null,
      analyticsContext: null,
      unsubscribedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  )
  if (match.subscriber.verificationToken) {
    await env.AUTH_KV.delete(
      `newsletter:verify:${match.subscriber.verificationToken}`
    )
  }
  const isZh = match.subscriber.locale === 'zh-CN'
  return page(
    isZh ? '已退订' : 'Unsubscribed',
    isZh
      ? '你将不再收到 Charlii AI 更新。'
      : 'You will no longer receive Charlii AI updates.',
    '',
    match.subscriber.locale
  )
}
