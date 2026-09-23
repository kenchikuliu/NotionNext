const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SESSION_COOKIE = '__Host-charlii_session'
const CODE_TTL_SECONDS = 10 * 60
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
const MAX_BODY_BYTES = 4096

const encoder = new TextEncoder()

function normalizeEnv(value, fallback = '') {
  const normalized =
    typeof value === 'string' ? value.replace(/\\n/g, '').trim() : ''
  return normalized || fallback
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  })
}

export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : ''
}

export function isSameOrigin(request) {
  const origin = request.headers.get('origin')
  return Boolean(origin && origin === new URL(request.url).origin)
}

export async function readJson(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_BODY_BYTES) throw new Error('request_too_large')
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) throw new Error('request_too_large')
  return JSON.parse(raw || '{}')
}

function toHex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
}

export function randomId(byteLength = 32) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export function randomCode() {
  const values = new Uint32Array(1)
  do {
    crypto.getRandomValues(values)
  } while (values[0] >= 4294000000)
  return String(values[0] % 1000000).padStart(6, '0')
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return toHex(new Uint8Array(digest))
}

export async function hashCode(pepper, challengeId, salt, code) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${challengeId}:${salt}:${code}`)
  )
  return toHex(new Uint8Array(signature))
}

export function constantTimeEqual(left, right) {
  const a = String(left || '')
  const b = String(right || '')
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

export function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.get('cookie') || '')
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const separator = part.indexOf('=')
        return separator === -1
          ? [part, '']
          : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))]
      })
  )
}

export function sessionCookie(sessionId) {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
}

export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function sessionIdFromRequest(request) {
  const value = parseCookies(request)[SESSION_COOKIE] || ''
  return /^[a-f0-9]{64}$/.test(value) ? value : ''
}

export function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  ).slice(0, 80)
}

export async function consumeRateLimit(kv, scope, subject, limit, windowSeconds) {
  const subjectHash = await sha256(subject)
  const key = `rate:${scope}:${subjectHash}`
  const now = Date.now()
  const existing = await kv.get(key, 'json')
  const resetAt = Number(existing?.resetAt || 0)
  const count = resetAt > now ? Number(existing?.count || 0) : 0
  if (count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) }
  }
  const nextReset = resetAt > now ? resetAt : now + windowSeconds * 1000
  await kv.put(
    key,
    JSON.stringify({ count: count + 1, resetAt: nextReset }),
    { expirationTtl: Math.max(60, Math.ceil((nextReset - now) / 1000)) }
  )
  return { allowed: true, retryAfter: 0 }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendLoginCode(env, email, code) {
  const accountId = normalizeEnv(env.CLOUDFLARE_EMAIL_ACCOUNT_ID)
  const apiToken = normalizeEnv(env.CLOUDFLARE_EMAIL_API_TOKEN)
  const fromEmail = normalizeEnv(env.CLOUDFLARE_EMAIL_FROM_EMAIL)
  const fromName = normalizeEnv(env.CLOUDFLARE_EMAIL_FROM_NAME, 'CharliiAI')
  const replyTo = normalizeEnv(env.CLOUDFLARE_EMAIL_REPLY_TO, fromEmail)

  const safeCode = escapeHtml(code)
  const text = [
    'CharliiAI 登录验证码',
    '',
    `验证码：${code}`,
    '验证码将在 10 分钟后失效。',
    '',
    '如果不是你本人发起，可以忽略这封邮件。'
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fb;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:520px;margin:0 auto;padding:32px 16px"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:32px"><p style="margin:0 0 8px;color:#525252;font-size:14px">CharliiAI</p><h1 style="margin:0 0 20px;font-size:24px">登录验证码</h1><div style="padding:18px;text-align:center;background:#171717;color:#fff;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px">${safeCode}</div><p style="margin:20px 0 0;color:#525252;font-size:14px;line-height:1.6">验证码将在 10 分钟后失效。如果不是你本人发起，可以忽略这封邮件。</p></div></div></body></html>`
  const gatewayUrl = normalizeEnv(env.CHARLII_EMAIL_GATEWAY_URL)
  const gatewaySecret = normalizeEnv(env.CHARLII_EMAIL_GATEWAY_SECRET)
  if (gatewayUrl && gatewaySecret) {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewaySecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, code })
    })
    if (!response.ok) throw new Error(`email_gateway_failed_${response.status}`)
    return
  }

  if (env.EMAIL?.send) {
    if (!fromEmail) throw new Error('email_not_configured')
    await env.EMAIL.send({
      to: email,
      from: { email: fromEmail, name: fromName },
      replyTo,
      subject: 'CharliiAI 登录验证码',
      html,
      text
    })
    return
  }

  if (!accountId || !apiToken || !fromEmail) throw new Error('email_not_configured')

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: email,
        from: { address: fromEmail, name: fromName },
        reply_to: replyTo,
        subject: 'CharliiAI 登录验证码',
        html,
        text
      })
    }
  )
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.success === false) {
    const firstError = result?.errors?.[0]
    throw new Error(
      [
        'email_send_failed',
        response.status,
        firstError?.code || 'unknown_code',
        firstError?.message || 'unknown_error'
      ].join('_')
    )
  }
}

export const authConstants = {
  CODE_TTL_SECONDS,
  SESSION_TTL_SECONDS
}
