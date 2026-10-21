import fs from 'node:fs'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotionRenderer } from 'react-notion-x'
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
vm.runInContext(source + '\nthis.getMap=getReviewedArticleRecordMap', context)
fs.mkdirSync('review-output', { recursive: true })
for (const article of [researchSummary, knowledgeWorkflow]) {
  const map = context.getMap(article.id)
  const content = renderToStaticMarkup(
    React.createElement(NotionRenderer, {
      recordMap: map,
      fullPage: false,
      mapImageUrl: src =>
        src.includes('/images/reviewed-20261020/')
          ? '../public' + new URL(src).pathname
          : src,
      components: {
        Code: ({ block }) =>
          React.createElement(
            'pre',
            { className: 'notion-code' },
            React.createElement(
              'code',
              null,
              block.properties.title.map(x => x[0]).join('')
            )
          )
      }
    })
  ).replaceAll('href="/resources/', 'href="../public/resources/')
  const css = fs.readFileSync(
    'node_modules/react-notion-x/src/styles.css',
    'utf8'
  )
  const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${article.title}</title><style>${css}body{margin:0;background:#f6f8fa;color:#172c40;font-family:system-ui,"Microsoft YaHei",sans-serif}main{max-width:850px;margin:auto;padding:32px 20px}h1{font-size:32px;line-height:1.4}.notion{font-family:inherit}.notion-page{padding:0;width:100%}.notion-code{white-space:pre-wrap;overflow-wrap:anywhere}.notion-asset-wrapper{max-width:100%!important}.notion-asset-wrapper img{max-width:100%;height:auto}a{color:#126e85}.notion-asset-caption{font-size:13px;line-height:1.6}header{padding:16px 0;color:#126e85}</style><main><header>AI博士Charlii · charliiai.com · 文章修复预览</header><h1>${article.title}</h1>${content}</main></html>`
  fs.writeFileSync(`review-output/${article.slug.split('/').at(-1)}.html`, page)
  console.log(article.slug, content.length, 'rendered')
}
