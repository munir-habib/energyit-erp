import type { Contract, FrozenPricing, Simulation, SimulationResultLine } from '@/types/database'
import { linhaEscolhidaDaSimulacao, normalizarResultados } from './simulationLines'

type SimulacaoParaContrato = Pick<Simulation, 'resultados' | 'go_override' | 'produto_escolhido_id' | 'consumo_periodo' | 'dias_faturados'>

/**
 * A linha exata (Produto + Variante) marcada Escolhida (✓) na simulação — e só essa. Nunca procurar
 * a linha só por product_id: um produto com várias variantes (ex: EZU BTE GO Jun27 e Jun28) tem várias
 * linhas, cada uma com os seus preços e o seu GO.
 */
export function linhaCongeladaParaContrato(simulation: SimulacaoParaContrato): SimulationResultLine | null {
  return linhaEscolhidaDaSimulacao(simulation)
}

/**
 * Preços congelados do contrato a partir da linha escolhida exata — inclui a variante (id + label) e o
 * GO negociado nessa linha (go_override), que é o GO usado depois no cálculo da comissão. null quando a
 * simulação não tem nenhuma linha escolhida.
 */
export function precosCongeladosDaSimulacao(simulation: SimulacaoParaContrato): { productId: string; precos: FrozenPricing } | null {
  const l = linhaCongeladaParaContrato(simulation)
  if (!l) return null
  return {
    productId: l.product_id,
    precos: {
      produto_nome: l.produto_nome,
      precos_periodo: l.precos_periodo,
      custo_energia_periodo: l.custo_energia_periodo,
      poupanca_eur_ano: l.poupanca_eur_ano,
      poupanca_pct: l.poupanca_pct,
      consumo_periodo: simulation.consumo_periodo,
      dias_faturados: simulation.dias_faturados,
      tipo: l.tipo,
      variant_id: l.variant_id ?? null,
      variant_label: l.variant_label ?? null,
      go_override: l.tipo === 'FECHADO' ? null : (l.go_override ?? null),
      go_fixado: l.go_fixado ?? false,
    },
  }
}

/**
 * GO a usar na comissão de um contrato — SEMPRE o GO fixado/negociado na linha escolhida, nunca o GO
 * por omissão do catálogo.
 *
 * - Contratos criados já com a linha exata congelada: precos_congelados.go_override.
 * - Contratos antigos (sem esse campo): procura na simulação de origem a linha do mesmo produto com os
 *   mesmos preços congelados (identifica a variante exata sem ambiguidade) e usa o GO dessa linha.
 *
 * null = GO desconhecido para esta linha — o chamador não deve calcular a comissão com outro GO.
 * (Irrelevante para Fechados, cuja comissão é fixa.)
 */
export function goDaLinhaDoContrato(
  contract: Pick<Contract, 'product_id' | 'precos_congelados'>,
  simulation?: Pick<Simulation, 'resultados' | 'go_override' | 'produto_escolhido_id'> | null,
): number | null {
  const precos = contract.precos_congelados
  if (precos.go_override !== undefined) return precos.go_override
  if (!simulation) return null
  const mesmosPrecos = (l: SimulationResultLine) =>
    l.product_id === contract.product_id && mesmoPreco(l.precos_periodo, precos.precos_periodo)
  const linhas = normalizarResultados(simulation).filter(mesmosPrecos)
  const linha = linhas.find((l) => l.escolhida) ?? (linhas.length === 1 ? linhas[0] : null)
  return linha?.go_override ?? null
}

function mesmoPreco(a: Record<string, number | undefined>, b: Record<string, number | undefined>): boolean {
  const chaves = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
  for (const k of chaves) if (a?.[k] !== b?.[k]) return false
  return true
}
