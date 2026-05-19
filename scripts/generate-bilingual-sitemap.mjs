import fs from 'fs'
import path from 'path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const DEFAULT_LOCALE = 'zh-CN'
const LOCALE_PREFIXES = {
  'zh-CN': '',
  'en-US': '/en-US'
}

const UUID_LIKE_SLUG =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTION_ID_LIKE_SLUG = /^[0-9a-z]{32}$/i
const KNOWN_BROKEN_SLUGS = new Set([
  'aboutme',
  'basicai',
  '干货分享/zotero-arxiv-daily',
  'article/ai-agent-programming-2026',
  'article/deepseekai',
  'article/googlevids',
  'article/3dgs',
  'article/effortless',
  'article/napkinai',
  'article/mi-gpt',
  'article/pygwalker',
  'article/openai-sora-shutdown-10yi-lesson'
])

function normalizeSiteUrl(value) {
  return String(value || 'https://www.charliiai.com').replace(/\/+$/, '')
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeSlug(slug) {
  if (typeof slug !== 'string') return ''
  return slug.trim().replace(/^\/+|\/+$/g, '')
}

function shouldIncludeSlug(rawSlug) {
  const normalizedSlug = normalizeSlug(rawSlug).toLowerCase()
  if (!normalizedSlug) return false
  if (/^https?:\/\//i.test(normalizedSlug)) return false
  if (normalizedSlug === '#' || normalizedSlug === '/#') return false
  if (normalizedSlug === 'article') return false
  if (normalizedSlug.includes(' ')) return false
  if (normalizedSlug.includes('/http:') || normalizedSlug.includes('/https:')) {
    return false
  }
  if (KNOWN_BROKEN_SLUGS.has(normalizedSlug)) return false

  const tail = normalizedSlug.split('/').pop()
  if (!tail) return false
  if (NOTION_ID_LIKE_SLUG.test(tail)) return false
  if (UUID_LIKE_SLUG.test(tail)) return false
  return true
}

function toIsoDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0]
  }
  return date.toISOString().split('T')[0]
}

function readContext(locale) {
  const filePath = path.join(PUBLIC_DIR, `site-context.${locale}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readExistingSitemapUrls(filePath) {
  if (!fs.existsSync(filePath)) return []
  const xml = fs.readFileSync(filePath, 'utf8')
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || []
  return blocks
    .map(block => ({
      loc: block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1],
      lastmod: block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1],
      changefreq: block.match(/<changefreq>([\s\S]*?)<\/changefreq>/)?.[1],
      priority: block.match(/<priority>([\s\S]*?)<\/priority>/)?.[1]
    }))
    .filter(url => url.loc)
}

function addUrl(map, url) {
  if (!url?.loc) return
  const existing = map.get(url.loc)
  if (!existing || new Date(url.lastmod) > new Date(existing.lastmod)) {
    map.set(url.loc, url)
  }
}

function addStaticRoutes(map, siteUrl, locale) {
  const prefix = LOCALE_PREFIXES[locale] ?? ''
  const today = new Date().toISOString().split('T')[0]
  const routes = [
    ['', 'daily', 1.0],
    ['archive', 'weekly', 0.5],
    ['about', 'monthly', 0.4],
    ['contact', 'monthly', 0.4],
    ['privacy-policy', 'monthly', 0.3],
    ['terms-of-service', 'monthly', 0.3],
    ['category', 'daily', 0.7],
    ['tag', 'daily', 0.7]
  ]

  routes.forEach(([route, changefreq, priority]) => {
    const pathPart = route ? `${prefix}/${route}` : prefix
    addUrl(map, {
      loc: `${siteUrl}${pathPart || ''}`,
      lastmod: today,
      changefreq,
      priority
    })
  })
}

function addContextPages(map, context, siteUrl, locale) {
  const prefix = LOCALE_PREFIXES[locale] ?? ''
  const publishedStatus =
    context?.NOTION_CONFIG?.NOTION_PROPERTY_NAME?.status_publish || 'Published'

  ;(context?.allPages || []).forEach(page => {
    if (page?.status !== publishedStatus) return
    const type = String(page?.type || '')
    if (!['Post', 'Page'].includes(type)) return
    if (!shouldIncludeSlug(page?.slug)) return

    addUrl(map, {
      loc: `${siteUrl}${prefix}/${normalizeSlug(page.slug)}`,
      lastmod: toIsoDate(page?.lastEditedDay || page?.publishDay),
      changefreq: type === 'Page' ? 'weekly' : 'daily',
      priority: type === 'Page' ? 0.6 : 0.8
    })
  })
}

function buildXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
    xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${escapeXml(url.lastmod)}</lastmod>
    <changefreq>${escapeXml(url.changefreq || 'daily')}</changefreq>
    <priority>${escapeXml(url.priority ?? 0.7)}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`
}

function main() {
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml')
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_LINK)
  const map = new Map()

  readExistingSitemapUrls(sitemapPath).forEach(url => addUrl(map, url))

  for (const locale of Object.keys(LOCALE_PREFIXES)) {
    const context = readContext(locale)
    if (!context) continue
    addStaticRoutes(map, siteUrl, locale)
    addContextPages(map, context, siteUrl, locale)
  }

  const urls = Array.from(map.values()).sort((a, b) => a.loc.localeCompare(b.loc))
  const xml = buildXml(urls)
  fs.writeFileSync(sitemapPath, xml)
  fs.writeFileSync(path.join(process.cwd(), 'sitemap.xml'), xml)
  console.log(`[sitemap] wrote ${urls.length} URLs with localized routes`)

  if (!urls.some(url => url.loc.includes('/en-US/'))) {
    console.warn('[sitemap] warning: no localized en-US URLs were generated')
  }
}

main()
