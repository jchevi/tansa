import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endSession, type TansaDb } from '../../data'
import { navigate } from '../shell/router'
import { routes } from '../shell/routes'

interface EndSessionButtonProps {
  db: TansaDb
  sessionId: string
  onEnded: () => void
}

// End session (TAN-21): status debrief, open segment closed, then the Debrief placeholder.
// Disabled while the write runs, so a double click ends it once. A failure (another tab
// ended it first) shows an alert and the button can be tried again.
export function EndSessionButton({ db, sessionId, onEnded }: EndSessionButtonProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'ending' | 'failed'>('idle')

  async function end() {
    setState('ending')
    try {
      await endSession(db, sessionId)
    } catch (error: unknown) {
      console.error(error)
      setState('failed')
      return
    }
    onEnded()
    navigate(routes.debrief)
  }

  return (
    <>
      <button
        type="button"
        className="nav-end"
        disabled={state === 'ending'}
        onClick={() => {
          void end()
        }}
      >
        {t('session.end')}
        <span aria-hidden="true"> →</span>
      </button>
      {state === 'failed' && (
        <p role="alert" className="nav-end-error">
          {t('session.endFailed')}
        </p>
      )}
    </>
  )
}
