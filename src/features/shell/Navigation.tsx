import { useTranslation } from 'react-i18next'
import { PlusIcon, SettingsIcon } from './icons'
import { Link } from './Link'
import { routes, type Route } from './routes'
import './navigation.css'

interface NavigationProps {
  current: Route
  hasSessionInProgress: boolean
}

const currentProps = (isCurrent: boolean) =>
  isCurrent ? ({ 'aria-current': 'page' } as const) : {}

// Navigation on every screen but Home (spec R14): the top-left pill ("tansa" · Session ·
// History), the "+" link outside it, and the bottom-left Preferences pill with Settings.
// The theme button joins the Preferences pill in v0.2.
export function Navigation({ current, hasSessionInProgress }: NavigationProps) {
  const { t } = useTranslation()

  return (
    <>
      <header className="nav-top">
        <nav aria-label={t('nav.mainNavigation')} className="nav-pill">
          <Link href={routes.home} aria-label={t('nav.logo')} className="nav-logo">
            {t('app.name')}
          </Link>
          {hasSessionInProgress && (
            <Link
              href={routes.session}
              className="nav-link"
              {...currentProps(current === 'session')}
            >
              {current === 'session' && <span aria-hidden="true" className="nav-dot" />}
              {t('nav.session')}
            </Link>
          )}
          <Link href={routes.history} className="nav-link" {...currentProps(current === 'history')}>
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
