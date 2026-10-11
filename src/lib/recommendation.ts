/** Margem por defeito para considerar dois produtos "quase tão bons" um do outro, em poupança. */
export const MARGEM_QUASE_TAO_BOM = 0.02

export function isQuaseTaoBom(poupancaMelhor: number, poupancaCandidato: number, margem = MARGEM_QUASE_TAO_BOM): boolean {
  if (poupancaMelhor === 0) return poupancaCandidato === 0
  const diffPct = Math.abs(poupancaMelhor - poupancaCandidato) / Math.abs(poupancaMelhor)
  return diffPct <= margem
}

export interface RecomendavelRow {
  productId: string
  poupancaEurAno: number
  alertaGo: boolean
  prioridadeComissao: number | null
}

export interface Recomendacao<T> {
  melhor: T | null
  alternativas: T[]
}

/**
 * Escolhe o produto recomendado e eventuais alternativas "quase tão boas" — nunca considera produtos
 * com alertaGo (GO acima do preço-limite), mesmo que sejam os mais baratos. Assume `rows` já ordenadas
 * por poupança desc (com desempate por prioridade de comissão), como devolvido por ordenarPorPoupanca.
 */
export function pickRecomendacao<T extends RecomendavelRow>(rows: T[], margem = MARGEM_QUASE_TAO_BOM): Recomendacao<T> {
  const elegiveis = rows.filter((r) => !r.alertaGo)
  const melhor = elegiveis[0] ?? null
  if (!melhor) return { melhor: null, alternativas: [] }

  const alternativas = elegiveis
    .slice(1)
    .filter((r) => isQuaseTaoBom(melhor.poupancaEurAno, r.poupancaEurAno, margem))

  return { melhor, alternativas }
}
