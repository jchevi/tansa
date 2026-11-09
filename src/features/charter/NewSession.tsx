import { useId, useState, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionInProgressError, startSession, type Charter, type TansaDb } from '../../data'
import { Link } from '../shell/Link'
import { navigate } from '../shell/router'
import { routes } from '../shell/routes'
import { charterFields, missingCharterFields, trimCharter, type CharterField } from './charter'
import './charter.css'

type StartState = 'idle' | 'starting' | 'failed'

const emptyCharter: Charter = { explore: '', with: '', discover: '' }

// The i18n keys of each field: the SBTM label (never translated), the hint and the
// fictional example shown as a placeholder.
const fieldText = {
  explore: {
    label: 'sbtm.explore',
    hint: 'charter.exploreHint',
    example: 'charter.exploreExample',
  },
  with: { label: 'sbtm.with', hint: 'charter.withHint', example: 'charter.withExample' },
  discover: {
    label: 'sbtm.toDiscover',
    hint: 'charter.discoverHint',
    example: 'charter.discoverExample',
  },
} as const

// New session (spec R1, US-01): the charter form. With a session already in progress it
// shows a notice instead, so only one session runs at a time [TAN-18].
export function NewSession({
  db,
  hasSessionInProgress,
  onSessionInProgress,
}: {
  db: TansaDb
  hasSessionInProgress: boolean
  onSessionInProgress: () => void
}) {
  const { t } = useTranslation()

  return (
    <main className="shell-main charter">
      <div className="charter-intro">
        <h1 className="charter-eyebrow">{t('nav.newSession')}</h1>
        <p className="charter-lead">{t('charter.lead')}</p>
      </div>
      {hasSessionInProgress ? (
        <InProgressNotice />
      ) : (
        <CharterForm db={db} onSessionInProgress={onSessionInProgress} />
      )}
    </main>
  )
}

function InProgressNotice() {
  const { t } = useTranslation()
  return (
    <div className="charter-notice">
      <p>{t('charter.inProgress')}</p>
      <Link href={routes.session} className="charter-start">
        {t('home.resume')}
        <span aria-hidden="true"> →</span>
      </Link>
    </div>
  )
}

function CharterForm({
  db,
  onSessionInProgress,
}: {
  db: TansaDb
  onSessionInProgress: () => void
}) {
  const { t, i18n } = useTranslation()
  const [charter, setCharter] = useState<Charter>(emptyCharter)
  const [start, setStart] = useState<StartState>('idle')
  const id = useId()
  const statusId = `${id}-status`

  const missing = missingCharterFields(charter)
  const names = new Intl.ListFormat(i18n.language, { type: 'unit' }).format(
    missing.map((field) => t(fieldText[field].label)),
  )
  const statusText =
    missing.length === 0 ? t('charter.complete') : t('charter.missing', { fields: names })

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    // Enter or a stale render must never start an incomplete charter, or start twice.
    if (missingCharterFields(charter).length > 0 || start === 'starting') return
    setStart('starting')
    try {
      await startSession(db, trimCharter(charter))
      navigate(routes.session)
    } catch (error) {
      if (error instanceof SessionInProgressError) {
        // Another tab started one after this form opened: show the notice instead.
        onSessionInProgress()
        return
      }
      console.error(error)
      setStart('failed')
    }
  }

  function update(field: CharterField, value: string) {
    setCharter((current) => ({ ...current, [field]: value }))
  }

  return (
    <form
      className="charter-form"
      aria-label={t('sbtm.charter')}
      onSubmit={(event) => void submit(event)}
    >
      <div className="charter-fields">
        {charterFields.map((field) => {
          const fieldId = `${id}-${field}`
          return (
            <div key={field} className={`charter-card charter-card-${field}`}>
              <label htmlFor={fieldId} className="charter-label">
                {t(fieldText[field].label)}{' '}
                <span className="charter-hint">· {t(fieldText[field].hint)}</span>
              </label>
              <textarea
                id={fieldId}
                className="charter-input"
                rows={field === 'explore' ? 1 : 2}
                value={charter[field]}
                placeholder={t(fieldText[field].example)}
                onChange={(event) => {
                  update(field, event.target.value)
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="charter-footer">
        {start === 'failed' && (
          <p role="alert" className="charter-error">
            {t('charter.startFailed')}
          </p>
        )}
        <p id={statusId} role="status" className="charter-status">
          {statusText}
        </p>
        <button
          type="submit"
          className="charter-start"
          disabled={missing.length > 0 || start === 'starting'}
          aria-describedby={statusId}
        >
          {t('charter.start')}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </form>
  )
}
