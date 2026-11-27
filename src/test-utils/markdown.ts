// Stub so the TAN-110 tests load and fail on their own assertions [TAN-110].
export function frontmatter(markdown: string): Record<string, string> {
  throw new Error(`not implemented: ${markdown}`)
}

export function frontmatterField(markdown: string, key: string): string {
  throw new Error(`not implemented: ${key} in ${markdown}`)
}
