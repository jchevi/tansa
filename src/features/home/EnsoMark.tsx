// The TANSA mark: an open ensō with an accent dot. Decorative; the h1 names the app.
export function EnsoMark() {
  return (
    <svg aria-hidden="true" width="96" height="96" viewBox="0 0 140 140">
      <path
        d="M108 40A52 52 0 1 0 116 82"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="122" cy="58" r="7" fill="var(--color-accent)" />
    </svg>
  )
}
