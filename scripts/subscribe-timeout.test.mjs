import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
const source = await fs.readFile(
  new URL('../lib/plugins/mailchimp.js', import.meta.url),
  'utf8'
)
function harness(fetch, window = undefined) {
  let timer,
    cleared = 0
  const ctx = vm.createContext({
    fetch,
    window,
    document: { referrer: '' },
    URL,
    URLSearchParams,
    AbortController,
    setTimeout: (fn, ms) => {
      assert.equal(ms, 30000)
      timer = fn
      return 1
    },
    clearTimeout: () => cleared++
  })
  vm.runInContext(
    source.replace('export async function', 'async function') +
      ';globalThis.submit=subscribeToNewsletter',
    ctx
  )
  return { submit: ctx.submit, expire: () => timer(), cleared: () => cleared }
}
const input = {
  email: 'test@example.com',
  source: 'heo_home_cta',
  locale: 'en-US'
}
for (const stage of ['fetch', 'body'])
  test(`bounds stalled ${stage}, aborts and permits manual retry`, async () => {
    let calls = 0,
      signal,
      finish
    const held = new Promise(r => (finish = r))
    const h = harness(async (_url, init) => {
      calls++
      signal = init.signal
      if (calls === 1 && stage === 'fetch') return held
      return {
        ok: true,
        json: () =>
          calls === 1 && stage === 'body'
            ? held
            : Promise.resolve({ status: 'success' })
      }
    })
    const first = h.submit(input)
    await Promise.resolve()
    await Promise.resolve()
    h.expire()
    await assert.rejects(
      first,
      /could not confirm.*may already be saved.*inbox/
    )
    assert.equal(signal.aborted, true)
    assert.equal(calls, 1)
    assert.equal(h.cleared(), 1)
    finish(
      stage === 'fetch'
        ? { ok: true, json: () => Promise.resolve({ status: 'success' }) }
        : { status: 'success' }
    )
    assert.equal((await h.submit(input)).status, 'success')
    assert.equal(calls, 2)
  })
test('Chinese timeout explains uncertain result and clears timer', async () => {
  const h = harness(() => new Promise(() => {}))
  const p = h.submit({ ...input, locale: 'zh-CN' })
  h.expire()
  await assert.rejects(p, /无法确认.*可能已经保存.*收件箱/)
  assert.equal(h.cleared(), 1)
})
test('valid receipt and original payload survive optional attribution failure', async () => {
  let body
  const window = {
    get crypto() {
      throw Error('denied')
    }
  }
  const h = harness((_u, i) => {
    body = JSON.parse(i.body)
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'success', stored_in_notion: true })
    })
  }, window)
  assert.equal(
    (
      await h.submit({
        ...input,
        source: 'claude_inquiry',
        message: 'keep request'
      })
    ).stored_in_notion,
    true
  )
  assert.equal(body.message, 'keep request')
  assert.equal(body.email, input.email)
  assert.equal(h.cleared(), 1)
})
for (const [name, response] of [
  [
    'http',
    {
      ok: false,
      json: () =>
        Promise.resolve({ status: 'error', message: 'service unavailable' })
    }
  ],
  ['empty', { ok: true, json: () => Promise.resolve({}) }],
  ['null', { ok: true, json: () => Promise.resolve(null) }],
  ['json', { ok: true, json: () => Promise.reject(Error('invalid json')) }]
])
  test(`${String(name)} failure remains a failure and releases deadline`, async () => {
    const h = harness(() => Promise.resolve(response))
    await assert.rejects(h.submit(input))
    assert.equal(h.cleared(), 1)
  })
test('network failure releases deadline', async () => {
  const h = harness(() => Promise.reject(Error('offline')))
  await assert.rejects(h.submit(input), /offline/)
  assert.equal(h.cleared(), 1)
})
test('legacy string arguments remain supported', async () => {
  let body
  const h = harness((_u, i) => {
    body = JSON.parse(i.body)
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'success' })
    })
  })
  await h.submit('a@example.com', 'First', 'Last')
  assert.equal(body.first_name, 'First')
  assert.equal(body.last_name, 'Last')
})
