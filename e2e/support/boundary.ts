import { expect, type Locator } from '@playwright/test'
import { contrastRatio } from '../../src/theme/contrast.ts'
import { compositeToHex, parseCssColor } from './color.ts'

// A field's border must stand out at 3:1 against what is painted behind it (WCAG 1.4.11):
// the first ancestor, or the field itself, with a painted background [TAN-18, TAN-19].
export async function expectVisibleBoundary(field: Locator): Promise<void> {
  const colors = await field.evaluate((element) => {
    let behind: Element | null = element
    while (behind) {
      const background = getComputedStyle(behind).backgroundColor
      if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
        return {
          border: getComputedStyle(element).borderTopColor,
          width: parseFloat(getComputedStyle(element).borderTopWidth),
          behind: background,
        }
      }
      behind = behind.parentElement
    }
    throw new Error('No painted background behind the field')
  })
  const behind = parseCssColor(colors.behind)
  expect(behind.a).toBe(1)
  const border = compositeToHex(parseCssColor(colors.border), behind)
  expect(colors.width).toBeGreaterThanOrEqual(1)
  expect(contrastRatio(border, compositeToHex(behind, behind))).toBeGreaterThanOrEqual(3)
}
