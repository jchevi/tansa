import type { Charter } from '../../data'

export type CharterField = keyof Charter

// Form order: Explore, With, To discover.
export const charterFields: readonly CharterField[] = ['explore', 'with', 'discover']

// A field counts as filled only with something other than whitespace (trim() also removes
// tabs, line breaks and no-break spaces) [TAN-18].
export function missingCharterFields(charter: Charter): CharterField[] {
  return charterFields.filter((field) => charter[field].trim() === '')
}

// Stored values lose their surrounding blanks; line breaks inside a field are kept.
export function trimCharter(charter: Charter): Charter {
  return {
    explore: charter.explore.trim(),
    with: charter.with.trim(),
    discover: charter.discover.trim(),
  }
}
