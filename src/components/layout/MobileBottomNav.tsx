import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { adminNav, businessNav } from '@/components/layout/navItems'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useDismiss } from '@/components/layout/useDismiss'

/** Atalhos da barra inferior (mobile); o resto vive na folha "Mais". */
const PRIMARY_PATHS = ['/', '/clientes', '/simulacoes', '/comissoes']

const TAB =
  'flex h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors'

function MoreSheet({ onClose }: { onClose: () => void }) {
  const { isAdmin, signOut } = useAuth()
  const { t } = useLanguage()
  const ref = useDismiss<HTMLDivElement>(true, onClose)
  const items = businessNav(t).filter((i) => !PRIMARY_PATHS.includes(i.to))

  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'block rounded-xl px-3 py-2.5 text-sm font-medium',
      isActive ? 'bg-brand text-white' : 'text-slate-700 dark:text-slate-200',
    )

  return (
    <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
      <div
        ref={ref}
        className="glass absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl px-4 pb-28 pt-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-400/50" aria-hidden />
        <nav className="grid grid-cols-2 gap-1">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onClose} className={link}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {isAdmin && (
          <>
            <p className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t.nav.adminPanel}
            </p>
            <nav className="grid grid-cols-2 gap-1">
              {adminNav(t).map((item) => (
                <NavLink key={item.to} to={item.to} onClick={onClose} className={link}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <button type="button" onClick={() => void signOut()} className="rounded-full px-4 py-2 text-sm font-medium text-danger">
            {t.topbar.signOut}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MobileBottomNav() {
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const items = businessNav(t).filter((item) => PRIMARY_PATHS.includes(item.to))
  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      {open && <MoreSheet onClose={close} />}
      <nav
        aria-label="Mobile"
        className="glass fixed inset-x-[14px] z-50 flex h-[62px] items-center gap-1 rounded-[31px] px-2 lg:hidden"
        style={{ bottom: 'max(14px, env(safe-area-inset-bottom))' }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => clsx(TAB, isActive ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-300')}
          >
            <span aria-hidden className="text-base leading-none">
              {item.icon}
            </span>
            <span className="truncate">{item.to === '/simulacoes' ? 'Simular' : item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={clsx(TAB, open ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-300')}
        >
          <span aria-hidden className="text-base leading-none">
            ☰
          </span>
          <span className="truncate">{t.nav.more}</span>
        </button>
      </nav>
    </>
  )
}
