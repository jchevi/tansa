import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionTimer } from '../timer/SessionTimer'
import { PlusIcon, SettingsIcon } from './icons'
import { Link } from './Link'
import { routes, type Route } from './routes'
import type { SessionInProgress } from './useSessionInProgress'
import './navigation.css'

interface NavigationProps {
  current: Route
  inProgress: SessionInProgress | null
  // Shown after the timer; the Session screen passes End session [TAN-21].
  sessionActions?: ReactNode
}

const currentProps = (isCurrent: boolean) =>
  isCurrent ? ({ 'aria-current': 'page' } as const) : {}

// Navigation on every screen but Home (spec R14): the top-left pill ("tansa" · Session ·
// History), the "+" link outside it, the session timer pill on the right while a session
// is in progress [TAN-21], and the bottom-left Preferences pill with Settings. The header
// sticks to the top, so the timer stays visible when the page scrolls. The theme button
// joins the Preferences pill in v0.2.
export function Navigation({ current, inProgress, sessionActions }: NavigationProps) {
  const { t } = useTranslation()

  return (
    <>
      <header className="nav-top">
        <div className="nav-start">
          <nav aria-label={t('nav.mainNavigation')} className="nav-pill">
            <Link href={routes.home} aria-label={t('nav.logo')} className="nav-logo">
              {t('app.name')}
            </Link>
            {inProgress && (
              <Link
                href={routes.session}
                className="nav-link"
                {...currentProps(current === 'session')}
              >
                {current === 'session' && <span aria-hidden="true" className="nav-dot" />}
                {t('nav.session')}
              </Link>
            )}
            <Link
              href={routes.history}
              className="nav-link"
              {...currentProps(current === 'history')}
            >
              {current === 'history' && <span aria-hidden="true" className="nav-dot" />}
              {t('nav.history')}
            </Link>
          </nav>
          <Link
            href={routes.newSession}
            aria-label={t('nav.newSession')}
            className="nav-new"
            {...currentProps(current === 'newSession')}
          >
            <PlusIcon />
          </Link>
        </div>
        {inProgress && (
          <div className="nav-session">
            <SessionTimer inProgress={inProgress} />
            {sessionActions}
          </div>
        )}
      </header>
      <nav aria-label={t('nav.preferences')} className="nav-preferences">
        <Link
          href={routes.settings}
          aria-label={t('nav.settings')}
          className="nav-icon"
          {...currentProps(current === 'settings')}
        >
          <SettingsIcon />
        </Link>
      </nav>
    </>
  )
}
