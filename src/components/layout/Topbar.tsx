import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { useDueAlerts, useDismissAlert } from '@/hooks/useAlerts'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { TopNav } from '@/components/layout/TopNav'
import { EnergyItLogo } from '@/components/ui/EnergyItLogo'
import { useDismiss } from '@/components/layout/useDismiss'
import { formatDate } from '@/lib/format'

function alertHref(entityType: 'SIMULATION' | 'CONTRACT', entityId: string): string {
  return entityType === 'SIMULATION' ? `/simulacoes/${entityId}` : `/contratos/${entityId}`
}

function AlertsBell() {
  const { t } = useLanguage()
  const { data: alerts } = useDueAlerts()
  const dismissAlert = useDismissAlert()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)
  const count = alerts?.length ?? 0

  return (
    <div ref={ref} className="relative overflow-visible">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="glass-btn nav-hover relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300"
        aria-label={t.topbar.alerts}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
        </svg>
      </button>
      {count > 0 && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-semibold leading-none whitespace-nowrap text-white dark:border-surface-dark">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {open && (
        <div className="absolute right-0 z-40 mt-3 w-72 rounded-2xl border border-slate-200 bg-surface-card py-1 shadow-lg dark:bg-surface-dark-card">
          {count === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400">{t.topbar.noAlerts}</p>
          ) : (
            (alerts ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-muted dark:hover:bg-white/5">
                <Link to={alertHref(a.entity_type, a.entity_id)} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {a.entity_type === 'SIMULATION' ? t.topbar.proposal : t.topbar.contract} · {formatDate(a.data_alvo)}
                  </p>
                </Link>
                <button
                  type="button"
                  className="shrink-0 text-xs text-accent hover:underline"
                  onClick={() => dismissAlert.mutate(a.id)}
                >
                  {t.topbar.seen}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { profile, isAdmin, signOut } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)
  const initial = (profile?.nome ?? profile?.email ?? '?').slice(0, 1).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={profile?.nome ?? profile?.email ?? t.topbar.admin}
        className="glass-btn nav-hover flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-brand dark:text-savings-dark"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-3 w-52 rounded-2xl border border-slate-200 bg-surface-card py-1 shadow-lg dark:bg-surface-dark-card">
          <div className="border-b border-slate-200 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{profile?.nome ?? profile?.email}</p>
            {isAdmin && <p className="text-[11px] text-brand dark:text-savings-dark">{t.topbar.admin}</p>}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-surface-muted dark:text-slate-300 dark:hover:bg-white/10"
          >
            {t.topbar.signOut}
          </button>
        </div>
      )}
    </div>
  )
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 bg-surface/90 dark:bg-surface-dark/90 items-center justify-between px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center">
        <EnergyItLogo />
      </div>
      <TopNav />
      <div className="flex items-center justify-end gap-2">
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <AlertsBell />
        <UserMenu />
      </div>
    </header>
  )
}
