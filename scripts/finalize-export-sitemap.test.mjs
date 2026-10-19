import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanExportSitemap } from './finalize-export-sitemap.mjs'

test('preserves sitemap URLs and metadata while removing unsupported dates', () => {
  const xml = '<?xml version="1.0"?><urlset><url><loc>https://www.charliiai.com/a</loc><lastmod>2026-10-15</lastmod><priority>0.7</priority></url><url><loc>https://www.charliiai.com/b</loc><lastmod>2026-10-15</lastmod></url></urlset>'
  assert.equal(
    cleanExportSitemap(xml, 2),
    '<?xml version="1.0"?><urlset><url><loc>https://www.charliiai.com/a</loc><priority>0.7</priority></url><url><loc>https://www.charliiai.com/b</loc></url></urlset>'
  )
})

test('rejects an incomplete export after Notion errors', () => {
  assert.throws(() => cleanExportSitemap('<urlset><url><loc>https://www.charliiai.com/</loc></url></urlset>'), /only 1 valid URLs/)
})
