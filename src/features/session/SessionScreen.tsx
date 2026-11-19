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
      {inProgress && <ContextChips session={inProgress.session} />}
    </main>
  )
}

// The context as chips [TAN-19]: each chip is a <dd>, and its field name is a <dt> read by
// screen readers but not shown, as in the mockup. One chip per area. Nothing is rendered
// for a session without context.
function ContextChips({ session }: { session: Session }) {
  const { t } = useTranslation()
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
    <section aria-label={t('context.title')} className="session-context">
      <dl className="session-context-list">
        {environment !== undefined && (
          <>
            <dt className="visually-hidden">{t('context.environment')}</dt>
            <dd className="session-chip">{environment}</dd>
          </>
        )}
        {build !== undefined && (
          <>
            <dt className="visually-hidden">{t('context.build')}</dt>
            <dd className="session-chip session-chip-build">{build}</dd>
          </>
        )}
        {areas.length > 0 && (
          <>
            <dt className="visually-hidden">{t('context.areas')}</dt>
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
            <dt className="visually-hidden">{t('context.testData')}</dt>
            <dd className="session-chip">{testData}</dd>
          </>
        )}
      </dl>
    </section>
  )
}
