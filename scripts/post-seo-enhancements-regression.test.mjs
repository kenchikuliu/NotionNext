import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(
  new URL('../lib/seo/postEnhancements.js', import.meta.url),
  'utf8'
)

test('agent comparison snippet targets the current GSC opportunity', () => {
  assert.match(source, /Dify vs FastGPT vs Coze 2026: Best RAG Agent Tools/)
  assert.match(source, /Compare Dify vs FastGPT vs Coze/)
  assert.match(source, /FastGPT vs Dify: which is better/)
  assert.match(source, /FastGPT Deployment Guide/)
  assert.match(
    source,
    /en-us\/article\/agent': AI_AGENT_COMPARISON_ENHANCEMENT/
  )
  assert.match(source, /article\/agent': AI_AGENT_COMPARISON_ENHANCEMENT/)
})
