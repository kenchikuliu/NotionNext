import { fireEvent, render, screen } from '@testing-library/react'
import md5 from 'js-md5'
import Article from '@/pages/[prefix]/index'

jest.mock('@/blog.config', () => ({ THEME: 'heo' }))
jest.mock('@/lib/global', () => {
  const state = { locale: { COMMON: { ARTICLE_UNLOCK_TIPS: 'Unlocked' } } }
  return { useGlobal: () => state }
})
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/locked-article' }) }))
jest.mock('@/lib/config', () => ({ siteConfig: () => 'heo' }))
jest.mock('@/lib/db/getSiteData', () => ({}))
jest.mock('@/lib/cache/revalidate', () => ({}))
jest.mock('@/lib/utils/post', () => ({}))
jest.mock('@/lib/utils', () => ({ isBrowser: true }))
jest.mock('notion-utils', () => ({}))
jest.mock('@/components/Notification', () => {
  const notification = { showNotification: jest.fn(), Notification: () => null }
  return () => notification
})
jest.mock('@/themes/theme', () => {
  const { useState } = require('react')
  return {
    DynamicLayout: function TestArticleLayout({ lock, validPassword }) {
      const [result, setResult] = useState('')
      const attempt = async value => setResult(await validPassword(value) ? 'Accepted' : 'Rejected')
      return <>
        <p>{lock ? 'Article locked' : 'Article readable'}</p>
        <p>{result}</p>
        <button onClick={() => void attempt('incorrect-candidate')}>Wrong password</button>
        <button onClick={() => void attempt('correct-candidate')}>Correct password</button>
      </>
    }
  }
})

test('keeps password validation effective and can unlock without persistent storage', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Storage unavailable', 'SecurityError') }
  })
  try {
    render(<Article post={{ slug: 'locked-article', password: md5('locked-articlecorrect-candidate') }} />)
    expect(screen.getByText('Article locked')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Wrong password' }))
    expect(await screen.findByText('Rejected')).toBeVisible()
    expect(screen.getByText('Article locked')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Correct password' }))
    expect(await screen.findByText('Accepted')).toBeVisible()
    expect(await screen.findByText('Article readable')).toBeVisible()
  } finally {
    Object.defineProperty(window, 'localStorage', descriptor)
  }
})
