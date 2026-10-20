import { fireEvent, render, screen } from '@testing-library/react'
import InteractionAnalytics from '@/components/InteractionAnalytics'

jest.mock('@/lib/global', () => ({
  useGlobal: () => ({ isLoaded: true, isSignedIn: false, user: null })
}))
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/' }) }))

function denyStorageAccess() {
  throw new DOMException('Storage unavailable', 'SecurityError')
}

describe('interaction analytics with unavailable browser storage', () => {
  const descriptors = Object.fromEntries(
    ['localStorage', 'sessionStorage'].map(name => [name, Object.getOwnPropertyDescriptor(window, name)])
  )

  beforeEach(() => {
    window.__NEXT_DATA__ = { nextExport: true }
    window.dataLayer = []
    window.gtag = jest.fn()
    window.fetch = jest.fn(() => Promise.reject(new Error('Network disabled in test')))
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    for (const [name, descriptor] of Object.entries(descriptors)) {
      Object.defineProperty(window, name, descriptor)
    }
    window.localStorage.clear()
    window.sessionStorage.clear()
    delete window.__NEXT_DATA__
    delete window.gtag
  })

  test.each(['localStorage', 'sessionStorage', 'methods'])('keeps the page usable when %s throws', failure => {
    if (failure === 'methods') {
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        jest.spyOn(Storage.prototype, method).mockImplementation(denyStorageAccess)
      }
    } else {
      Object.defineProperty(window, failure, { configurable: true, get: denyStorageAccess })
    }
    expect(() => render(<><InteractionAnalytics /><button>Browse prompts</button></>)).not.toThrow()
    expect(screen.getByRole('button', { name: 'Browse prompts' })).toBeVisible()
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
    expect(window.fetch).not.toHaveBeenCalled()
    jest.restoreAllMocks()
  })

  test('keeps route events deduplicated when storage works', () => {
    const first = render(<InteractionAnalytics />)
    first.unmount()
    render(<InteractionAnalytics />)
    expect(window.gtag.mock.calls.filter(args => args[0] === 'event' && args[1] === 'home_viewed')).toHaveLength(1)
  })
})
