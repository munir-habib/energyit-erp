import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { adminNav, moreNav, topNav, type NavItemDef } from '@/components/layout/navItems'
import { useDismiss } from '@/components/layout/useDismiss'

const ITEM = 'nav-hover rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap'

function DropdownItem({ label, items }: { label: string; items: NavItemDef[] }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss<HTMLDivElement>(open, close)
  const active = items.some((i) => pathname.startsWith(i.to))

  useEffect(() => setOpen(false), [pathname])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(ITEM, active || open ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-300')}
      >
        {label} <span aria-hidden className="text-[10px]">▾</span>
      </button>
      {open && (
        <div role="menu" className="glass absolute left-1/2 top-full z-40 mt-3 w-56 -translate-x-1/2 rounded-2xl p-1.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              className={({ isActive }) =>
                clsx(
                  'nav-hover block rounded-xl px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-brand text-white' : 'text-slate-700 dark:text-slate-200',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

/** Navegação principal do desktop: pílula de vidro com os itens principais + "Mais" (+ "Admin"). */
export function TopNav() {
  const { isAdmin } = useAuth()
  const { t } = useLanguage()

  return (
    <nav aria-label="Principal" className="glass hidden items-center gap-1 rounded-full p-1.5 lg:flex">
      {topNav(t).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(ITEM, isActive ? 'bg-brand text-white' : 'text-slate-600 dark:text-slate-300')
          }
        >
          {item.label}
        </NavLink>
      ))}
      <DropdownItem label={t.nav.more} items={moreNav(t)} />
      {isAdmin && <DropdownItem label={t.topbar.admin} items={adminNav(t)} />}
    </nav>
  )
}
