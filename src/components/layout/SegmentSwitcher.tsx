import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

const AREAS = [
  { to: '/', label: 'Eletricidade' },
  { to: '/gas', label: 'Gás' },
]

/** Linha de contexto entre as duas áreas do negócio — Eletricidade (resto da app) e Gás (placeholder). */
export function SegmentSwitcher() {
  return (
    <div className="glass-btn inline-flex max-w-full items-center overflow-x-auto rounded-full p-1">
      {AREAS.map((a) => (
        <NavLink
          key={a.to}
          to={a.to}
          end={a.to === '/gas'}
          className={({ isActive }) =>
            clsx(
              'whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-semibold transition-colors',
              isActive
                ? 'bg-surface-card text-brand shadow-sm dark:bg-surface-dark-card dark:text-savings-dark'
                : 'text-slate-500 hover:text-brand dark:text-slate-400',
            )
          }
        >
          {a.label}
        </NavLink>
      ))}
    </div>
  )
}
