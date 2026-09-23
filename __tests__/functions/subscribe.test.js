/** @jest-environment node */

import { onRequestPost } from '@/functions/api/subscribe'
import { webcrypto } from 'node:crypto'
import { TextDecoder, TextEncoder } from 'node:util'
import {
  onRequestGet as confirmGet,
  onRequestPost as confirmPost
} from '@/functions/confirm-subscription'
import {
  onRequestGet as unsubscribeGet,
  onRequestPost as unsubscribePost
} from '@/functions/unsubscribe'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    const headers = new Map(
      Object.entries(init.headers || {}).map(([key, value]) => [
        key.toLowerCase(),
        value
      ])
    )
    this.headers = {
      get: key => headers.get(String(key).toLowerCase()) || null
    }
  }

  json() {
    return Promise.resolve(JSON.parse(this.body))
  }

  text() {
    return Promise.resolve(this.body)
  }
}

beforeAll(() => {
  global.Response = TestResponse
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: webcrypto
  })
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
  if (typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = () => new AbortController().signal
  }
})

function memoryKv() {
  const values = new Map()
  return {
    values,
    get(key, type) {
      const value = values.get(key)
      return Promise.resolve(
        value === undefined ? null : type === 'json' ? JSON.parse(value) : value
      )
    },
    put(key, value) {
      values.set(key, value)
      return Promise.resolve()
    },
    delete(key) {
      values.delete(key)
      return Promise.resolve()
    }
  }
}

function request(
  body,
  {
    cookie = '',
    url = 'https://www.charliiai.com/api/subscribe',
    method = 'POST',
    contentType = 'application/json'
  } = {}
) {
  const headers = new Map([
    ['content-type', contentType],
    ['cookie', cookie],
    ['origin', 'https://www.charliiai.com']
  ])
  return {
    url,
    method,
    headers: { get: key => headers.get(String(key).toLowerCase()) || null },
    json() {
      return Promise.resolve(body || {})
    },
    formData() {
      const form = new FormData()
      Object.entries(body || {}).forEach(([key, value]) => form.set(key, value))
      return Promise.resolve(form)
    }
  }
}

function env(kv = memoryKv()) {
  return {
    AUTH_KV: kv,
    GROWTH_SERVER_TOKEN: 'server-token',
    GROWTH_EMAIL_SERVICE_URL: 'https://collector.example',
    GROWTH_COLLECTOR_URL: 'https://collector.example'
  }
}

function accepted(status = 202, body = { accepted: true }) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve({ status: 'sent', ...body })
  }
}

function subscription(overrides = {}) {
  return {
    email: 'Reader@Example.com',
    locale: 'zh-CN',
    source: 'heo_home_cta',
    newsletter_consent: true,
    pageUrl: 'https://www.charliiai.com/?utm_source=test',
    ...overrides
  }
}

