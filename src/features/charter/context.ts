import type { SessionContext } from '../../data'

// What the Context fields on New session hold, as typed [TAN-19].
export interface ContextForm {
  environment: string
  build: string
  areas: string
  testData: string
}

export const emptyContextForm: ContextForm = { environment: '', build: '', areas: '', testData: '' }

export function parseAreas(_text: string): string[] {
  return []
}

export function toSessionContext(_form: ContextForm): SessionContext {
  return { areas: [] }
}
