import researchSummary from '../../content/reviewed/research-summary.json'
import knowledgeWorkflow from '../../content/reviewed/knowledge-workflow.json'

const articles = [researchSummary, knowledgeWorkflow]
const normalizeId = id =>
  String(id || '')
    .replace(/-/g, '')
    .toLowerCase()

export function getReviewedArticle(id) {
  return articles.find(article => normalizeId(article.id) === normalizeId(id))
}

function blockId(id, index) {
  const suffix = (index + 1).toString(16).padStart(12, '0')
  return `${id.slice(0, 19)}a001-${suffix}`
}

/** Two explicitly reviewed pages only; source records are never mutated. */
export function getReviewedArticleRecordMap(id) {
  const article = getReviewedArticle(id)
  if (!article) return null
  const block = {}
  const content = article.blocks.map((part, index) => {
    const id = blockId(article.id, index)
    const properties = { title: [[part.text || '']] }
    const value = {
      id,
      type: part.type === 'link' ? 'text' : part.type,
      parent_id: article.id,
      parent_table: 'block',
      alive: true,
      properties
    }
    if (part.type === 'link') {
      properties.title = [[part.text, [['a', part.href]]]]
    } else if (part.type === 'image') {
      const src = part.src.startsWith('/')
        ? `https://www.charliiai.com${part.src}`
        : part.src
      delete properties.title
      properties.source = [[src]]
      properties.caption = [[part.caption, [['a', part.source]]]]
      value.format = {
        display_source: src,
        block_width: 1000,
        block_full_width: false,
        block_preserve_scale: true
      }
    } else if (part.type === 'code') {
      properties.language = [[part.language || 'Plain Text']]
    }
    block[id] = { role: 'reader', value }
    return id
  })
  block[article.id] = {
    role: 'reader',
    value: {
      id: article.id,
      type: 'page',
      alive: true,
      properties: { title: [[article.title]] },
      content,
      format: { page_icon: '📘' }
    }
  }
  return {
    block: {
      [article.id]: block[article.id],
      ...block
    },
    collection: {},
    collection_view: {},
    notion_user: {},
    collection_query: {},
    signed_urls: {}
  }
}

export function applyReviewedArticleMetadata(post) {
  const article = getReviewedArticle(post?.id)
  if (!article) return post
  post.title = article.title
  post.summary = article.summary
  post.lastEditedDate = article.reviewedAt
  post.lastEditedDay = '2026-10-20'
  return post
}
