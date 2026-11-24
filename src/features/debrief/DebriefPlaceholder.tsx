import { useTranslation } from 'react-i18next'
import { Link } from '../shell/Link'
import { routes } from '../shell/routes'

// Shown after End session until the PROOF debrief exists (TAN-4, v0.3, replaces this
// screen) [TAN-21]. It holds no session data. PROOF comes from the pinned SBTM key.
export function DebriefPlaceholder() {
  const { t } = useTranslation()
  return (
    <main className="shell-main">
      <h1>{t('nav.debrief')}</h1>
      <p>{t('debrief.comingSoon', { proof: t('sbtm.proof') })}</p>
      <Link href={routes.home}>{t('debrief.backHome')}</Link>
    </main>
  )
}
