/** @jest-environment node */

import { onRequestPost } from '@/functions/api/admin/newsletter-sync'

function memoryKv(entries = []) {
  const values = new Map(entries)
  return {
    list: jest.fn(({ prefix }) => Promise.resolve({
      keys: [...values.keys()]
        .filter(key => key.startsWith(prefix))
        .map(name => ({ name })),
      list_complete: true,
      cursor: ''
    })),
    get: jest.fn((key, type) => {
      const value = values.get(key)
      return Promise.resolve(
        value === undefined ? null : type === 'json' ? JSON.parse(value) : value
      )
    })
  }
}

function request(body, authorization = 'sync-secret') {
  return {
    headers: {
      get: key =>
        String(key).toLowerCase() === 'authorization'
          ? `Bearer ${authorization}`
          : null
    },
    json: () => Promise.resolve(body)
  }
}

function subscriber(email, status) {
  return JSON.stringify({ email, status, consent: true })
}

describe('newsletter audience sync', () => {
  it('defaults to a dry run and never calls Resend', async () => {
    const kv = memoryKv([
      ['newsletter:subscriber:a', subscriber('reader@example.com', 'subscribed')],
      ['newsletter:subscriber:b', subscriber('gone@example.com', 'unsubscribed')]
    ])
    const response = await onRequestPost({
      request: request({}),
      env: { AUTH_KV: kv, MARKETING_SYNC_SECRET: 'sync-secret', RESEND_NEWSLETTER_SEGMENT_ID: 'segment' }
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({ dry_run: true, scanned: 2, eligible: 1, suppressed: 1, synced: 0 })
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not restore a globally suppressed Resend contact', async () => {
    const kv = memoryKv([
      ['newsletter:subscriber:a', subscriber('reader@example.com', 'subscribed')]
    ])
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ email: 'reader@example.com', unsubscribed: true })
    })
    const response = await onRequestPost({
      request: request({ commit: true }),
      env: { AUTH_KV: kv, MARKETING_SYNC_SECRET: 'sync-secret', RESEND_API_KEY: 'key', RESEND_NEWSLETTER_SEGMENT_ID: 'segment' }
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ eligible: 1, synced: 0, skipped: 1 }))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('requires the sync secret', async () => {
    const response = await onRequestPost({
      request: request({}, 'wrong'),
      env: { AUTH_KV: memoryKv(), MARKETING_SYNC_SECRET: 'sync-secret' }
    })
    expect(response.status).toBe(401)
  })
})
