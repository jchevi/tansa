import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '../../data'
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
      {inProgress && <ContextDetails session={inProgress.session} />}
    </main>
  )
}

// The context [TAN-19], under the charter: each value under its visible name. Areas are
// chips, one per area; environment, build and test data are text, because they can be long
// (a URL, several lines of test data) and a chip is for a short tag. Nothing is rendered
// for a session without context.
function ContextDetails({ session }: { session: Session }) {
  const { t } = useTranslation()
  const headingId = useId()
  const { environment, build, areas, testData } = session
  if (
    environment === undefined &&
    build === undefined &&
    areas.length === 0 &&
    testData === undefined
  ) {
    return null
  }

  return (
    <section aria-labelledby={headingId} className="session-context">
      <h2 id={headingId} className="session-charter-title">
        {t('context.title')}
      </h2>
      <dl className="session-context-list">
        {environment !== undefined && (
          <>
            <dt>{t('context.environment')}</dt>
            <dd className="session-context-text">{environment}</dd>
          </>
        )}
        {build !== undefined && (
          <>
            <dt>{t('context.build')}</dt>
            <dd className="session-context-text session-context-build">{build}</dd>
          </>
        )}
        {areas.length > 0 && (
          <>
            <dt>{t('context.areas')}</dt>
            {areas.map((area, index) => (
              // Areas may repeat, so the index keeps the keys unique.
              <dd key={`${String(index)}-${area}`} className="session-chip">
                {area}
              </dd>
            ))}
          </>
        )}
        {testData !== undefined && (
          <>
            <dt>{t('context.testData')}</dt>
            <dd className="session-context-text">{testData}</dd>
          </>
        )}
      </dl>
    </section>
  )
}
