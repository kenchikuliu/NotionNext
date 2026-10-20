import fs from 'fs'
import path from 'path'
import vm from 'vm'
import {
  initDarkMode,
  loadDarkModeFromLocalStorage,
  saveDarkModeToLocalStorage
} from '@/themes/theme'

jest.mock('@/blog.config', () => ({ APPEARANCE: 'light' }))
jest.mock('@theme-components', () => ({}), { virtual: true })
jest.mock('next/config', () => () => ({ publicRuntimeConfig: {} }))
jest.mock('@/lib/utils', () => ({ getQueryVariable: () => null }))

function denyStorageAccess() {
  throw new DOMException('Storage unavailable', 'SecurityError')
}

describe('theme when browser storage is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', descriptor)
    document.documentElement.className = ''
  })

  test.each(['getter', 'methods'])('initializes and switches theme with a blocked %s', failure => {
    if (failure === 'getter') {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: denyStorageAccess })
    } else {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(denyStorageAccess)
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(denyStorageAccess)
    }
    const update = jest.fn()
    expect(loadDarkModeFromLocalStorage()).toBeNull()
    expect(() => initDarkMode(update, 'false')).not.toThrow()
    expect(update).toHaveBeenCalledWith(false)
    expect(document.documentElement.className).toBe('light')
    expect(() => saveDarkModeToLocalStorage(true)).not.toThrow()
  })

  test('preserves the saved preference and forced dark appearance', () => {
    localStorage.setItem('darkMode', 'dark')
    const update = jest.fn()
    initDarkMode(update, 'false')
    expect(update).toHaveBeenLastCalledWith(true)
    expect(localStorage.getItem('darkMode')).toBe('true')
    localStorage.setItem('darkMode', 'false')
    initDarkMode(update, 'true')
    expect(update).toHaveBeenLastCalledWith(true)
    localStorage.clear()
  })
})

describe('document theme before hydration', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'pages/_document.js'), 'utf8')
  const template = source.match(/const darkModeScript = (`[\s\S]*?`)\n/)[1]

  test.each(['getter', 'methods'])('applies system appearance with a blocked storage %s', failure => {
    const root = { classList: { add: jest.fn() } }
    const context = vm.createContext({
      BLOG: { APPEARANCE: 'auto' },
      DOMException,
      document: { documentElement: root },
      window: { matchMedia: () => ({ matches: true }) }
    })
    if (failure === 'getter') {
      vm.runInContext("Object.defineProperty(globalThis, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError') } })", context)
    } else {
      context.localStorage = { getItem: denyStorageAccess }
    }
    const script = vm.runInContext(template, context)
    expect(() => vm.runInContext(script, context)).not.toThrow()
    expect(root.classList.add).toHaveBeenCalledWith('dark')
  })
})
