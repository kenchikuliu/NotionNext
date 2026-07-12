import { useGlobal } from '@/lib/global'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

const FIRST_TOUCH_STORAGE_KEY = 'charliiai:analytics:first_touch'
const ACTIVE_USER_STORAGE_KEY = 'charliiai:analytics:active_user_id'
const VISITOR_ID_STORAGE_KEY = 'charliiai:analytics:visitor_id'

const NON_ARTICLE_PREFIXES = new Set([
  'api',
  'auth',
  'category',
  'dashboard',
  'debug-locale',
  'page',
  'rss',
  'search',
  'sign-in',
  'sign-up',
  'tag'
])

const STATIC_INTENT_PAGES = new Set([
  '404',
  '500',
  'about',
  'archive',
  'basicai',
  'cases',
  'chongzhi',
  'contact',
  'gptchongzhi',
  'learning',
  'paper',
  'privacy-policy',
  'prompt',
  'terms-of-service',
  'tools'
])

const PAID_INTENT_PAGES = {
  chongzhi: {
    intent: 'pricing',
    product: 'claudecode_recharge',
    service: 'ClaudeCode recharge'
  },
  gptchongzhi: {
    intent: 'pricing',
    product: 'gpt_recharge',
    service: 'GPT recharge'
  }
}

const INTENT_PATTERNS = [
  {
    eventName: 'signup_started',
    intent: 'signup',
    pattern:
      /sign\s*up|signup|register|create account|get started|join|注册|创建账户|开始使用/i
  },
  {
    eventName: 'login_started',
    intent: 'login',
    pattern: /log\s*in|login|sign\s*in|signin|登录|登陆/i
  },
  {
    eventName: 'trial_clicked',
    intent: 'trial',
    pattern: /free trial|try free|start trial|试用|免费试用|免费体验/i
  },
  {
    eventName: 'demo_requested',
    intent: 'demo',
    pattern: /demo|book|schedule|contact|预约|演示|联系/i
  },
  {
    eventName: 'pricing_viewed',
    intent: 'pricing',
    pattern: /pricing|price|plans|upgrade|套餐|价格|定价|升级|代充/i
  },
  {
    eventName: 'checkout_started',
    intent: 'checkout',
    pattern: /checkout|buy|purchase|pay|subscribe|付款|购买|支付|订阅|充值/i
  },
  {
    eventName: 'cta_clicked',
    intent: 'primary_cta',
    pattern: /start|try|open|read|learn|docs|开始|打开|阅读|了解|文档/i
  }
]

function cleanProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => {
      return value !== undefined && value !== null && value !== ''
    })
  )
}

function safeReadStorage(storage, key) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeWriteStorage(storage, key, value) {
  try {
    storage.setItem(key, value)
  } catch {
    // noop
  }
}

