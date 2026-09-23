const SITE_ID = 'site_57f5e56d0330647f355a26e5'
const DEFAULT_COLLECTOR_URL =
  'https://website-growth-events.kenchikuliu.workers.dev'
const OPAQUE_ID = /^[A-Za-z0-9_-]{16,100}$/

function readCookies(request) {
  const cookies = new Map()
  for (const part of String(request.headers.get('cookie') || '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    const name = part.slice(0, separator).trim()
    try {
      cookies.set(name, decodeURIComponent(part.slice(separator + 1).trim()))
    } catch {
      // Ignore malformed cookies instead of blocking the form submission.
    }
  }
  return cookies
}

export function growthContext(request) {
  if (
    request.headers.get('sec-gpc') === '1' ||
    request.headers.get('dnt') === '1'
  )
    return null
  const cookies = readCookies(request)
  const anonymousId = cookies.get('_wga_visitor') || ''
  const sessionId = cookies.get('_wga_session') || ''
  if (
    cookies.get('_wga_consent') !== 'granted' ||
    !OPAQUE_ID.test(anonymousId) ||
    !OPAQUE_ID.test(sessionId)
  ) {
    return null
  }
  return {
    anonymousId,
    sessionId,
    trafficType:
      cookies.get('_wga_traffic') === 'validation' ? 'validation' : 'production'
  }
}

async function stableId(namespace, value) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${namespace}:${String(value || '')}`)
  )
  return Array.from(new Uint8Array(bytes), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

export async function sendGrowthFormSubmit(
  env,
  context,
  { eventKey, url, element }
) {
  if (!context) return { sent: false, reason: 'analytics_consent_required' }

  const token = String(env?.GROWTH_SERVER_TOKEN || '').trim()
  if (!token) return { sent: false, reason: 'not_configured' }

  let eventUrl
  try {
    eventUrl = new URL(url)
    eventUrl.search = ''
    eventUrl.hash = ''
    eventUrl.pathname = eventUrl.pathname
      .split('/')
      .map(part =>
        /@|\d{7,}|[a-f0-9]{24,}|[A-Za-z0-9_-]{40,}/i.test(
          decodeURIComponent(part)
        )
          ? ':redacted'
          : part
      )
      .join('/')
  } catch {
    return { sent: false, reason: 'invalid_url' }
  }

  const collectorUrl = String(
    env?.GROWTH_COLLECTOR_URL || DEFAULT_COLLECTOR_URL
  ).replace(/\/$/, '')
  const event = {
    event_id: await stableId('growth-event:form_submit', eventKey),
    anonymous_id: context.anonymousId,
    session_id: context.sessionId,
    name: 'form_submit',
    occurred_at: new Date().toISOString(),
    url: eventUrl.toString(),
    consent: 'granted',
    traffic_type: context.trafficType,
    properties: { element }
  }

  try {
    const response = await fetch(`${collectorUrl}/server/event`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ site_id: SITE_ID, event }),
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
      ? { sent: true, status: response.status }
      : { sent: false, reason: 'collector_rejected', status: response.status }
  } catch {
    return { sent: false, reason: 'collector_unavailable' }
  }
}
