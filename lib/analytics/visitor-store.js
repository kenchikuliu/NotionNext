import { createHash } from 'node:crypto'

const ANALYTICS_NAMESPACE = 'charliiai:analytics'
const VISITOR_TTL_SECONDS = 60 * 60 * 24 * 365
const MAX_STORED_EVENTS = 100
const BLOB_PREFIX = 'analytics/visitors'
const BLOB_LIST_LIMIT = 1000

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}

function truncateString(value, maxLength = 512) {
  return typeof value === 'string' ? value.slice(0, maxLength) : value
}

function truncateObject(value, maxLength = 512) {
  return Object.fromEntries(
    Object.entries(cleanObject(value)).map(([key, rawValue]) => {
      if (typeof rawValue === 'string') {
        return [key, truncateString(rawValue, maxLength)]
      }
      if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        return [key, rawValue]
      }
      return [key, JSON.stringify(rawValue).slice(0, maxLength)]
    })
  )
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object') return null

  const eventName =
    typeof event.event_name === 'string'
      ? event.event_name
      : typeof event.name === 'string'
        ? event.name
        : ''

  if (!eventName) return null

  return cleanObject({
    event_name: eventName.slice(0, 96),
    source: truncateString(event.source || 'browser', 80),
    occurred_at: truncateString(event.occurred_at || new Date().toISOString(), 64),
    properties: truncateObject(event.properties || {}, 512)
  })
}

function normalizePayload(body) {
  const payload = body && typeof body === 'object' ? body : {}
  const firstTouch =
    payload.first_touch && typeof payload.first_touch === 'object'
      ? truncateObject(payload.first_touch, 1024)
      : null

  return {
    visitor_id: typeof payload.visitor_id === 'string' ? payload.visitor_id.slice(0, 128) : '',
    first_touch: firstTouch,
    source_page: typeof payload.source_page === 'string' ? payload.source_page.slice(0, 512) : '',
    user_id: typeof payload.user_id === 'string' ? payload.user_id.slice(0, 128) : '',
    event: normalizeEvent(payload.event)
  }
}

function getMemoryStore() {
  if (!globalThis.__charliiaiAnalyticsStore) {
    globalThis.__charliiaiAnalyticsStore = new Map()
  }
  return globalThis.__charliiaiAnalyticsStore
}

function getRedisRestConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ''
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ''

  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

function getBlobPath(cacheKey) {
  const digest = createHash('sha256').update(cacheKey).digest('hex')
  return `${BLOB_PREFIX}/${digest}.json`
}

function getBlobVisitorPrefix(cacheKey) {
  const digest = createHash('sha256').update(cacheKey).digest('hex')
  return `${BLOB_PREFIX}/${digest}`
}

function getBlobRecordPath(cacheKey, recordType, timestamp = new Date()) {
  const safeTimestamp = timestamp.toISOString().replace(/[:.]/g, '-')
  const nonce = createHash('sha256')
    .update(`${cacheKey}:${recordType}:${safeTimestamp}:${Math.random()}`)
    .digest('hex')
    .slice(0, 12)

  return `${getBlobVisitorPrefix(cacheKey)}/records/${safeTimestamp}-${nonce}-${recordType}.json`
}

async function getBlobClient() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null

  try {
    return await import('@vercel/blob')
  } catch (error) {
    console.warn('[analytics-store] Blob client unavailable:', error?.message || error)
    return null
  }
}

async function getRedisClient() {
  if (!process.env.REDIS_URL) return null

  if (globalThis.__charliiaiAnalyticsRedis) {
    return globalThis.__charliiaiAnalyticsRedis
  }

  try {
    const Redis = (await import('ioredis')).default
    globalThis.__charliiaiAnalyticsRedis = new Redis(process.env.REDIS_URL)
    return globalThis.__charliiaiAnalyticsRedis
  } catch (error) {
    console.warn('[analytics-store] Redis unavailable:', error?.message || error)
    return null
  }
}

function eventKey(event) {
  return [
    event?.received_at || '',
    event?.occurred_at || '',
    event?.event_name || '',
    event?.source || '',
    JSON.stringify(event?.properties || {})
  ].join('|')
}

function mergeEventLists(...eventLists) {
  const seen = new Set()
  const merged = []

  for (const events of eventLists) {
    if (!Array.isArray(events)) continue

    for (const event of events) {
      if (!event || typeof event !== 'object') continue

      const key = eventKey(event)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(event)
    }
  }

  return merged
    .sort((a, b) => String(a.received_at || a.occurred_at || '').localeCompare(String(b.received_at || b.occurred_at || '')))
    .slice(-MAX_STORED_EVENTS)
}

function pickEarliestTimestamp(...values) {
  return values.filter(Boolean).sort()[0] || ''
}

function pickLatestTimestamp(...values) {
  const sorted = values.filter(Boolean).sort()
  return sorted[sorted.length - 1] || ''
}

