import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIN_EXPECTED_URLS = 300

export function cleanExportSitemap(xml, minimumUrls = MIN_EXPECTED_URLS) {
  const urls = xml.match(/<url>[\s\S]*?<\/url>/g) || []
  const locations = urls.map(block => block.match(/<loc>([^<]+)<\/loc>/)?.[1])
  if (!xml.includes('<urlset') || !xml.includes('</urlset>')) {
    throw new Error('Export sitemap is not a urlset')
  }
  if (urls.length < minimumUrls || locations.some(loc => !loc)) {
    throw new Error(`Export sitemap has only ${urls.length} valid URLs; expected at least ${minimumUrls}`)
  }
  if (new Set(locations).size !== locations.length) {
    throw new Error('Export sitemap has duplicate URLs')
  }
  return xml.replace(/\s*<lastmod>[^<]*<\/lastmod>/g, '')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(process.cwd(), 'out', 'sitemap.xml')
  const original = fs.readFileSync(file, 'utf8')
  const cleaned = cleanExportSitemap(original)
  fs.writeFileSync(file, cleaned)
  console.log(`[sitemap] verified ${original.match(/<url>/g)?.length || 0} exported URLs and removed unsupported lastmod values`)
}