describe('Cloudflare Pages newsletter subscription', () => {
  it('keeps the request pending until recipient POST confirms, then emits a PII-free conversion', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    const response = await onRequestPost({
      request: request(subscription(), {
        cookie:
          '_wga_consent=granted; _wga_visitor=visitor_1234567890123456; _wga_session=session_1234567890123456'
      }),
      env: env(kv)
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        stored_in_kv: true,
        user_notified: true,
        analytics_synced: false,
        duplicate: false
      })
    )
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    const subscriber = JSON.parse(subscriberEntry[1])
    expect(subscriber).toEqual(
      expect.objectContaining({
        email: 'reader@example.com',
        status: 'pending_confirmation',
        consent: true,
        verificationStatus: 'sent'
      })
    )
    expect(fetch.mock.calls).toHaveLength(1)
    const verifyEmail = JSON.parse(fetch.mock.calls[0][1].body)
    expect(verifyEmail.template_id).toBe('email_verification')
    expect(verifyEmail.input.verify_url).toContain(subscriber.verificationToken)

    const confirmation = await confirmGet({
      request: request(null, {
        url: verifyEmail.input.verify_url,
        method: 'GET'
      }),
      env: env(kv)
    })
    expect(confirmation.status).toBe(200)
    expect(JSON.parse(kv.values.get(subscriberEntry[0])).status).toBe(
      'pending_confirmation'
    )
    expect(fetch.mock.calls).toHaveLength(1)

    const completed = await confirmPost({
      request: request(
        { token: subscriber.verificationToken },
        { url: verifyEmail.input.verify_url }
      ),
      env: env(kv)
    })
    expect(completed.status).toBe(200)
    expect(JSON.parse(kv.values.get(subscriberEntry[0])).status).toBe(
      'subscribed'
    )
    expect(
      JSON.parse(kv.values.get(subscriberEntry[0])).analyticsContext
    ).toBeNull()

    const ownerCall = fetch.mock.calls.find(([, options]) =>
      String(options.body).includes('contact_notification')
    )
    const ownerEmail = JSON.parse(ownerCall[1].body)
    expect(ownerEmail.to).toBe('kenchikuliu@outlook.com')
    expect(ownerEmail.input.requester_email).toBe('reader@example.com')
    expect(ownerEmail).not.toHaveProperty('reply_to')

    const collectorCall = fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/server/event')
    )
    const payload = JSON.parse(collectorCall[1].body)
    expect(payload.event).toEqual(
      expect.objectContaining({
        name: 'form_submit',
        anonymous_id: 'visitor_1234567890123456',
        properties: { element: 'newsletter_subscription' }
      })
    )
    expect(JSON.stringify(payload)).not.toContain('reader@example.com')
    expect(payload.event.url).toBe('https://www.charliiai.com/')
  })

  it('rejects invalid email before persistence or delivery', async () => {
    const kv = memoryKv()
    const response = await onRequestPost({
      request: request(subscription({ email: 'invalid' })),
      env: env(kv)
    })

    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
    expect(kv.values.size).toBe(0)
  })

  it('requires explicit subscription consent and a same-origin request', async () => {
    const kv = memoryKv()
    const noConsent = await onRequestPost({
      request: request(subscription({ newsletter_consent: false })),
      env: env(kv)
    })
    const foreign = request(subscription())
    foreign.headers.get = name =>
      String(name).toLowerCase() === 'origin' ? 'https://example.com' : null
    const crossSite = await onRequestPost({ request: foreign, env: env(kv) })
    expect(noConsent.status).toBe(403)
    expect(crossSite.status).toBe(403)
    expect(kv.values.size).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an external source URL for attribution', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    await onRequestPost({
      request: request(
        subscription({
          pageUrl: 'https://example.com/private?email=reader@example.com'
        })
      ),
      env: env(kv)
    })
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    expect(JSON.parse(subscriberEntry[1]).pageUrl).toBe(
      'https://www.charliiai.com/'
    )
  })

  it('treats a repeated pending request as idempotent', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    const first = await onRequestPost({
      request: request(subscription()),
      env: env(kv)
    })
    expect(first.status).toBe(200)
    const callCount = fetch.mock.calls.length

    const second = await onRequestPost({
      request: request(subscription()),
      env: env(kv)
    })
    const result = await second.json()
    expect(second.status).toBe(200)
    expect(result.duplicate).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(callCount)
  })

  it('keeps a failed confirmation pending and does not emit a conversion', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'rejected' })
    })
    const response = await onRequestPost({
      request: request(subscription()),
      env: env(kv)
    })
    const result = await response.json()

    expect(response.status).toBe(502)
    expect(result.user_notified).toBe(false)
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    expect(JSON.parse(subscriberEntry[1]).status).toBe('pending_confirmation')
    expect(
      fetch.mock.calls.some(([url]) => String(url).endsWith('/server/event'))
    ).toBe(false)
  })

  it('does not emit analytics after verification without earlier analytics consent', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    const response = await onRequestPost({
      request: request(subscription()),
      env: env(kv)
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.analytics_synced).toBe(false)
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    const token = JSON.parse(subscriberEntry[1]).verificationToken
    await confirmPost({
      request: request(
        { token },
        { url: 'https://www.charliiai.com/confirm-subscription' }
      ),
      env: env(kv)
    })
    expect(
      fetch.mock.calls.some(([url]) => String(url).endsWith('/server/event'))
    ).toBe(false)
  })

  it('honors a GPC preference even when older analytics consent cookies exist', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    const submission = request(subscription(), {
      cookie:
        '_wga_consent=granted; _wga_visitor=visitor_1234567890123456; _wga_session=session_1234567890123456'
    })
    const originalGet = submission.headers.get
    submission.headers.get = name =>
      String(name).toLowerCase() === 'sec-gpc' ? '1' : originalGet(name)
    await onRequestPost({ request: submission, env: env(kv) })
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    const subscriber = JSON.parse(subscriberEntry[1])
    expect(subscriber.analyticsContext).toBeNull()
    await confirmPost({
      request: request(
        { token: subscriber.verificationToken },
        { url: 'https://www.charliiai.com/confirm-subscription' }
      ),
      env: env(kv)
    })
    expect(
      fetch.mock.calls.some(([url]) => String(url).endsWith('/server/event'))
    ).toBe(false)
  })

  it('does not attribute a confirmed subscriber when GPC is enabled at verification', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    await onRequestPost({
      request: request(subscription(), {
        cookie:
          '_wga_consent=granted; _wga_visitor=visitor_1234567890123456; _wga_session=session_1234567890123456'
      }),
      env: env(kv)
    })
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    const subscriber = JSON.parse(subscriberEntry[1])
    const confirmation = request(
      { token: subscriber.verificationToken },
      { url: 'https://www.charliiai.com/confirm-subscription' }
    )
    const originalGet = confirmation.headers.get
    confirmation.headers.get = name =>
      String(name).toLowerCase() === 'sec-gpc' ? '1' : originalGet(name)
    const result = await confirmPost({ request: confirmation, env: env(kv) })
    expect(result.status).toBe(200)
    expect(JSON.parse(kv.values.get(subscriberEntry[0])).status).toBe(
      'subscribed'
    )
    expect(
      fetch.mock.calls.some(([url]) => String(url).endsWith('/server/event'))
    ).toBe(false)
  })

  it('does not send mail or analytics when durable persistence fails', async () => {
    const kv = memoryKv()
    kv.put = jest.fn().mockRejectedValue(new Error('KV unavailable'))
    const response = await onRequestPost({
      request: request(subscription()),
      env: env(kv)
    })

    expect(response.status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('supports confirmed unsubscribe and explicit resubscribe', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    await onRequestPost({ request: request(subscription()), env: env(kv) })
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    const original = JSON.parse(subscriberEntry[1])
    const verifyUrl = `https://www.charliiai.com/confirm-subscription?token=${original.verificationToken}`
    await confirmPost({
      request: request(
        { token: original.verificationToken },
        { url: verifyUrl }
      ),
      env: env(kv)
    })
    const unsubscribeUrl = original.unsubscribeUrl

    const confirmation = await unsubscribeGet({
      request: request(null, { url: unsubscribeUrl, method: 'GET' }),
      env: env(kv)
    })
    expect(confirmation.status).toBe(200)
    expect(await confirmation.text()).toContain('确认退订')

    const completed = await unsubscribePost({
      request: request(
        { token: original.unsubscribeToken },
        { url: unsubscribeUrl }
      ),
      env: env(kv)
    })
    expect(completed.status).toBe(200)
    expect(JSON.parse(kv.values.get(subscriberEntry[0])).status).toBe(
      'unsubscribed'
    )

    await onRequestPost({ request: request(subscription()), env: env(kv) })
    const resubscribed = JSON.parse(kv.values.get(subscriberEntry[0]))
    expect(resubscribed.status).toBe('pending_confirmation')
    expect(resubscribed.subscriptionId).not.toBe(original.subscriptionId)
    expect(resubscribed.unsubscribeToken).not.toBe(original.unsubscribeToken)
    const oldLink = await confirmGet({
      request: request(null, { url: verifyUrl, method: 'GET' }),
      env: env(kv)
    })
    expect(oldLink.status).toBe(400)
  })

  it('rejects invalid and expired verification links', async () => {
    const kv = memoryKv()
    fetch.mockResolvedValue(accepted())
    await onRequestPost({ request: request(subscription()), env: env(kv) })
    const subscriberEntry = [...kv.values.entries()].find(([key]) =>
      key.startsWith('newsletter:subscriber:')
    )
    const subscriber = JSON.parse(subscriberEntry[1])
    const url = `https://www.charliiai.com/confirm-subscription?token=${subscriber.verificationToken}`
    expect(
      (
        await confirmGet({
          request: request(null, {
            url: 'https://www.charliiai.com/confirm-subscription?token=invalid',
            method: 'GET'
          }),
          env: env(kv)
        })
      ).status
    ).toBe(400)
    subscriber.expiresAt = Date.now() - 1000
    kv.values.set(subscriberEntry[0], JSON.stringify(subscriber))
    expect(
      (
        await confirmPost({
          request: request(
            { token: subscriber.verificationToken },
            {
              url
            }
          ),
          env: env(kv)
        })
      ).status
    ).toBe(400)
    expect(JSON.parse(kv.values.get(subscriberEntry[0])).status).toBe(
      'pending_confirmation'
    )
    expect(fetch.mock.calls).toHaveLength(1)
  })
})
