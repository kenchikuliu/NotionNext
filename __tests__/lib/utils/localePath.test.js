import { inferLocaleFromPath } from '@/lib/utils/localePath'

describe('inferLocaleFromPath', () => {
  test('uses a supported path prefix and otherwise keeps the fallback', () => {
    expect(inferLocaleFromPath('/en-US/contact?ref=footer')).toBe('en-US')
    expect(inferLocaleFromPath('/contact', 'zh-CN')).toBe('zh-CN')
    expect(inferLocaleFromPath('/fr-FR/contact', 'zh-CN')).toBe('zh-CN')
  })
})
