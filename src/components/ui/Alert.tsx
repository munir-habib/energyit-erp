import type { ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'info' | 'warning' | 'danger' | 'success'

const toneClasses: Record<Tone, string> = {
  info: 'border-accent/20 bg-accent/5 text-accent',
  warning: 'border-pending/30 bg-pending/10 text-pending',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  success: 'border-savings/30 bg-savings/10 text-savings dark:text-savings-dark',
}

/** Aviso suave — nunca bloqueia o fluxo, apenas chama a atenção. */
export function Alert({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-card border px-4 py-3 text-sm', toneClasses[tone], className)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-slate-700 dark:text-slate-200">{children}</div>
    </div>
  )
}
