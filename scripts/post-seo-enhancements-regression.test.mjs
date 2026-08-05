import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(
  new URL('../lib/seo/postEnhancements.js', import.meta.url),
  'utf8'
)
const redirects = fs.readFileSync(
  new URL('../public/_redirects', import.meta.url),
  'utf8'
)
const nextConfig = fs.readFileSync(
  new URL('../next.config.js', import.meta.url),
  'utf8'
)

test('agent comparison snippet targets the current GSC opportunity', () => {
  assert.match(source, /Dify vs FastGPT vs Coze 2026: Best RAG Agent Tools/)
  assert.match(source, /Compare Dify vs FastGPT vs Coze/)
  assert.match(source, /FastGPT vs Dify: which is better/)
  assert.match(source, /Dify vs Coze: which is better for RAG workflows/)
  assert.match(source, /Coze RAG/)
  assert.match(source, /FastGPT Deployment Guide/)
  assert.match(
    source,
    /en-us\/article\/agent': AI_AGENT_COMPARISON_ENHANCEMENT/
  )
  assert.match(source, /article\/agent': AI_AGENT_COMPARISON_ENHANCEMENT/)
})

test('charliiai Bing page opportunities have intent-matched snippets', () => {
  assert.match(source, /Voice Input Tool Guide 2026/)
  assert.match(source, /voice input tool, AI voice input tools/)
  assert.match(source, /Zotero arXiv Workflow: Auto-Import Papers/)
  assert.match(source, /importing arXiv papers into Zotero/)
  assert.match(source, /article\/ultralight-digital-human/)
  assert.match(source, /Ultralight Digital Human Guide/)
  assert.match(source, /ultra-light digital human/)
  assert.match(source, /article\/ylb/)
  assert.match(source, /引流宝使用指南/)
  assert.match(source, /如何使用引流宝/)
})

test('post SEO enhancements resolve on canonical news and sharing routes', () => {
  assert.match(source, /'news'/)
  assert.match(source, /'sharing'/)
  assert.match(source, /Manus Free Access Guide/)
  assert.match(source, /article\/manusfree/)
})

test('ranked legacy article URLs redirect to their live canonical routes', () => {
  assert.match(
    redirects,
    /\/article\/Ultralight-Digital-Human \/sharing\/Ultralight-Digital-Human 301/
  )
  assert.match(redirects, /\/article\/attention \/sharing\/attention 301/)
  assert.match(redirects, /\/article\/ChatNio \/news\/ChatNio 301/)
  assert.match(redirects, /\/article\/ReadKids \/sharing\/ReadKids 301/)
  assert.match(nextConfig, /source: '\/article\/Ultralight-Digital-Human'/)
  assert.match(nextConfig, /destination: '\/sharing\/Ultralight-Digital-Human'/)
  assert.match(nextConfig, /source: '\/article\/attention'/)
  assert.match(nextConfig, /destination: '\/sharing\/attention'/)
  assert.match(nextConfig, /source: '\/article\/ChatNio'/)
  assert.match(nextConfig, /destination: '\/news\/ChatNio'/)
  assert.match(nextConfig, /source: '\/article\/ReadKids'/)
  assert.match(nextConfig, /destination: '\/sharing\/ReadKids'/)
})
