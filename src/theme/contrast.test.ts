import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToRgb } from './contrast.ts'
import { parseColorTokens } from './read-tokens.ts'
import { nonTextPairs, textPairs } from './token-roles.ts'

const tokens = parseColorTokens(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'))
const valueOf = (name: string) => {
  const value = tokens.get(name)
  if (!value) throw new Error(`${name} is not defined in tokens.css`)
  return value
}

// Known answers first: trust the meter before trusting the measurement.
describe('contrast formula', () => {
  it('@TAN-12 black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2)
  })

  it('@TAN-12 a color on itself is 1:1', () => {
    expect(contrastRatio('#262D3A', '#262D3A')).toBe(1)
  })

  it('@TAN-12 order of the pair does not matter', () => {
    expect(contrastRatio('#FFFFFF', '#767676')).toBe(contrastRatio('#767676', '#FFFFFF'))
  })

  it('@TAN-12 #767676 on white passes AA and #777777 does not', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2)
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2)
  })

  it('@TAN-12 hexToRgb rejects anything but #RRGGBB', () => {
    expect(hexToRgb('#E9673A')).toEqual({ r: 233, g: 103, b: 58 })
    expect(() => hexToRgb('#FFF')).toThrow()
    expect(() => hexToRgb('#E9673A80')).toThrow()
  })
})

describe('token contrast', () => {
  it.each(textPairs)('@TAN-12 text %s on %s meets WCAG AA (4.5:1)', (foreground, background) => {
    expect(contrastRatio(valueOf(foreground), valueOf(background))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(nonTextPairs)(
    '@TAN-12 non-text %s on %s meets WCAG 1.4.11 (3:1)',
    (foreground, background) => {
      expect(contrastRatio(valueOf(foreground), valueOf(background))).toBeGreaterThanOrEqual(3)
    },
  )
})
