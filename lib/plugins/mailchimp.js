const FIRST_TOUCH_STORAGE_KEY = 'charliiai:analytics:first_touch'
const VISITOR_ID_STORAGE_KEY = 'charliiai:analytics:visitor_id'

function safeReadStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWriteStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // noop
  }
}

function getReferrerHost(rawReferrer) {
  if (!rawReferrer) return undefined

  try {
    return new URL(rawReferrer).hostname || undefined
  } catch {
    return undefined
  }
}

function getOrCreateVisitorId() {
  const existing = safeReadStorage(VISITOR_ID_STORAGE_KEY)
  if (existing) {
    return String(existing).slice(0, 128)
  }

  const generated =
    window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  safeWriteStorage(VISITOR_ID_STORAGE_KEY, generated)
  return generated.slice(0, 128)
}

function getFirstTouch() {
  const existing = safeReadStorage(FIRST_TOUCH_STORAGE_KEY)
  if (existing) {
    try {
      return JSON.parse(existing)
    } catch {
      return {}
    }
  }

  const params = new URLSearchParams(window.location.search)
  const landingPath = window.location.pathname || '/'
  const referrer = document.referrer || undefined
  const firstTouch = {
    landing_page: `${landingPath}${window.location.search || ''}`,
    landing_path: landingPath,
    landing_url: window.location.href,
    referrer,
    referrer_host: getReferrerHost(referrer),
    traffic_source:
      params.get('utm_source') || getReferrerHost(referrer) || 'direct',
    traffic_medium:
      params.get('utm_medium') || (document.referrer ? 'referral' : 'none'),
    traffic_campaign: params.get('utm_campaign') || undefined,
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    gclid: params.get('gclid') || undefined,
    fbclid: params.get('fbclid') || undefined,
    msclkid: params.get('msclkid') || undefined,
    first_touch_at: new Date().toISOString()
  }

  safeWriteStorage(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(firstTouch))
  return firstTouch
}

function getClientAnalyticsPayload() {
  if (typeof window === 'undefined') {
    return {}
  }

  return {
    visitor_id: getOrCreateVisitorId(),
    first_touch: getFirstTouch(),
    pageUrl: window.location.href,
    referrer: document.referrer || ''
  }
}

export async function subscribeToNewsletter(input, firstName, lastName) {
  const payload =
    typeof input === 'string'
      ? { email: input, first_name: firstName, last_name: lastName }
      : input || {}
  let analytics = {}
  try {
    if (payload.source !== 'heo_home_cta')
      analytics = getClientAnalyticsPayload()
  } catch {
    // Optional attribution must not prevent an inquiry from being submitted.
  }
  const enrichedPayload = { ...analytics, ...payload }
  const controller = new AbortController()
  let timer
  const timeoutMessage = String(payload.locale || 'zh-CN').startsWith('en')
    ? 'We could not confirm your submission. It may already be saved. Check your inbox before trying again.'
    : '暂时无法确认提交结果，内容可能已经保存。请先检查收件箱，再决定是否重试。'

  try {
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(timeoutMessage))
        controller.abort()
      }, 30000)
    })
    const submission = (async () => {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedPayload),
        signal: controller.signal
      })
      const data = await response.json()
      if (response.ok === false || data?.status !== 'success') {
        throw new Error(data?.message || 'Submission failed. Please try again.')
      }
      return data
    })()
    return await Promise.race([submission, deadline])
  } finally {
    clearTimeout(timer)
  }
}
