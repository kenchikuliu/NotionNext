import { constantTimeEqual, json, normalizeEmail } from '../../_shared/auth.js'

const SUBSCRIBER_PREFIX = 'newsletter:subscriber:'
const RESEND_API_BASE = 'https://api.resend.com'
const MAX_SUBSCRIBERS_PER_RUN = 500

function envValue(env, name) {
  return typeof env?.[name] === 'string' ? env[name].trim() : ''
}

function authorized(request, env) {
  const expected = envValue(env, 'MARKETING_SYNC_SECRET')
  const supplied = String(request.headers.get('authorization') || '').replace(
    /^Bearer\s+/i,
    ''
  )
  return Boolean(expected && supplied && constantTimeEqual(expected, supplied))
}

async function resendRequest(env, path, init = {}) {
  const apiKey = envValue(env, 'RESEND_API_KEY')
  if (!apiKey) throw new Error('Marketing provider is not configured')
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

async function listSubscribers(kv) {
  const keys = []
  let cursor
  do {
    const page = await kv.list({ prefix: SUBSCRIBER_PREFIX, cursor, limit: 1000 })
    keys.push(...(page.keys || []).map(entry => entry.name))
    cursor = page.list_complete ? '' : page.cursor
  } while (cursor && keys.length < MAX_SUBSCRIBERS_PER_RUN)

  const subscribers = []
  for (const key of keys.slice(0, MAX_SUBSCRIBERS_PER_RUN)) {
    const subscriber = await kv.get(key, 'json')
    if (subscriber) subscribers.push({ key, subscriber })
  }
  return subscribers
}

async function getContact(env, email) {
  const { response, body } = await resendRequest(
    env,
    `/contacts/${encodeURIComponent(email)}`
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(body?.message || `Resend contact lookup failed (${response.status})`)
  }
  return body
}

async function createContact(env, email) {
  const { response, body } = await resendRequest(env, '/contacts', {
    method: 'POST',
    body: JSON.stringify({ email, unsubscribed: false })
  })
  if (!response.ok) {
    throw new Error(body?.message || `Resend contact creation failed (${response.status})`)
  }
  return body
}

async function addToSegment(env, email, segmentId) {
  const { response, body } = await resendRequest(
    env,
    `/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
    { method: 'POST', body: '{}' }
  )
  if (!response.ok && response.status !== 409) {
    throw new Error(body?.message || `Resend segment update failed (${response.status})`)
  }
}

async function preserveSuppression(env, email) {
  const { response, body } = await resendRequest(
    env,
    `/contacts/${encodeURIComponent(email)}`,
    { method: 'PATCH', body: JSON.stringify({ unsubscribed: true }) }
  )
  if (!response.ok) {
    throw new Error(body?.message || `Resend suppression update failed (${response.status})`)
  }
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401)
  if (!env?.AUTH_KV) return json({ error: 'Newsletter storage is not configured' }, 503)

  let input = {}
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const commit = input.commit === true
  const segmentId = envValue(env, 'RESEND_NEWSLETTER_SEGMENT_ID')
  if (!segmentId) return json({ error: 'Newsletter segment is not configured' }, 503)

  const result = {
    dry_run: !commit,
    scanned: 0,
    eligible: 0,
    synced: 0,
    suppressed: 0,
    skipped: 0,
    errors: []
  }
  const subscribers = await listSubscribers(env.AUTH_KV)
  result.scanned = subscribers.length

  for (const { subscriber } of subscribers) {
    const email = normalizeEmail(subscriber.email)
    if (!email || !subscriber.consent) {
      result.skipped += 1
      continue
    }
    if (subscriber.status === 'unsubscribed') {
      result.suppressed += 1
      if (!commit) continue
      try {
        const contact = await getContact(env, email)
        if (contact && contact.unsubscribed !== true) await preserveSuppression(env, email)
      } catch (error) {
        result.errors.push({ email, operation: 'suppress', message: error.message })
      }
      continue
    }
    if (subscriber.status !== 'subscribed') {
      result.skipped += 1
      continue
    }
    result.eligible += 1
    if (!commit) continue
    try {
      const contact = await getContact(env, email)
      if (!contact) await createContact(env, email)
      else if (contact.unsubscribed === true) {
        result.skipped += 1
        continue
      }
      await addToSegment(env, email, segmentId)
      result.synced += 1
    } catch (error) {
      result.errors.push({ email, operation: 'sync', message: error.message })
    }
  }

  return json(result, result.errors.length ? 207 : 200)
}
