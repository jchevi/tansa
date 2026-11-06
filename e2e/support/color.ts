// Parses the computed colors Chrome reports: rgb()/rgba(), and color(srgb r g b / a), the
// form it uses for color-mix(). Anything else throws, so a format change can't be read
// silently as opaque or transparent [TAN-17].

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
const SRGB = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/

function alpha(raw: string | undefined): number {
  if (raw === undefined) return 1
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw)
}

export function parseCssColor(value: string): Rgba {
  const rgb = RGB.exec(value.trim())
  if (rgb) {
    const [, r = '', g = '', b = '', a] = rgb
    return { r: parseFloat(r), g: parseFloat(g), b: parseFloat(b), a: alpha(a) }
  }
  const srgb = SRGB.exec(value.trim())
  if (srgb) {
    const [, r = '', g = '', b = '', a] = srgb
    return {
      r: parseFloat(r) * 255,
      g: parseFloat(g) * 255,
      b: parseFloat(b) * 255,
      a: alpha(a),
    }
  }
  throw new Error(`Unsupported computed color "${value}"`)
}

// Paints a translucent color over an opaque one and returns #RRGGBB.
export function compositeToHex(top: Rgba, bottom: Rgba): string {
  if (bottom.a !== 1) throw new Error('The bottom color must be opaque')
  const channel = (t: number, b: number) =>
    Math.round(t * top.a + b * (1 - top.a))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(top.r, bottom.r)}${channel(top.g, bottom.g)}${channel(top.b, bottom.b)}`
}
