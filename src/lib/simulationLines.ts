import type { Simulation, SimulationResultLine } from '@/types/database'

/**
 * Chave estável de uma linha de comparação — Produto + Variante (prazo/período). Duas linhas do
 * mesmo produto com variantes diferentes (ex: EZU BTE GO em 2 períodos distintos) têm chaves
 * diferentes; um produto sem variantes usa só o seu id.
 */
export function chaveLinha(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId
}

export function chaveDaLinha(l: Pick<SimulationResultLine, 'product_id' | 'variant_id'>): string {
  return chaveLinha(l.product_id, l.variant_id)
}

/**
 * Lê `resultados` tal como está gravado e devolve as linhas já no formato novo (GO/fixação/candidata/
 * escolhida por linha) — simulações anteriores a este modelo só tinham um GO e uma escolha a nível da
 * simulação inteira; aqui isso é reconstruído por linha, sem reescrever nada na base de dados (ver
 * docs/redesign-linhas-comparacao.md secção 3). Idempotente: já não faz nada a uma simulação já no
 * formato novo.
 */
export function normalizarResultados(simulation: Pick<Simulation, 'resultados' | 'go_override' | 'produto_escolhido_id'>): SimulationResultLine[] {
  return simulation.resultados.map((l) => ({
    ...l,
    go_override: l.go_override ?? (l.tipo !== 'FECHADO' ? (simulation.go_override ?? null) : null),
    go_fixado: l.go_fixado ?? false,
    candidata: l.candidata ?? false,
    escolhida: l.escolhida ?? l.product_id === simulation.produto_escolhido_id,
  }))
}

/** A linha escolhida (✓) desta simulação, já normalizada — null se nenhuma estiver marcada. */
export function linhaEscolhidaDaSimulacao(simulation: Pick<Simulation, 'resultados' | 'go_override' | 'produto_escolhido_id'>): SimulationResultLine | null {
  return normalizarResultados(simulation).find((l) => l.escolhida) ?? null
}

/** As linhas candidatas (⭐) desta simulação, já normalizadas — ordem tal como guardada. */
export function linhasCandidatasDaSimulacao(simulation: Pick<Simulation, 'resultados' | 'go_override' | 'produto_escolhido_id'>): SimulationResultLine[] {
  return normalizarResultados(simulation).filter((l) => l.candidata)
}

/**
 * Marca uma linha como escolhida (✓) e desmarca qualquer outra — nunca ficam 2 escolhidas na mesma
 * simulação. Devolve um novo array (não muta o original) já normalizado.
 */
export function marcarEscolhida(resultados: SimulationResultLine[], simulationGoOverride: number | null, produtoEscolhidoAntigo: string | null, chave: string): SimulationResultLine[] {
  const normalizados = normalizarResultados({ resultados, go_override: simulationGoOverride, produto_escolhido_id: produtoEscolhidoAntigo })
  return normalizados.map((l) => ({ ...l, escolhida: chaveDaLinha(l) === chave }))
}

/** Alterna a marcação candidata (⭐) de uma linha — sem limite, várias podem estar marcadas ao mesmo tempo. */
export function alternarCandidata(resultados: SimulationResultLine[], simulationGoOverride: number | null, produtoEscolhidoAntigo: string | null, chave: string): SimulationResultLine[] {
  const normalizados = normalizarResultados({ resultados, go_override: simulationGoOverride, produto_escolhido_id: produtoEscolhidoAntigo })
  return normalizados.map((l) => (chaveDaLinha(l) === chave ? { ...l, candidata: !l.candidata } : l))
}