function mergeStoredStates(...states) {
  const validStates = states.filter((state) => state && typeof state === 'object')
  const merged = {}

  for (const state of validStates) {
    Object.assign(merged, state)
  }

  const events = mergeEventLists(...validStates.map((state) => state.events))
  const firstTouch = validStates.find((state) => state.first_touch && typeof state.first_touch === 'object')?.first_touch
  const userState = [...validStates].reverse().find((state) => state.user_id)
  const sourcePageState = [...validStates].reverse().find((state) => state.source_page)

  return cleanObject({
    ...merged,
    ...(firstTouch ? { first_touch: firstTouch } : {}),
    ...(events.length ? { events } : {}),
    user_id: userState?.user_id || '',
    source_page: sourcePageState?.source_page || '',
    created_at: pickEarliestTimestamp(...validStates.map((state) => state.created_at)),
    updated_at: pickLatestTimestamp(...validStates.map((state) => state.updated_at))
  })
}

async function readBlobJson(blob, pathname) {
  const result = await blob.get(pathname, {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN
  })

  if (!result?.stream) return null

  const raw = await new Response(result.stream).text()
  return raw ? JSON.parse(raw) : null
}

function stateFromBlobRecords(cacheKey, records) {
  const sortedRecords = records
    .filter((record) => record && typeof record === 'object')
    .sort((a, b) => String(a.received_at || '').localeCompare(String(b.received_at || '')))

  const events = []
  let firstTouch = null
  let userId = ''
  let sourcePage = ''

  for (const record of sortedRecords) {
    if (!firstTouch && record.first_touch && typeof record.first_touch === 'object') {
      firstTouch = record.first_touch
    }

    if (record.user_id) {
      userId = record.user_id
    }

    if (record.source_page) {
      sourcePage = record.source_page
    }

    if (record.event && typeof record.event === 'object') {
      events.push(record.event)
    }
  }

  return cleanObject({
    cache_key: cacheKey,
    ...(firstTouch ? { first_touch: firstTouch } : {}),
    ...(events.length ? { events: mergeEventLists(events) } : {}),
    user_id: userId,
    source_page: sourcePage,
    created_at: pickEarliestTimestamp(...sortedRecords.map((record) => record.received_at)),
    updated_at: pickLatestTimestamp(...sortedRecords.map((record) => record.received_at))
  })
}

async function readBlobState(blob, cacheKey) {
  const states = []

  try {
    const legacyState = await readBlobJson(blob, getBlobPath(cacheKey))
    if (legacyState) {
      states.push(legacyState)
    }
  } catch (error) {
    console.warn('[analytics-store] Blob legacy read skipped:', error?.message || error)
  }

  try {
    const records = []
    let cursor

    do {
      const listed = await blob.list({
        prefix: `${getBlobVisitorPrefix(cacheKey)}/records/`,
        limit: BLOB_LIST_LIMIT,
        cursor,
        token: process.env.BLOB_READ_WRITE_TOKEN
      })

      for (const item of listed.blobs || []) {
        const record = await readBlobJson(blob, item.pathname).catch((error) => {
          console.warn('[analytics-store] Blob record read skipped:', error?.message || error)
          return null
        })

        if (record) {
          records.push(record)
        }
      }

      cursor = listed.hasMore ? listed.cursor : undefined
    } while (cursor)

    if (records.length) {
      states.push(stateFromBlobRecords(cacheKey, records))
    }
  } catch (error) {
    console.warn('[analytics-store] Blob records read skipped:', error?.message || error)
  }

  return mergeStoredStates(...states)
}

async function writeBlobRecord(blob, cacheKey, recordType, record, timestamp) {
  await blob.put(getBlobRecordPath(cacheKey, recordType, timestamp), JSON.stringify(record), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN
  })
}

async function writeBlobUpdate(blob, cacheKey, value, update = {}) {
  const timestamp = update.timestamp ? new Date(update.timestamp) : new Date()
  const receivedAt = timestamp.toISOString()
  const baseRecord = {
    cache_key: cacheKey,
    received_at: receivedAt
  }
  const writes = []

  if (update.firstTouch && Object.keys(update.firstTouch).length) {
    writes.push(
      writeBlobRecord(
        blob,
        cacheKey,
        'first_touch',
        {
          ...baseRecord,
          record_type: 'first_touch',
          first_touch: update.firstTouch
        },
        timestamp
      )
    )
  }

  if (update.event) {
    writes.push(
      writeBlobRecord(
        blob,
        cacheKey,
        'event',
        {
          ...baseRecord,
          record_type: 'event',
          event: update.event,
          user_id: value.user_id || '',
          source_page: value.source_page || ''
        },
        timestamp
      )
    )
  }

  if (update.userId || update.sourcePage) {
    writes.push(
      writeBlobRecord(
        blob,
        cacheKey,
        'profile',
        {
          ...baseRecord,
          record_type: 'profile',
          user_id: value.user_id || '',
          source_page: value.source_page || ''
        },
        timestamp
      )
    )
  }

  if (writes.length) {
    await Promise.all(writes)
  }

  getMemoryStore().set(cacheKey, value)
  return 'blob'
}

