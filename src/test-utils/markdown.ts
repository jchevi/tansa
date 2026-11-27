// Markdown helpers shared by the workflow tests, so each file does not keep its own copy
// that can drift apart [TAN-110].

// Every `key: value` field of the frontmatter block between the first two `---` lines.
export function frontmatter(markdown: string): Record<string, string> {
  const [first, ...rest] = markdown.split(/\r?\n/)
  if (first !== '---') throw new Error('Frontmatter not found')
  const end = rest.indexOf('---')
  if (end === -1) throw new Error('Unclosed frontmatter')
  const fields: Record<string, string> = {}
  for (const line of rest.slice(0, end)) {
    const match = /^([a-zA-Z-]+):\s*(.*)$/.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) fields[match[1]] = match[2].trim()
  }
  return fields
}

// The lines of a text, for LF or CRLF files [TAN-111].
export const lines = (text: string) => text.split(/\r?\n/)

// The text of one "## " section, so a phrase found elsewhere in the file doesn't count.
// A missing heading fails with its name [TAN-111].
export function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n## ${heading}\n`)
  if (start === -1) throw new Error(`Section "## ${heading}" not found`)
  const end = markdown.indexOf('\n## ', start + 1)
  return markdown.slice(start, end === -1 ? undefined : end)
}

// One field, read through frontmatter(); a missing field fails with its name [TAN-105].
export function frontmatterField(markdown: string, key: string): string {
  const value = frontmatter(markdown)[key]
  if (value === undefined) throw new Error(`Frontmatter field "${key}" not found`)
  return value
}
