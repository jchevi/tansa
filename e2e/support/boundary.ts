import { expect, type Locator } from '@playwright/test'
import { contrastRatio, hexToRgb } from '../../src/theme/contrast.ts'
import { compositeToHex, parseCssColor, type Rgba } from './color.ts'

// Paints the backgrounds from `start` up to the first opaque one, bottom first, and
// returns the color seen there. A translucent tint (color-mix) is composited over what is
// behind it, as the browser paints it [TAN-20].
function seenColor(layers: Rgba[], start: number): Rgba {
  const opaque = layers.findIndex((layer, index) => index >= start && layer.a === 1)
  if (opaque === -1) throw new Error('No opaque background behind the element')
  let seen = layers[opaque] as Rgba
  for (let index = opaque - 1; index >= start; index--) {
    seen = { ...hexToRgb(compositeToHex(layers[index] as Rgba, seen)), a: 1 }
  }
  return seen
}

// A field's border must stand out at 3:1 (WCAG 1.4.11) against what is painted on both
// sides of it: the element's own background (inside) and its parent's (outside). TAN-18
// fields have the card on both sides; TAN-19 context fields have the card inside and the
// page background outside; a TAN-20 duration pill can have a translucent tint inside
// [TAN-18, TAN-19, TAN-20].
export async function expectVisibleBoundary(field: Locator): Promise<void> {
  const style = await field.evaluate((element) => {
    const layers: string[] = []
    for (let node: Element | null = element; node; node = node.parentElement) {
      layers.push(getComputedStyle(node).backgroundColor)
    }
    return {
      border: getComputedStyle(element).borderTopColor,
      width: parseFloat(getComputedStyle(element).borderTopWidth),
      layers,
    }
  })
  const layers = style.layers.map(parseCssColor)
  const inside = seenColor(layers, 0)
  const outside = seenColor(layers, 1)
  expect(style.width).toBeGreaterThanOrEqual(1)
  for (const behind of [inside, outside]) {
    const border = compositeToHex(parseCssColor(style.border), behind)
    expect(contrastRatio(border, compositeToHex(behind, behind))).toBeGreaterThanOrEqual(3)
  }
}
