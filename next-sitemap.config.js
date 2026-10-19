const BLOG = require('./blog.config')

/**
 * 通常没啥用，sitemap交给 /pages/sitemap.xml.js 动态生成
 */
module.exports = {
  siteUrl: BLOG.LINK,
  changefreq: 'daily',
  priority: 0.7,
  // The export build has no per-page edit dates. Avoid reporting build time as content updates.
  autoLastmod: false,
  generateRobotsTxt: true,
  sitemapSize: 7000,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/search',
          '/search/*',
          '/tag/*/page/*',
          '/category/*/page/*',
          '/page/*'
        ]
      }
    ]
  }
  // ...other options
  // https://github.com/iamvishnusankar/next-sitemap#configuration-options
}
