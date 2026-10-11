import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'card-surface rounded-card border border-slate-200 bg-surface-card dark:bg-surface-dark-card',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/** Cartão de destaque: contorno de 2px em gradiente cónico a rodar devagar. Só no cartão principal
 * de cada ecrã (KPI de poupança, linha Sugerida/Escolhida) — nunca em todos os cartões. */
export function HighlightCard({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('highlight-card', className)} {...rest}>
      <div className="highlight-inner">{children}</div>
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('p-5', className)}>{children}</div>
}
