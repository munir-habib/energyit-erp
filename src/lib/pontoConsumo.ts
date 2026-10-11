import type { PontoConsumo } from '@/types/database'

/** Dias até à data_fim_contrato do período mais recente (negativo se já passou). */
export function diasAteRenovacao(p: Pick<PontoConsumo, 'data_fim_contrato'>, hoje: Date = new Date()): number | null {
  if (!p.data_fim_contrato) return null
  const ms = new Date(p.data_fim_contrato).getTime() - new Date(hoje.toDateString()).getTime()
  return Math.round(ms / 86_400_000)
}

/** Nível do alerta de renovação: ≤7 dias 'critico' (vermelho), ≤30 'urgente' (âmbar), ≤60 'aviso' (azul), acima disso nenhum. */
export type NivelRenovacao = 'critico' | 'urgente' | 'aviso' | null

export function nivelRenovacao(dias: number | null): NivelRenovacao {
  if (dias === null) return null
  if (dias <= 7) return 'critico'
  if (dias <= 30) return 'urgente'
  if (dias <= 60) return 'aviso'
  return null
}
