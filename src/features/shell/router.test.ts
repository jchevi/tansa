import { describe, expect, it } from 'vitest'
import { isPlainLeftClick, type ClickLike } from './router'
import { matchRoute } from './routes'

const plain: ClickLike = {
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
}

describe('isPlainLeftClick', () => {
  it('@TAN-17 a plain left click is handled by the app', () => {
    expect(isPlainLeftClick(plain, null)).toBe(true)
    expect(isPlainLeftClick(plain, '_self')).toBe(true)
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['the middle button', { button: 1 }],
    ['an already handled click', { defaultPrevented: true }],
  ])('@TAN-17 a click with %s is left to the browser', (_label, change) => {
    expect(isPlainLeftClick({ ...plain, ...change }, null)).toBe(false)
  })

  it('@TAN-17 a link that opens in another tab is left to the browser', () => {
    expect(isPlainLeftClick(plain, '_blank')).toBe(false)
  })
})

describe('matchRoute', () => {
  it.each([
    ['/', 'home'],
    ['/new', 'newSession'],
    ['/session', 'session'],
    ['/history', 'history'],
    ['/settings', 'settings'],
    ['/history/', 'history'],
  ] as const)('@TAN-17 %s is the %s screen', (path, route) => {
    expect(matchRoute(path)).toBe(route)
  })

  it('@TAN-17 an unknown path is Home', () => {
    expect(matchRoute('/nope')).toBe('home')
    expect(matchRoute('/history/abc')).toBe('home')
  })
})
