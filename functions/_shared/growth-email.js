const SITE_ID = 'site_57f5e56d0330647f355a26e5'
const DEFAULT_COLLECTOR_URL =
  'https://website-growth-events.kenchikuliu.workers.dev'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEventId(value) {
  const normalized = String(value || '')
    .replace(/[^A-Za-z0-9_.:-]/g, '_')
    .slice(0, 160)
  return normalized.length >= 8
    ? normalized
    : `email:${normalized}:${crypto.randomUUID()}`.slice(0, 160)
}

function isRetryable(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export function hasGrowthEmailTransport(env) {
  return Boolean(String(env?.GROWTH_SERVER_TOKEN || '').trim())
}

export async function sendGrowthEmail(env, message) {
  const token = String(env?.GROWTH_SERVER_TOKEN || '').trim()
  const recipient = String(message.to || '')
    .trim()
    .toLowerCase()
  if (!token) throw new Error('GROWTH_SERVER_TOKEN is not configured')
  if (!EMAIL_PATTERN.test(recipient)) throw new Error('Invalid email recipient')

  const collectorUrl = String(
    env?.GROWTH_EMAIL_SERVICE_URL || DEFAULT_COLLECTOR_URL
  ).replace(/\/$/, '')
  const eventId = normalizeEventId(message.eventId)
  let lastError = 'Cloudflare transactional email request failed'

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${collectorUrl}/server/email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site_id: SITE_ID,
          event_id: eventId,
          template_id: message.templateId,
          to: recipient,
          input: message.input || {},
          ...(message.replyTo
            ? { reply_to: String(message.replyTo).trim().toLowerCase() }
            : {})
        }),
        signal: AbortSignal.timeout(8000)
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result.accepted === true && result.status === 'sent') {
        return result
      }
      if (response.ok) {
        throw new Error('Transactional email has not been sent')
      }
      lastError = result.error || `Transactional email HTTP ${response.status}`
      if (!isRetryable(response.status)) break
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
    }
    if (attempt < 3) {
      await new Promise(resolve =>
        setTimeout(resolve, 150 * 2 ** (attempt - 1))
      )
    }
  }

  throw new Error(lastError)
}
