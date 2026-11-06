import { useTranslation } from 'react-i18next'

export type PlaceholderTitle = 'nav.history' | 'nav.settings'

// A screen that is not built yet: its title only. TAN-16 (History) replaces it; Settings
// stays empty until v0.2.
export function Placeholder({ title }: { title: PlaceholderTitle }) {
  const { t } = useTranslation()
  return (
    <main className="shell-main">
      <h1>{t(title)}</h1>
    </main>
  )
}
