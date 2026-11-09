import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionInProgress } from '../shell/useSessionInProgress'
import './session.css'

// The Session screen, for now only its charter, read from storage [TAN-18]. The timer,
// End session and the rest arrive with TAN-21.
export function SessionScreen({ inProgress }: { inProgress: SessionInProgress | null }) {
  const { t } = useTranslation()
  const headingId = useId()

  return (
    <main className="shell-main session">
      <h1>{t('nav.session')}</h1>
      {inProgress && (
        <section aria-labelledby={headingId} className="session-charter">
          <h2 id={headingId} className="session-charter-title">
            {t('sbtm.charter')}
          </h2>
          <dl className="session-charter-list">
            <dt>{t('sbtm.explore')}</dt>
            <dd className="session-charter-explore">{inProgress.session.charter.explore}</dd>
            <dt>{t('sbtm.with')}</dt>
            <dd>{inProgress.session.charter.with}</dd>
            <dt>{t('sbtm.toDiscover')}</dt>
            <dd>{inProgress.session.charter.discover}</dd>
          </dl>
        </section>
      )}
    </main>
  )
}
