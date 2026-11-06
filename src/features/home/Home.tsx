import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HistoryIcon, PlusIcon, SettingsIcon } from '../shell/icons'
import { Link } from '../shell/Link'
import { routes } from '../shell/routes'
import type { SessionInProgress } from '../shell/useSessionInProgress'
import { elapsedMs, formatElapsed } from '../timer/elapsed'
import { useNow } from '../timer/useNow'
import { EnsoMark } from './EnsoMark'
import './home.css'

// Home (spec R14): no navigation bars, only the brand and a centered menu. The karesansui
// background arrives in v0.3 and the theme switch in v0.2.
export function Home({ inProgress }: { inProgress: SessionInProgress | null }) {
  const { t } = useTranslation()

  return (
    <main className="home">
      <div className="home-brand">
        <EnsoMark />
        <h1 className="home-title">{t('app.name')}</h1>
        <p className="home-tagline">{t('home.tagline')}</p>
      </div>
      <nav aria-label={t('nav.mainMenu')} className="home-menu">
        {inProgress ? (
          <ResumeLink inProgress={inProgress} />
        ) : (
          <Link href={routes.newSession} className="home-main">
            <span aria-hidden="true" className="home-chip">
              <PlusIcon />
            </span>
            <span className="home-main-title">{t('nav.newSession')}</span>
            <span aria-hidden="true" className="home-main-arrow">
              →
            </span>
          </Link>
        )}
        <div className="home-tiles">
          {/* With no session in progress the main button is New session: not shown twice. */}
          {inProgress && (
            <Tile href={routes.newSession} icon={<PlusIcon />} label={t('nav.newSession')} />
          )}
          <Tile href={routes.history} icon={<HistoryIcon />} label={t('nav.history')} />
          <Tile href={routes.settings} icon={<SettingsIcon />} label={t('nav.settings')} />
        </div>
      </nav>
    </main>
  )
}

// "Resume session" with the charter's Explore line and the elapsed time, recomputed from
// the stored segments every second.
function ResumeLink({ inProgress }: { inProgress: SessionInProgress }) {
  const { t } = useTranslation()
  const now = useNow(1000)
  const elapsed = elapsedMs(inProgress.segments, now)

  return (
    <Link href={routes.session} className="home-main">
      <svg aria-hidden="true" className="home-ring" width="40" height="40" viewBox="0 0 44 44">
        <circle className="home-ring-track" cx="22" cy="22" r="18" />
        <circle className="home-ring-arc" cx="22" cy="22" r="18" transform="rotate(-92 22 22)" />
      </svg>
      <span className="home-main-text">
        <span className="home-main-title">{t('home.resume')}</span>{' '}
        <span className="home-main-detail">
          {inProgress.session.charter.explore} ·{' '}
          <time dateTime={`PT${String(Math.floor(elapsed / 1000))}S`}>
            {formatElapsed(elapsed)}
          </time>
        </span>
      </span>
      <span aria-hidden="true" className="home-main-arrow">
        →
      </span>
    </Link>
  )
}

function Tile({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} className="home-tile">
      {icon}
      <span>{label}</span>
    </Link>
  )
}
