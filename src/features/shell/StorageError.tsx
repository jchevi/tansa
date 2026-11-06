import { useTranslation } from 'react-i18next'

// Shown instead of a blank page when the local database cannot be used.
export function StorageError() {
  const { t } = useTranslation()
  return (
    <main className="shell-main">
      <p role="alert">{t('errors.storage')}</p>
    </main>
  )
}
