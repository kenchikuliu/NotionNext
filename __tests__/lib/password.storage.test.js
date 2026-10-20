import { getPasswordQuery, rememberArticlePassword } from '@/lib/password'

jest.mock('@/lib/utils', () => ({ isBrowser: true }))

const deny = () => { throw new DOMException('Storage unavailable', 'SecurityError') }

describe('article password candidates when storage is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(window, 'localStorage', descriptor)
    localStorage.clear()
  })

  test.each(['getter', 'methods'])('opens public articles without a blocked %s causing an exception', failure => {
    if (failure === 'getter') {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: deny })
    } else {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(deny)
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(deny)
    }
    expect(getPasswordQuery('/public-article')).toEqual([])
    expect(getPasswordQuery('/locked-article?password=test-candidate')).toEqual(['test-candidate'])
    expect(() => rememberArticlePassword('/locked-article', 'test-candidate')).not.toThrow()
  })

  test('preserves saved candidates and query priority when storage works', () => {
    localStorage.setItem('password_/article', 'article-candidate')
    localStorage.setItem('password_default', 'default-candidate')
    expect(getPasswordQuery('/article')).toEqual(['article-candidate', 'default-candidate'])
    expect(getPasswordQuery('/article?password=query-candidate')).toEqual(['query-candidate', 'article-candidate', 'query-candidate'])
    rememberArticlePassword('/another-article', 'verified-candidate')
    expect(localStorage.getItem('password_/another-article')).toBe('verified-candidate')
  })
})
