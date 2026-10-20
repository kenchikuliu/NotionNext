import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const researchSummary = JSON.parse(
  fs.readFileSync('content/reviewed/research-summary.json', 'utf8')
)
const knowledgeWorkflow = JSON.parse(
  fs.readFileSync('content/reviewed/knowledge-workflow.json', 'utf8')
)
const source = fs
  .readFileSync('lib/content/reviewedArticles.js', 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/export /g, '')
const context = { researchSummary, knowledgeWorkflow }
vm.createContext(context)
vm.runInContext(
  source +
    '\nthis.api={getReviewedArticleRecordMap,applyReviewedArticleMetadata}',
  context
)
const { getReviewedArticleRecordMap, applyReviewedArticleMetadata } =
  context.api
assert.equal(getReviewedArticleRecordMap('unrelated'), null)
for (const article of [researchSummary, knowledgeWorkflow]) {
  const map = getReviewedArticleRecordMap(article.id)
  assert.equal(Object.keys(map.block)[0], article.id)
  const compact = getReviewedArticleRecordMap(article.id.replaceAll('-', ''))
  assert.deepEqual(
    JSON.parse(JSON.stringify(map)),
    JSON.parse(JSON.stringify(compact))
  )
  assert.equal(
    map.block[article.id].value.content.length,
    article.blocks.length
  )
  assert.equal(new Set(Object.keys(map.block)).size, article.blocks.length + 1)
  for (const id of map.block[article.id].value.content) {
    assert.match(
      id,
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
    )
    assert.equal(map.block[id].value.parent_id, article.id)
  }
  const text = JSON.stringify(article)
  assert.doesNotMatch(text, /Wave 3|主题权重|搜索意图/)
  const paragraphs = article.blocks
    .filter(b => b.type === 'text')
    .map(b => b.text)
  assert.equal(new Set(paragraphs).size, paragraphs.length)
  assert.ok(article.blocks.filter(b => b.type === 'image').length >= 2)
  for (const b of article.blocks.filter(b => b.type === 'image')) {
    assert.ok(b.caption && b.source)
    if (b.src.startsWith('/')) assert.ok(fs.existsSync('public' + b.src))
  }
  for (const b of article.blocks.filter(
    b => b.type === 'link' && b.href.startsWith('/resources/')
  )) {
    assert.ok(fs.existsSync('public' + b.href))
  }
  const post = { id: article.id, title: 'old', summary: 'old' }
  assert.equal(applyReviewedArticleMetadata(post).title, article.title)
  assert.equal(applyReviewedArticleMetadata(post).summary, article.summary)
}
const untouched = { id: 'other', title: 'keep' }
assert.equal(applyReviewedArticleMetadata(untouched), untouched)
assert.equal(untouched.title, 'keep')
console.log(
  'Reviewed article scope, block graph, evidence images, resources and metadata passed'
)
