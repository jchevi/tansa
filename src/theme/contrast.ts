// WCAG 2.x contrast: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

export interface Rgb {
  r: number
  g: number
  b: number
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex)
  if (!match) throw new Error(`Expected a #RRGGBB color, got "${hex}"`)
  const [, r = '', g = '', b = ''] = match
  return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) }
}

// sRGB channel (0–255) to linear light.
function linear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (light + 0.05) / (dark + 0.05)
}
