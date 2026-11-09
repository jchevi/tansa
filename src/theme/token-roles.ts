// Every --color-* token has a role. The contrast test measures the pairs below, and
// token-roles.test.ts fails if a token in tokens.css isn't listed here.

type Pair = readonly [foreground: string, background: string]

// Token pairs used for text: WCAG AA, 4.5:1.
export const textPairs: readonly Pair[] = [
  ['--color-ink', '--color-bg'],
  ['--color-ink', '--color-surface'],
  ['--color-ink', '--color-card'],
  ['--color-muted', '--color-bg'],
  ['--color-muted', '--color-surface'],
  ['--color-muted', '--color-card'],
  ['--color-accent-strong', '--color-bg'],
  ['--color-accent-strong', '--color-card'],
  ['--color-on-primary', '--color-primary'],
  ['--color-on-accent', '--color-accent'],
  ['--color-ink', '--color-note-bg'],
  ['--color-ink', '--color-bug-bg'],
  ['--color-ink', '--color-issue-bg'],
]

// Non-text UI that must be seen: WCAG 1.4.11, 3:1. The focus ring uses --color-primary;
// input borders use --color-muted [TAN-18].
export const nonTextPairs: readonly Pair[] = [
  ['--color-primary', '--color-bg'],
  ['--color-primary', '--color-surface'],
  ['--color-primary', '--color-card'],
  ['--color-muted', '--color-bg'],
  ['--color-muted', '--color-card'],
]

// Never text, and never the only way to tell things apart: buttons carry text, tags and
// status carry a label. --color-hair only outlines cards: an input's boundary is its
// --color-muted border, checked above [TAN-18].
export const decorative: readonly string[] = [
  '--color-hair',
  '--color-accent',
  '--color-note',
  '--color-bug',
  '--color-issue',
]
