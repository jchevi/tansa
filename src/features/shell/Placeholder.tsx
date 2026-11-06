import { useTranslation } from 'react-i18next'

export type PlaceholderTitle = 'nav.newSession' | 'nav.session' | 'nav.history' | 'nav.settings'

// A screen that is not built yet: its title only. TAN-18 (New session), TAN-21 (Session)
// and TAN-16 (History) replace these; Settings stays empty until v0.2.
export function Placeholder({ title }: { title: PlaceholderTitle }) {
  const { t } = useTranslation()
  return (
    <main className="shell-main">
      <h1>{t(title)}</h1>
    </main>
  )
}