async function readStoredState(cacheKey) {
  const redis = await getRedisClient()

  if (redis) {
    try {
      const raw = await redis.get(cacheKey)
      return raw ? JSON.parse(raw) : {}
    } catch (error) {
      console.warn('[analytics-store] Redis read skipped:', error?.message || error)
    }
  }

  const rest = getRedisRestConfig()
  if (rest) {
    try {
      const response = await fetch(`${rest.url}/get/${encodeURIComponent(cacheKey)}`, {
        headers: {
          Authorization: `Bearer ${rest.token}`
        }
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Redis REST read failed with ${response.status}`)
      }
      return data?.result ? JSON.parse(data.result) : {}
    } catch (error) {
      console.warn('[analytics-store] Redis REST read skipped:', error?.message || error)
    }
  }

  const blob = await getBlobClient()
  if (blob) {
    try {
      return mergeStoredStates(await readBlobState(blob, cacheKey), getMemoryStore().get(cacheKey))
    } catch (error) {
      console.warn('[analytics-store] Blob read skipped:', error?.message || error)
    }
  }

  return getMemoryStore().get(cacheKey) || {}
}

async function writeStoredState(cacheKey, value, update = {}) {
  const redis = await getRedisClient()

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(value), 'EX', VISITOR_TTL_SECONDS)
      return 'redis'
    } catch (error) {
      console.warn('[analytics-store] Redis write skipped:', error?.message || error)
    }
  }

  const rest = getRedisRestConfig()
  if (rest) {
    try {
      const response = await fetch(
        `${rest.url}/set/${encodeURIComponent(cacheKey)}?EX=${VISITOR_TTL_SECONDS}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${rest.token}`
          },
          body: JSON.stringify(value)
        }
      )
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Redis REST write failed with ${response.status}`)
      }
      return 'redis_rest'
    } catch (error) {
      console.warn('[analytics-store] Redis REST write skipped:', error?.message || error)
    }
  }

  const blob = await getBlobClient()
  if (blob) {
    try {
      return await writeBlobUpdate(blob, cacheKey, value, update)
    } catch (error) {
      console.warn('[analytics-store] Blob write skipped:', error?.message || error)
    }
  }

  getMemoryStore().set(cacheKey, value)
  return 'memory'
}

async function syncAnalyticsPayload(body) {
  const payload = normalizePayload(body)
  const userId = payload.user_id || ''

  if (!payload.visitor_id && !userId) {
    return {
      ok: false,
      statusCode: 400,
      message: 'visitor_id or user_id is required'
    }
  }

  const firstTouch = cleanObject(payload.first_touch)
  const cacheKey = `${ANALYTICS_NAMESPACE}:visitor:${payload.visitor_id || userId}`
  const existing = await readStoredState(cacheKey)
  const receivedAt = new Date().toISOString()
  const nextEvent = payload.event
    ? {
        ...payload.event,
        received_at: receivedAt
      }
    : null
  const resolvedFirstTouch =
    Object.keys(firstTouch).length > 0
      ? firstTouch
      : existing.first_touch && typeof existing.first_touch === 'object'
        ? existing.first_touch
        : null
  const previousEvents = Array.isArray(existing.events) ? existing.events : []
  const nextEvents = nextEvent ? mergeEventLists(previousEvents, [nextEvent]) : previousEvents

  const merged = {
    ...existing,
    ...(resolvedFirstTouch && Object.keys(resolvedFirstTouch).length ? { first_touch: resolvedFirstTouch } : {}),
    ...(nextEvents.length ? { events: nextEvents } : {}),
    cache_key: existing.cache_key || cacheKey,
    user_id: userId || existing.user_id || '',
    source_page: payload.source_page || existing.source_page || '',
    updated_at: receivedAt
  }

  if (!merged.created_at) {
    merged.created_at = merged.updated_at
  }

  const storage = await writeStoredState(cacheKey, merged, {
    firstTouch: Object.keys(firstTouch).length && !existing.first_touch ? firstTouch : null,
    event: nextEvent,
    userId: userId && userId !== existing.user_id ? userId : '',
    sourcePage: payload.source_page && payload.source_page !== existing.source_page ? payload.source_page : '',
    timestamp: receivedAt
  })

  return {
    ok: true,
    statusCode: 200,
    cacheKey,
    storage,
    hasUserId: Boolean(userId),
    hasFirstTouch: Boolean(resolvedFirstTouch),
    eventStored: Boolean(payload.event),
    eventCount: nextEvents.length
  }
}

export {
  ANALYTICS_NAMESPACE,
  MAX_STORED_EVENTS,
  normalizePayload,
  syncAnalyticsPayload
}
