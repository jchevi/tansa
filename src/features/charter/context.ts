import type { SessionContext } from '../../data'

// What the Context fields on New session hold, as typed [TAN-19].
export interface ContextForm {
  environment: string
  build: string
  areas: string
  testData: string
}

export const emptyContextForm: ContextForm = { environment: '', build: '', areas: '', testData: '' }

// "Cart, , checkout ," gives ["Cart", "checkout"]: split by commas, each part trimmed,
// empty parts dropped, typed order and duplicates kept.
export function parseAreas(text: string): string[] {
  return text
    .split(',')
    .map((area) => area.trim())
    .filter((area) => area !== '')
}

// Each value loses its surrounding blanks (line breaks inside test data are kept); a value
// left blank is not stored at all, so later screens test for the key, not for "".
export function toSessionContext(form: ContextForm): SessionContext {
  const environment = form.environment.trim()
  const build = form.build.trim()
  const testData = form.testData.trim()
  return {
    areas: parseAreas(form.areas),
    ...(environment !== '' && { environment }),
    ...(build !== '' && { build }),
    ...(testData !== '' && { testData }),
  }
}