function safeRemoveStorage(storage, key) {
  try {
    storage.removeItem(key)
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

function getStoredFirstTouch() {
  if (typeof window === 'undefined') return {}

  const raw = safeReadStorage(window.localStorage, FIRST_TOUCH_STORAGE_KEY)
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return ''

  const existing = safeReadStorage(window.localStorage, VISITOR_ID_STORAGE_KEY)
  if (existing) {
    return String(existing).slice(0, 128)
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  safeWriteStorage(window.localStorage, VISITOR_ID_STORAGE_KEY, generated)
  return generated.slice(0, 128)
}

function captureFirstTouch() {
  if (typeof window === 'undefined') return {}

  const existing = getStoredFirstTouch()
  if (Object.keys(existing).length > 0) {
    return existing
  }

  const params = new URLSearchParams(window.location.search)
  const landingPath = window.location.pathname || '/'
  const referrer = document.referrer || undefined
  const attribution = cleanProperties({
    landing_page: `${landingPath}${window.location.search || ''}`,
    landing_path: landingPath,
    landing_url: window.location.href,
    referrer,
    referrer_host: getReferrerHost(referrer),
    traffic_source: params.get('utm_source') || getReferrerHost(referrer) || 'direct',
    traffic_medium:
      params.get('utm_medium') ||
      (document.referrer ? 'referral' : 'none'),
    traffic_campaign: params.get('utm_campaign') || undefined,
    traffic_content: params.get('utm_content') || undefined,
    traffic_term: params.get('utm_term') || undefined,
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content: params.get('utm_content') || undefined,
    utm_term: params.get('utm_term') || undefined,
    gclid: params.get('gclid') || undefined,
    fbclid: params.get('fbclid') || undefined,
    msclkid: params.get('msclkid') || undefined,
    first_touch_at: new Date().toISOString()
  })

  if (Object.keys(attribution).length > 0) {
    safeWriteStorage(
      window.localStorage,
      FIRST_TOUCH_STORAGE_KEY,
      JSON.stringify(attribution)
    )
  }

  return attribution
}

async function syncAnalyticsState({ userId, firstTouch, event }) {
  if (typeof window === 'undefined') return

  const syncEndpoint = getAnalyticsSyncEndpoint()
  if (!syncEndpoint) return

  const visitorId = getOrCreateVisitorId()
  const payload = cleanProperties({
    visitor_id: visitorId,
    user_id: userId || undefined,
    first_touch:
      firstTouch && Object.keys(firstTouch).length > 0
        ? firstTouch
        : undefined,
    source_page: `${window.location.pathname}${window.location.search || ''}`,
    event
  })

  try {
    await fetch(syncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  } catch {
    // noop
  }
}

function getAnalyticsSyncEndpoint() {
  const configuredEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_SYNC_ENDPOINT

  if (
    configuredEndpoint === 'disabled' ||
    configuredEndpoint === 'false'
  ) {
    return ''
  }

  if (window.__NEXT_DATA__?.nextExport) {
    return ''
  }

  return configuredEndpoint || '/api/analytics/sync'
}

function getAttributionContext() {
  return captureFirstTouch()
}

function setGtagUserId(userId) {
  if (typeof window === 'undefined') return

  if (typeof window.gtag === 'function') {
    window.gtag('set', 'user_id', userId)
    return
  }

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(['set', 'user_id', userId])
}

function getActiveAnalyticsUserId() {
  if (typeof window === 'undefined') return undefined

  const userId = safeReadStorage(window.sessionStorage, ACTIVE_USER_STORAGE_KEY)
  return userId ? String(userId).slice(0, 256) : undefined
}

function getNormalizedPath(rawPathname = '/') {
  const pathname = rawPathname || '/'
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  return normalizedPath.replace(
    /^\/[a-z]{2}(?:-[A-Za-z]{2})?(?=\/|$)/,
    ''
  ) || '/'
}

function getPathSegments(rawPathname = '/') {
  return getNormalizedPath(rawPathname).split('/').filter(Boolean)
}

function isArticlePath(rawPathname = '/') {
  const segments = getPathSegments(rawPathname)
  const [first] = segments

  if (!first || NON_ARTICLE_PREFIXES.has(first)) {
    return false
  }

  return segments.length > 1 || !STATIC_INTENT_PAGES.has(first)
}

function getSafeUrlPath(rawHref) {
  if (!rawHref) return ''
  try {
    const url = new URL(rawHref, window.location.origin)
    return `${url.pathname}${url.hash}`
  } catch {
    return String(rawHref).slice(0, 240)
  }
}

function getPaidPageIntent(rawPathname = '/') {
  const [first] = getPathSegments(rawPathname)
  return PAID_INTENT_PAGES[first] || null
}

function getRouteContext() {
  const pathname = window.location.pathname || '/'
  const params = new URLSearchParams(window.location.search)
  const pathWithoutLocale = getNormalizedPath(pathname)
  const segments = getPathSegments(pathname)
  const [first, second] = segments
  const hasRenderedArticle = Boolean(
    document.querySelector('#article-wrapper #notion-article')
  )

  if (first === 'search') {
    return {
      routeType: 'search',
      eventName: 'search_viewed',
      search_keyword: params.get('s') || second || undefined,
      result_path: pathWithoutLocale
    }
  }

  if (first === 'tag' && second) {
    return {
      routeType: 'tag',
      eventName: 'tag_viewed',
      tag: decodeURIComponent(second),
      result_path: pathWithoutLocale
    }
  }

  if (first === 'category' && second) {
    return {
      routeType: 'category',
      eventName: 'category_viewed',
      category: decodeURIComponent(second),
      result_path: pathWithoutLocale
    }
  }

  if (first === 'page' && second) {
    return {
      routeType: 'post_list',
      eventName: 'post_list_viewed',
      list_page: second,
      result_path: pathWithoutLocale
    }
  }

  if (hasRenderedArticle || isArticlePath(pathname)) {
    return {
      routeType: 'article',
      eventName: 'article_viewed',
      content_slug: segments.join('/'),
      article_slug: segments.at(-1),
      content_group: first,
      page_title: document.title
    }
  }

  return {
    routeType: pathWithoutLocale === '/' ? 'home' : 'page',
    eventName: pathWithoutLocale === '/' ? 'home_viewed' : 'page_intent_viewed',
    result_path: pathWithoutLocale
  }
}

function trackOnce(storageKey, eventName, properties = {}) {
  if (window.sessionStorage.getItem(storageKey)) return
  window.sessionStorage.setItem(storageKey, '1')
  trackInteractionEvent(eventName, properties)
}

export function trackInteractionEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const activeUserId = getActiveAnalyticsUserId()
  if (activeUserId) {
    setGtagUserId(activeUserId)
  }

  const payload = cleanProperties({
    ...getAttributionContext(),
    app_user_id: activeUserId,
    ...properties
  })

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, payload)
  }

  if (typeof window.plausible === 'function') {
    window.plausible(eventName, { props: payload })
  }

  if (typeof window.op === 'function') {
    window.op('track', eventName, payload)
  }

  if (window.openpanel?.track) {
    window.openpanel.track(eventName, payload)
  }

  void syncAnalyticsState({
    userId: activeUserId,
    firstTouch: getStoredFirstTouch(),
    event: {
      event_name: eventName,
      source: 'browser',
      occurred_at: new Date().toISOString(),
      properties: payload
    }
  })
}

function getUrlSuccessEvents() {
  const params = new URLSearchParams(window.location.search)
  const events = []

  if (
    params.get('payment') === 'success' ||
    params.get('checkout') === 'success' ||
    params.get('state') === 'checkout-success'
  ) {
    events.push({
      eventName: 'payment_succeeded',
      properties: {
        source: 'url_return',
        provider: params.get('provider') || undefined,
        plan: params.get('plan') || undefined,
        order_no: params.get('order_no') || undefined,
        session_id: params.get('session_id') || undefined
      }
    })
  }

  if (
    params.get('payment') === 'cancel' ||
    params.get('payment') === 'cancelled' ||
    params.get('checkout') === 'cancel' ||
    params.get('checkout') === 'cancelled' ||
    params.get('state') === 'checkout-cancelled'
  ) {
    events.push({
      eventName: 'checkout_cancelled',
      properties: {
        source: 'url_return',
        provider: params.get('provider') || undefined,
        plan: params.get('plan') || undefined,
        order_no: params.get('order_no') || undefined,
        session_id: params.get('session_id') || undefined
      }
    })
  }

  if (
    params.get('signup') === 'success' ||
    (params.get('auth_state') === 'success' && params.get('auth_mode') === 'register')
  ) {
    events.push({
      eventName: 'signup_completed',
      properties: {
        source: 'url_return',
        method: params.get('method') || 'unknown'
      }
    })
  } else if (
    params.get('login') === 'success' ||
    params.get('auth_state') === 'success'
  ) {
    events.push({
      eventName: 'login_success',
      properties: {
        source: 'url_return',
        method: params.get('method') || 'unknown'
      }
    })
  }

  if (params.get('subscribed') === 'success' || params.get('lead') === 'success') {
    events.push({
      eventName: 'lead_submitted',
      properties: {
        source: 'url_return',
        form_name: params.get('form') || 'lead_form'
      }
    })
  }

  return events
}

function getElementText(element) {
  return (
    element.getAttribute('aria-label') ||
    element.textContent ||
    element.getAttribute('title') ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function getTrackingContext(element) {
  const link = element.closest('a[href]')
  const href = (() => {
    if (!link?.href) return ''
    return getSafeUrlPath(link.href)
  })()

  return {
    href,
    rawHref: link?.href || '',
    label: getElementText(element),
    surface: element.closest('header')
      ? 'header'
      : element.closest('footer')
        ? 'footer'
        : element.closest('section')?.id || 'page'
  }
}

function getDataAttribute(element, name) {
  return element.getAttribute(`data-analytics-${name}`) || undefined
}

function getManualAnalyticsEvent(element, context) {
  const analyticsElement = element.closest('[data-analytics-event]')
  if (!analyticsElement) return null

  const eventName = getDataAttribute(analyticsElement, 'event')
  if (!eventName || !/^[a-z0-9_]+$/.test(eventName)) {
    return null
  }

  return {
    eventName,
    properties: cleanProperties({
      intent: getDataAttribute(analyticsElement, 'intent'),
      product: getDataAttribute(analyticsElement, 'product'),
      service: getDataAttribute(analyticsElement, 'service'),
      surface: getDataAttribute(analyticsElement, 'surface') || context.surface,
      cta_position: getDataAttribute(analyticsElement, 'cta-position'),
      checkout_type: getDataAttribute(analyticsElement, 'checkout-type'),
      provider: getDataAttribute(analyticsElement, 'provider')
    })
  }
}

function inferClickEvent({ label, href }) {
  const target = `${label} ${href}`.toLowerCase()
  return INTENT_PATTERNS.find(item => item.pattern.test(target))
}

export default function InteractionAnalytics() {
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useGlobal()

  useEffect(() => {
    const firstTouch = captureFirstTouch()
    void syncAnalyticsState({
      userId: getActiveAnalyticsUserId(),
      firstTouch
    })

    const routeContext = getRouteContext()
    const pagePath = `${window.location.pathname}${window.location.search}`

    trackOnce(`charliiai:route:${routeContext.eventName}:${pagePath}`, routeContext.eventName, {
      ...routeContext,
      page_path: window.location.pathname
    })

    const paidPageIntent = getPaidPageIntent(window.location.pathname)
    if (paidPageIntent) {
      trackOnce(`charliiai:pricing:${pagePath}`, 'pricing_viewed', {
        ...paidPageIntent,
        page_path: window.location.pathname,
        route_type: routeContext.routeType,
        surface: 'paid_intent_page'
      })
    }

    getUrlSuccessEvents().forEach(({ eventName, properties }) => {
      const storageKey = [
        'charliiai',
        eventName,
        window.location.pathname,
        properties.order_no,
        properties.session_id,
        properties.plan,
        properties.form_name
      ].filter(Boolean).join(':')

      if (window.sessionStorage.getItem(storageKey)) return
      window.sessionStorage.setItem(storageKey, '1')

      trackInteractionEvent(eventName, {
        ...properties,
        page_path: window.location.pathname
      })
    })

    const handleClick = event => {
      const target = event.target
      if (!(target instanceof Element)) return

      const interactive = target.closest('a,button,[role="button"]')
      if (!interactive) return

      const context = getTrackingContext(interactive)
      if (context.rawHref) {
        const url = new URL(context.rawHref, window.location.origin)
        const isExternal = url.hostname && url.hostname !== window.location.hostname
        const linkEvent = isExternal
          ? 'outbound_link_clicked'
          : isArticlePath(url.pathname)
            ? 'article_link_clicked'
            : ''

        if (linkEvent) {
          trackInteractionEvent(linkEvent, {
            label: context.label,
            href: `${url.origin}${url.pathname}`,
            link_host: url.hostname,
            surface: context.surface,
            page_path: window.location.pathname,
            route_type: routeContext.routeType
          })
        }
      }

      const manualEvent = getManualAnalyticsEvent(interactive, context)
      if (manualEvent) {
        trackInteractionEvent(manualEvent.eventName, {
          ...manualEvent.properties,
          label: context.label,
          href: context.href,
          page_path: window.location.pathname,
          route_type: routeContext.routeType
        })
        return
      }

      const inferred = inferClickEvent(context)
      if (!inferred) return

      trackInteractionEvent(inferred.eventName, {
        intent: inferred.intent,
        label: context.label,
        href: context.href,
        surface: context.surface,
        page_path: window.location.pathname
      })
    }

    const readDepthThresholds = new Set([50, 90])
    const handleReadDepth = () => {
      if (routeContext.routeType !== 'article') return

      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      )
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const scrollableHeight = Math.max(documentHeight - viewportHeight, 1)
      const depth = Math.min(
        100,
        Math.round((window.scrollY / scrollableHeight) * 100)
      )

      for (const threshold of Array.from(readDepthThresholds)) {
        if (depth < threshold) continue
        readDepthThresholds.delete(threshold)
        trackOnce(
          `charliiai:read:${threshold}:${pagePath}`,
          `article_read_${threshold}`,
          {
            ...routeContext,
            scroll_depth: threshold,
            page_path: window.location.pathname
          }
        )
      }
    }

    const handleSubmit = event => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return

      trackInteractionEvent('form_submitted', {
        form_name:
          form.getAttribute('aria-label') ||
          form.getAttribute('name') ||
          form.id ||
          form.closest('section')?.id ||
          'form',
        page_path: window.location.pathname
      })
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('submit', handleSubmit, true)
    window.addEventListener('scroll', handleReadDepth, { passive: true })
    handleReadDepth()

    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('submit', handleSubmit, true)
      window.removeEventListener('scroll', handleReadDepth)
    }
  }, [router.asPath])

  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') {
      return
    }

    const activeUserId = safeReadStorage(window.sessionStorage, ACTIVE_USER_STORAGE_KEY)

    if (isSignedIn && user?.id) {
      const userId = String(user.id).slice(0, 256)
      setGtagUserId(userId)
      if (activeUserId !== userId) {
        safeWriteStorage(window.sessionStorage, ACTIVE_USER_STORAGE_KEY, userId)
      }
      void syncAnalyticsState({
        userId,
        firstTouch: getStoredFirstTouch()
      })
      return
    }

    if (activeUserId) {
      setGtagUserId(null)
      safeRemoveStorage(window.sessionStorage, ACTIVE_USER_STORAGE_KEY)
    }
  }, [isLoaded, isSignedIn, user?.id])

  return null
}
