import { describe, expect, it } from 'vitest'
import { emptyContextForm, parseAreas, toSessionContext } from './context'

describe('parseAreas', () => {
  it('@TAN-19 splits by commas, trims each part and drops the empty ones', () => {
    expect(parseAreas('Cart, , checkout ,')).toEqual(['Cart', 'checkout'])
  })

  it.each([
    ['nothing', ''],
    ['only commas and spaces', ' , , '],
  ])('@TAN-19 %s gives no areas', (_label, text) => {
    expect(parseAreas(text)).toEqual([])
  })

  it('@TAN-19 a single area needs no comma', () => {
    expect(parseAreas('Cart')).toEqual(['Cart'])
  })

  it('@TAN-19 keeps spaces inside an area', () => {
    expect(parseAreas('gift cards, saved addresses')).toEqual(['gift cards', 'saved addresses'])
  })

  it('@TAN-19 trims tabs and no-break spaces', () => {
    expect(parseAreas('\tCart , checkout\t')).toEqual(['Cart', 'checkout'])
  })

  it('@TAN-19 keeps duplicates and the typed order', () => {
    expect(parseAreas('checkout, Cart, cart')).toEqual(['checkout', 'Cart', 'cart'])
  })
})

describe('toSessionContext', () => {
  it('@TAN-19 an empty form gives only an empty area list', () => {
    expect(toSessionContext(emptyContextForm)).toEqual({ areas: [] })
  })

  it('@TAN-19 trims every value', () => {
    expect(
      toSessionContext({
        environment: '  Staging ',
        build: ' 1.4.2\t',
        areas: ' Cart ',
        testData: '\n qa+01@example.com  ',
      }),
    ).toEqual({
      environment: 'Staging',
      build: '1.4.2',
      areas: ['Cart'],
      testData: 'qa+01@example.com',
    })
  })

  it('@TAN-19 leaves out blank and whitespace-only values', () => {
    const context = toSessionContext({
      environment: '   ',
      build: '',
      areas: ' , ',
      testData: '\n\t ',
    })

    expect(context).not.toHaveProperty('environment')
    expect(context).not.toHaveProperty('build')
    expect(context).not.toHaveProperty('testData')
    expect(context.areas).toEqual([])
  })

  it('@TAN-19 keeps line breaks inside test data', () => {
    expect(
      toSessionContext({ ...emptyContextForm, testData: 'qa+01@example.com\ncodes WELCOME10' })
        .testData,
    ).toBe('qa+01@example.com\ncodes WELCOME10')
  })
})
