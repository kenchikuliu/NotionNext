describe('robots policy', () => {
  test('disallows low-value search and listing routes', () => {
    const config = require('@/next-sitemap.config')
    const disallowPolicy = config.robotsTxtOptions.policies.find(
      policy => Array.isArray(policy.disallow) && policy.disallow.length > 0
    )

    expect(disallowPolicy).toBeDefined()
    expect(disallowPolicy.disallow).toEqual(
      expect.arrayContaining([
        '/search',
        '/search/*',
        '/category/*/page/*',
        '/tag/*/page/*',
        '/page/*'
      ])
    )
  })
})
