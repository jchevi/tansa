import { useId, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_TARGET_MINUTES,
  SessionInProgressError,
  startSession,
  TARGET_MINUTE_OPTIONS,
  type Charter,
  type TansaDb,
  type TargetMinutes,
} from '../../data'
import { Link } from '../shell/Link'
import { navigate } from '../shell/router'
import { routes } from '../shell/routes'
import { charterFields, missingCharterFields, trimCharter, type CharterField } from './charter'
import { emptyContextForm, toSessionContext, type ContextForm } from './context'
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

// In a form, Enter in a one-line field or on a radio submits it. Typing "Staging" and
// Enter, or Enter while choosing 90 min, would start the session and its time, so the
// one-line context fields and the duration radios swallow Enter; the button and the
// textareas keep theirs. Not while an IME is composing: there Enter confirms the text
// [TAN-19, TAN-20].
function keepEnterFromSubmitting(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault()
}

// New session (spec R1, US-01, US-02): the charter form and its optional context. With a session already in progress it
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
  // Examples start with "e.g." so an empty field is never read as a filled one [TAN-19].
  const example = (text: string) => t('field.example', { example: text })
  const [charter, setCharter] = useState<Charter>(emptyCharter)
  const [context, setContext] = useState<ContextForm>(emptyContextForm)
  const [targetMinutes, setTargetMinutes] = useState<TargetMinutes>(DEFAULT_TARGET_MINUTES)
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
      await startSession(db, {
        charter: trimCharter(charter),
        context: toSessionContext(context),
        targetMinutes,
      })
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

  function updateContext(field: keyof ContextForm, value: string) {
    setContext((current) => ({ ...current, [field]: value }))
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
                placeholder={example(t(fieldText[field].example))}
                onChange={(event) => {
                  update(field, event.target.value)
                }}
              />
            </div>
          )
        })}
      </div>
      {/* Native radios: one Tab stop, arrow keys, "2 of 4" and a single checked option come
          from the browser. Always one checked, so the Start check never reads it [TAN-20]. */}
      <fieldset className="duration">
        <legend className="duration-legend">{t('duration.title')}</legend>
        <div className="duration-options">
          {TARGET_MINUTE_OPTIONS.map((minutes) => (
            <label key={minutes} className="duration-option">
              <input
                type="radio"
                name={`${id}-duration`}
                value={minutes}
                className="duration-input"
                checked={targetMinutes === minutes}
                onKeyDown={keepEnterFromSubmitting}
                onChange={() => {
                  setTargetMinutes(minutes)
                }}
              />
              {t('duration.option', { minutes })}
            </label>
          ))}
        </div>
      </fieldset>
      {/* Optional: never read by the Start check. Always open (decision of 2026-11-19). */}
      <fieldset className="context">
        <legend className="context-legend">
          <span className="context-title">{t('context.title')}</span>{' '}
          <span className="context-hint">{t('context.hint')}</span>
        </legend>
        <div className="context-fields">
          <div className="context-field">
            <label htmlFor={`${id}-environment`} className="context-label">
              {t('context.environment')}
            </label>
            <input
              id={`${id}-environment`}
              type="text"
              className="context-input"
              value={context.environment}
              placeholder={example(t('context.environmentExample'))}
              onKeyDown={keepEnterFromSubmitting}
              onChange={(event) => {
                updateContext('environment', event.target.value)
              }}
            />
          </div>
          <div className="context-field">
            <label htmlFor={`${id}-build`} className="context-label">
              {t('context.build')}
            </label>
            <input
              id={`${id}-build`}
              type="text"
              className="context-input context-input-build"
              value={context.build}
              placeholder={example(t('context.buildExample'))}
              onKeyDown={keepEnterFromSubmitting}
              onChange={(event) => {
                updateContext('build', event.target.value)
              }}
            />
          </div>
          <div className="context-field context-field-wide">
            <label htmlFor={`${id}-areas`} className="context-label">
              {t('context.areas')} <span className="context-hint">· {t('context.areasHint')}</span>
            </label>
            <input
              id={`${id}-areas`}
              type="text"
              className="context-input"
              value={context.areas}
              placeholder={example(t('context.areasExample'))}
              onKeyDown={keepEnterFromSubmitting}
              onChange={(event) => {
                updateContext('areas', event.target.value)
              }}
            />
          </div>
          <div className="context-field context-field-wide">
            <label htmlFor={`${id}-testData`} className="context-label">
              {t('context.testData')}
            </label>
            <textarea
              id={`${id}-testData`}
              className="context-input context-textarea"
              rows={2}
              value={context.testData}
              placeholder={example(t('context.testDataExample'))}
              onChange={(event) => {
                updateContext('testData', event.target.value)
              }}
            />
          </div>
        </div>
      </fieldset>
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
          {/* Every label sits in the same grid cell and only the chosen one is visible, so
              the button is always as wide as the longest label and does not change size
              when the duration changes. Hidden labels are not part of the name [TAN-20]. */}
          <span className="charter-start-labels">
            {TARGET_MINUTE_OPTIONS.map((minutes) => (
              <span
                key={minutes}
                className="charter-start-label"
                data-current={minutes === targetMinutes}
                aria-hidden={minutes !== targetMinutes}
              >
                {t('charter.start', { minutes })}
              </span>
            ))}
          </span>
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </form>
  )
}
