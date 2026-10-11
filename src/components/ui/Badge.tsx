import type { ReactNode } from 'react'
import clsx from 'clsx'
import { nivelRenovacao } from '@/lib/pontoConsumo'

type BadgeTone = 'savings' | 'pending' | 'danger' | 'accent' | 'neutral'

const toneClasses: Record<BadgeTone, string> = {
  savings: 'bg-savings/12 text-savings dark:bg-savings-dark/15 dark:text-savings-dark',
  pending: 'bg-pending/12 text-pending dark:text-amber-300',
  danger: 'bg-danger/12 text-danger',
  accent: 'bg-accent/12 text-accent dark:text-blue-300',
  neutral: 'bg-surface-muted text-slate-600 dark:bg-surface-dark-muted dark:text-slate-300',
}

export function Badge({
  children,
  tone = 'neutral',
  bold = false,
}: {
  children: ReactNode
  tone?: BadgeTone
  bold?: boolean
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors duration-200',
        bold ? 'font-semibold' : 'font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  )
}

export function EstadoContratoBadge({ estado }: { estado: 'ATIVO' | 'TERMINADO' | 'CANCELADO' }) {
  if (estado === 'ATIVO') return <Badge tone="savings" bold>Ativo</Badge>
  if (estado === 'TERMINADO') return <Badge tone="neutral">Terminado</Badge>
  return <Badge tone="danger">Cancelado</Badge>
}

export function EstadoPontoConsumoBadge({ estado }: { estado: 'Ativo' | 'Desativo' }) {
  return estado === 'Ativo' ? (
    <Badge tone="savings" bold>Ativo</Badge>
  ) : (
    <Badge tone="neutral">Desativo</Badge>
  )
}

/** Contagem decrescente até renovação — azul ≤60 dias, âmbar ≤30, vermelho ≤7. */
export function DiasRenovacaoBadge({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-slate-400">—</span>
  const nivel = nivelRenovacao(dias)
  if (nivel === 'critico') return <Badge tone="danger" bold>{dias} dias</Badge>
  if (nivel === 'urgente') return <Badge tone="pending" bold>{dias} dias</Badge>
  if (nivel === 'aviso') return <Badge tone="accent">{dias} dias</Badge>
  return <span className="text-slate-600 dark:text-slate-300">{dias} dias</span>
}

export function EstadoComissaoBadge({ estado }: { estado: 'PAGO' | 'NAO_PAGO' }) {
  return estado === 'PAGO' ? (
    <Badge tone="savings" bold>Pago</Badge>
  ) : (
    <Badge tone="pending" bold>Não Pago</Badge>
  )
}
