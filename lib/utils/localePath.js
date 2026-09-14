import BLOG from '@/blog.config'

export const DEFAULT_LOCALE = BLOG.LANG || 'zh-CN'
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US']

const LOCALE_PREFIX_REGEX = /^\/([a-z]{2}(?:-[A-Za-z]{2})?)(?=\/|$)/

export function inferLocaleFromPath(path, fallback = DEFAULT_LOCALE) {
  const pathname = String(path || '').split(/[?#]/, 1)[0]
  const match = pathname.match(LOCALE_PREFIX_REGEX)
  return SUPPORTED_LOCALES.includes(match?.[1]) ? match[1] : fallback
}
