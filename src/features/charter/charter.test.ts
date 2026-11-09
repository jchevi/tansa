import { describe, expect, it } from 'vitest'
import { missingCharterFields, trimCharter } from './charter'

const full = { explore: 'the cart', with: 'a guest account', discover: 'pricing errors' }

describe('missingCharterFields', () => {
  it('@TAN-18 lists every empty field in form order', () => {
    expect(missingCharterFields({ explore: '', with: '', discover: '' })).toEqual([
      'explore',
      'with',
      'discover',
    ])
  })

  it.each([
    ['spaces', '   '],
    ['tabs and newlines', '\t\n \r\n'],
    ['a no-break space', ' '],
  ])('@TAN-18 a field with only %s counts as empty', (_label, blank) => {
    expect(missingCharterFields({ ...full, discover: blank })).toEqual(['discover'])
  })

  it('@TAN-18 lists only the fields still empty', () => {
    expect(missingCharterFields({ ...full, with: '', discover: '' })).toEqual(['with', 'discover'])
    expect(missingCharterFields({ ...full, explore: '' })).toEqual(['explore'])
  })

  it('@TAN-18 is empty when the charter is complete', () => {
    expect(missingCharterFields(full)).toEqual([])
  })
})

describe('trimCharter', () => {
  it('@TAN-18 trims the ends of each field and keeps inner line breaks', () => {
    expect(
      trimCharter({ explore: '  the cart  ', with: 'a guest\naccount \n', discover: '\tpricing' }),
    ).toEqual({ explore: 'the cart', with: 'a guest\naccount', discover: 'pricing' })
  })
})
