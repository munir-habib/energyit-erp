import { evaluate } from 'mathjs'
import type {
  CommissionRule,
  EsquemaHorario,
  MarketIndex,
  Periodo,
  PotenciaContratadaValor,
  PricingFormula,
  Product,
  ProductEnergyPrice,
  ProductPriceVariant,
  Segmento,
  TarEnergiaBteMt,
  TarEnergiaBtn,
  TarPotenciaBteMt,
  TarPotenciaBtn,
} from '@/types/database'
import { buildGoGrid, goScopeFromGrid, indiceScopeFromCatalog, type GoGrid } from './formulaGrid'

/** Everything the pricing engine needs, fetched once per segment and reused across every product being compared. */
export interface PricingCatalog {
  products: Product[]
  energyPrices: ProductEnergyPrice[]
  formulas: PricingFormula[]
  variants: ProductPriceVariant[]
  tarEnergiaBtn: TarEnergiaBtn[]
  tarPotenciaBtn: TarPotenciaBtn[]
  tarEnergiaBteMt: TarEnergiaBteMt[]
  tarPotenciaBteMt: TarPotenciaBteMt[]
  potenciaValores: PotenciaContratadaValor[]
  marketIndices: MarketIndex[]
  /** Grelha de GO calculada (pricing_formulas.tipo='GO'), fonte única de verdade para o GO de cada produto — ver formulaGrid.ts. */
  goGrid: GoGrid
}

/** Todas as variantes (período/prazo) de um produto — vazio quando o produto não tem variantes (ex: Z/ZC/Deluxe+). */
export function variantesDoProduto(variants: ProductPriceVariant[], productId: string): ProductPriceVariant[] {
  return variants.filter((v) => v.product_id === productId)
}

/**
 * Grupo de início "ativo" entre as variantes com data (EZU GO): o de maior data_inicio que já
 * começou. Devolve só as variantes desse grupo, ordenadas por data_fim — nunca de outro grupo, para
 * nunca oferecer um período fora do que está comercialmente ativo hoje.
 */
export function grupoAtivo(variants: ProductPriceVariant[], hoje: Date = new Date()): ProductPriceVariant[] {
  const comData = variants.filter((v) => v.data_inicio != null)
  if (comData.length === 0) return []
  const hojeStr = hoje.toISOString().slice(0, 10)
  const iniciosAtivos = [...new Set(comData.map((v) => v.data_inicio!))].filter((d) => d <= hojeStr).sort()
  const inicioAtivo = iniciosAtivos[iniciosAtivos.length - 1]
  if (!inicioAtivo) return []
  return comData.filter((v) => v.data_inicio === inicioAtivo).sort((a, b) => (a.data_fim! < b.data_fim! ? -1 : 1))
}

/** true quando o grupo de início ainda não começou — nunca acontece se o produto só tem 1 grupo já ativo. */
export function grupoExpirado(variants: ProductPriceVariant[], hoje: Date = new Date()): boolean {
  const comData = variants.filter((v) => v.data_inicio != null)
  if (comData.length === 0) return false
  const hojeStr = hoje.toISOString().slice(0, 10)
  const maxFim = comData.reduce((max, v) => (v.data_fim! > max ? v.data_fim! : max), comData[0].data_fim!)
  return maxFim < hojeStr
}

/**
 * A variante escolhida por defeito de um produto quando o consultor ainda não mexeu no seletor:
 * para produtos com datas (EZU GO), a primeira data_fim do grupo ativo; para produtos com prazo
 * fixo (SuperNova GO, Flex/BOOST/MAX), a duração mais curta disponível.
 */
export function variantePadrao(variants: ProductPriceVariant[], productId: string, hoje: Date = new Date()): string | null {
  const todas = variantesDoProduto(variants, productId)
  if (todas.length === 0) return null
  if (todas.some((v) => v.data_inicio != null)) return grupoAtivo(todas, hoje)[0]?.id ?? null
  return [...todas].sort((a, b) => (a.duracao_meses ?? 0) - (b.duracao_meses ?? 0))[0]?.id ?? null
}

/**
 * IDs de todas as variantes "comparáveis" de um produto, por ordem — o grupo ativo (produtos com
 * datas, ex: EZU GO: só as datas do grupo já em vigor, nunca de outro grupo) ou todas as durações
 * (produtos de prazo fixo, ex: SuperNova Flex/BOOST/MAX). Mesma regra que variantePadrao já usa para
 * escolher a variante por omissão — aqui devolve a lista toda, para "Ver mais prazos/períodos" gerar
 * uma linha de comparação por variante (ver linhasPorVariante).
 */
export function variantesComparaveis(variants: ProductPriceVariant[], productId: string, hoje: Date = new Date()): string[] {
  const todas = variantesDoProduto(variants, productId)
  if (todas.length === 0) return []
  if (todas.some((v) => v.data_inicio != null)) return grupoAtivo(todas, hoje).map((v) => v.id)
  return [...todas].sort((a, b) => (a.duracao_meses ?? 0) - (b.duracao_meses ?? 0)).map((v) => v.id)
}

/**
 * Todas as linhas de comparação de um produto — 1 por variante comparável (variantesComparaveis), ou
 * uma só linha quando o produto não tem variantes (ex: Fechados simples). Usada por "Ver mais
 * prazos/períodos" para expandir as variantes que a vista colapsada esconde por omissão — cada
 * chamada a precificarProduto já é por si só o cálculo de 1 linha independente (variante + GO), não
 * precisa de nenhuma mudança ao motor em si.
 */
export function linhasPorVariante(product: Product, catalog: PricingCatalog, input: SimulationInput): ProductPricingResult[] {
  const ids = variantesComparaveis(catalog.variants, product.id)
  if (ids.length === 0) {
    const r = precificarProduto(product, catalog, input)
    return r ? [r] : []
  }
  return ids
    .map((variantId) => precificarProduto(product, catalog, { ...input, variantePorProduto: { [product.id]: variantId } }))
    .filter((r): r is ProductPricingResult => r !== null)
}

/** Constrói o goGrid a partir do catálogo cru — chamado uma vez que products/formulas/marketIndices mudam (ver useCatalog). */
export function computeGoGrid(products: Product[], formulas: PricingFormula[], marketIndices: MarketIndex[]): GoGrid {
  return buildGoGrid(
    products,
    formulas.filter((f) => f.tipo === 'GO'),
    marketIndices,
  )
}

/** GO padrão de um produto (grelha calculada ou valor estático do produto, definidos pelo Admin) — usado quando uma linha ainda não tem um GO próprio ajustado (ver linhasPorVariante/precificarProduto). Exportada para a UI poder mostrar/semear o valor inicial do controlo de GO por linha. */
export function goValorResolvido(product: Product, catalog: Pick<PricingCatalog, 'goGrid'>): number {
  return catalog.goGrid.get(product.id)?.value ?? product.go_valor ?? 0
}

export interface SimulationInput {
  segmento: Segmento
  esquemaHorario: EsquemaHorario
  potenciaContratadaKva: number
  /** Nº de dias faturados do período em análise (nunca um ano completo). */
  diasFaturados: number
  /** kWh tal como saem da fatura para o período faturado — nunca anualizado. */
  consumoPeriodo: Partial<Record<Periodo, number>>
  comTar: boolean
  horasPontaDiarias?: number | null
  /** Custo do período que o cliente paga hoje (Modo A ou B — ver calcularCustoAtualPeriodo), única base da poupança. */
  custoAtualPeriodo: number
  /** GO de teste escolhido livremente pelo consultor nesta simulação — substitui o GO de cada produto Aberto/Indexado (nunca grava no produto, produtos Fechados não usam GO). */
  goOverride?: number | null
  /** Variante (período/prazo) escolhida por produto — product_id → variant_id. Produtos sem entrada aqui usam variantePadrao(). */
  variantePorProduto?: Record<string, string>
}

/**
 * Anualiza o consumo do período faturado — usado só para fins que precisam mesmo de uma base anual
 * (ex: estimativa de comissão sobre consumo anual). O motor de poupança (precificarProduto/
 * calcularCustoAtualPeriodo) trabalha sempre sobre o período faturado, nunca sobre este valor.
 */
export function anualizarConsumo(
  consumoPeriodo: Partial<Record<Periodo, number>>,
  diasFaturados: number,
  diasAno = 365,
): Partial<Record<Periodo, number>> {
  const fator = diasFaturados > 0 ? diasAno / diasFaturados : 0
  const anualizado: Partial<Record<Periodo, number>> = {}
  for (const [periodo, valor] of Object.entries(consumoPeriodo)) {
    anualizado[periodo as Periodo] = (valor ?? 0) * fator
  }
  return anualizado
}

/** Consumo anual total (kWh) a partir do consumo do período faturado — base de calcularComissao/estimarComissao. */
export function consumoAnualTotal(consumoPeriodo: Partial<Record<Periodo, number>>, diasFaturados: number): number {
  return Object.values(anualizarConsumo(consumoPeriodo, diasFaturados)).reduce((soma: number, v) => soma + (v ?? 0), 0)
}

export interface ComponentePeriodo {
  /** preço de energia sem TAR (base + GO quando aplicável) */
  semTar: number
  /** TAR de energia oficial/transversal para este período — calculada mesmo quando não somada ao preço final */
  tar: number
}

export interface PrecoMedioPonderado {
  semTar: number
  comTar: number
}

export interface ProductPricingResult {
  product: Product
  /** Variante (período/prazo) usada neste cálculo — null quando o produto não tem variantes. */
  variantId: string | null
  precosPeriodo: Partial<Record<Periodo, number>>
  /** Decomposição Sem TAR / TAR por período — só para apresentação (toggle da simulação), não afeta a poupança. */
  componentesPeriodo: Partial<Record<Periodo, ComponentePeriodo>>
  /** Encargo de Potência Contratada, em €/dia — só informativo, NUNCA entra na poupança (ver custoEnergiaPeriodo). */
  potenciaEurDia: number
  /** Encargo de Potência Contratada do período completo (potenciaEurDia × diasFaturados) — mesma nota acima. */
  potenciaEurPeriodo: number
  /** Preço médio ponderado pelo consumo de cada período — null quando o esquema só tem 1 período (SIMPLES). */
  precoMedioPonderado: PrecoMedioPonderado | null
  /** Custo do período de energia sem TAR (Σ semTar × consumo por período) — para o preço médio recalcular consoante o toggle TAR na UI. */
  custoEnergiaSemTarPeriodo: number
  /** Custo do período só da componente de TAR de energia (Σ tar × consumo por período). */
  custoTarPeriodo: number
  /** Custo de energia do período ao preço final realmente pago (com GO e TAR quando aplicável) — única base da poupança, nunca inclui potência. */
  custoEnergiaPeriodo: number
  poupancaEurPeriodo: number
  poupancaEurMes: number
  poupancaEurAno: number
  poupancaPct: number
  /** true quando o custo atual do cliente ainda não foi inserido na simulação — os campos de poupança não devem ser mostrados como poupança nesse caso. */
  custoAtualIndefinido: boolean
  alertaGo: boolean
  tarSempreIncluida: boolean
  mediaQuatroPeriodos: number | null
}

export function periodosDoEsquema(esquema: EsquemaHorario): Periodo[] {
  switch (esquema) {
    case 'SIMPLES':
      return ['SIMPLES']
    case 'BI_HORARIO':
      return ['FORA_VAZIO', 'VAZIO']
    case 'TRI_HORARIO':
      return ['PONTA', 'CHEIA', 'VAZIO']
    case 'TETRA_HORARIO':
      return ['PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO']
  }
}

/** Nome de cada período tal como usado em todo o ecrã (inputs, tabela de resultados) — fonte única para nunca inventar nomenclatura diferente noutro sítio (ex: PDFs). */
const PERIODO_LABELS: Record<Periodo, string> = {
  SIMPLES: 'Simples',
  FORA_VAZIO: 'Fora de Vazio',
  PONTA: 'Ponta',
  CHEIA: 'Cheia',
  VAZIO: 'Vazio',
  SUPER_VAZIO: 'Super Vazio',
}

export function periodoLabel(p: Periodo): string {
  return PERIODO_LABELS[p]
}

/** Ordem canónica de todos os períodos possíveis (união de todos os esquemas) — usada para ordenar um conjunto de períodos sem saber de antemão o esquema exato (ex: detalhe por produto num PDF). */
export const ORDEM_PERIODOS: Periodo[] = ['SIMPLES', 'FORA_VAZIO', 'PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO']

function lookupTarEnergiaBtn(
  rows: TarEnergiaBtn[],
  esquema: EsquemaHorario,
  periodo: Periodo,
  potenciaKva: number,
): number {
  if (esquema === 'TETRA_HORARIO') return 0
  const abaixoLimite = potenciaKva <= 20.7
  const exact = rows.find(
    (r) => r.esquema_horario === esquema && r.periodo === periodo && r.abaixo_20_7kva === abaixoLimite,
  )
  if (exact) return exact.valor
  // fall back to the generic (>20,7 kVA) row if there is no specific one for this power band
  return rows.find((r) => r.esquema_horario === esquema && r.periodo === periodo && !r.abaixo_20_7kva)?.valor ?? 0
}

/**
 * TAR de energia oficial/transversal de um período — a mesma tabela usada tanto para decompor o
 * preço dos produtos (ver precificarProduto) como para ajustar o Custo_Atual quando o preço atual
 * inserido na simulação ainda não inclui TAR (ver calcularCustoAtualPeriodo), e para o detalhe por
 * período do "O que muda" do Documento do Cliente (ver pdf.ts) — exportada para nunca duplicar esta
 * tabela/lógica fora do motor. BTN depende do esquema horário e do escalão de potência (20,7 kVA);
 * BTE/MT é direto por categoria + período.
 */
export function tarEnergiaOficial(
  segmento: Segmento,
  periodo: Periodo,
  esquemaHorario: EsquemaHorario,
  potenciaKva: number,
  tarEnergiaBtn: TarEnergiaBtn[],
  tarEnergiaBteMt: TarEnergiaBteMt[],
): number {
  return segmento === 'BTN'
    ? lookupTarEnergiaBtn(tarEnergiaBtn, esquemaHorario, periodo, potenciaKva)
    : (tarEnergiaBteMt.find((r) => r.categoria === segmento && r.periodo === periodo)?.valor ?? 0)
}

function lookupTarPotenciaBtn(rows: TarPotenciaBtn[], potenciaKva: number): number {
  const exact = rows.find((r) => r.potencia_kva === potenciaKva)
  if (exact) return exact.valor_dia
  const sorted = [...rows].sort((a, b) => a.potencia_kva - b.potencia_kva)
  const next = sorted.find((r) => r.potencia_kva >= potenciaKva)
  return (next ?? sorted[sorted.length - 1])?.valor_dia ?? 0
}

/**
 * Escolhe a linha de preço certa para um período/esquema dentro de uma variante — quando há mais do
 * que uma linha (Tri-Horário de Flex/BOOST/MAX, com uma linha por escalão de potência), desempata
 * pelo escalão da potência contratada, com o mesmo fallback de lookupTarEnergiaBtn.
 */
function lookupEnergyRow(
  rows: ProductEnergyPrice[],
  esquema: EsquemaHorario,
  periodo: Periodo,
  variantId: string | null,
  potenciaKva: number,
): ProductEnergyPrice | undefined {
  const candidatos = rows.filter((r) => r.periodo === periodo && r.esquema_horario === esquema && r.variant_id === variantId)
  if (candidatos.length <= 1) return candidatos[0]
  const abaixoLimite = potenciaKva <= 20.7
  return (
    candidatos.find((r) => r.abaixo_20_7kva === abaixoLimite) ??
    candidatos.find((r) => r.abaixo_20_7kva == null) ??
    candidatos[0]
  )
}

function lookupPotenciaTabela(
  rows: PotenciaContratadaValor[],
  tabelaId: string | null,
  potenciaKva: number,
): number {
  if (!tabelaId) return 0
  const exact = rows.find((r) => r.tabela_id === tabelaId && r.potencia_kva === potenciaKva)
  if (exact) return exact.valor_dia
  const sorted = rows.filter((r) => r.tabela_id === tabelaId).sort((a, b) => a.potencia_kva - b.potencia_kva)
  const next = sorted.find((r) => r.potencia_kva >= potenciaKva)
  return (next ?? sorted[sorted.length - 1])?.valor_dia ?? 0
}

/** Avalia a fórmula do produto indexado com mathjs — nunca executa código arbitrário, só expressões matemáticas. */
function evaluateFormula(formula: string, scope: Record<string, number>): number {
  const result = evaluate(formula, scope)
  if (typeof result !== 'number' || Number.isNaN(result)) {
    throw new Error(`Fórmula inválida ou incompleta: "${formula}"`)
  }
  return result
}

function precoBasePeriodo(
  product: Product,
  formula: PricingFormula | undefined,
  row: ProductEnergyPrice,
  input: SimulationInput,
  catalog: PricingCatalog,
): number {
  if (product.tipo === 'ABERTO_FIXO' || product.tipo === 'FECHADO') {
    return row.preco_base
  }
  // ABERTO_INDEXADO — row.preco_base guarda o Spread por período; a fórmula calcula o preço base final.
  const indice = catalog.marketIndices.find((i) => i.id === product.indice_id)?.valor ?? 0
  if (!formula) {
    throw new Error(`Produto indexado "${product.nome}" não tem fórmula configurada.`)
  }
  return evaluateFormula(formula.formula, {
    // nomes genéricos (compatibilidade com fórmulas existentes, sempre relativos a este produto)
    Indice: indice,
    Spread: row.preco_base,
    Margem: product.margem ?? 0,
    GO: goValorResolvido(product, catalog),
    PotenciaContratada: input.potenciaContratadaKva,
    // nomes da grelha — permitem referenciar o GO de outro produto ou outro índice pelo nome
    ...indiceScopeFromCatalog(catalog.marketIndices),
    ...goScopeFromGrid(catalog.products, catalog.goGrid),
  })
}

const BTE_MT_SEGMENTOS: Segmento[] = ['BTE', 'MT']

/**
 * Calcula o preço final por período e a poupança de um produto para uma dada simulação — sempre em
 * termos do período faturado (nunca anualizado), e sempre só sobre o custo de energia: a potência
 * contratada é calculada só como dado informativo (potenciaEurDia/potenciaEurPeriodo) e NUNCA entra
 * em custoEnergiaPeriodo nem em nenhum dos poupancaEur*.
 */
export function precificarProduto(
  product: Product,
  catalog: PricingCatalog,
  input: SimulationInput,
): ProductPricingResult | null {
  const ehBteMt = BTE_MT_SEGMENTOS.includes(product.segmento)
  const periodos = ehBteMt ? periodosDoEsquema('TETRA_HORARIO') : periodosDoEsquema(input.esquemaHorario)
  const rows = catalog.energyPrices.filter((p) => p.product_id === product.id)
  const formula = catalog.formulas.find((f) => f.product_id === product.id && f.tipo === 'PRECO')
  const variantId = input.variantePorProduto?.[product.id] ?? variantePadrao(catalog.variants, product.id)
  // Produto com variantes mas nenhuma disponível ainda (ex: grupo de início ainda não começou) — não entra na comparação.
  if (variantesDoProduto(catalog.variants, product.id).length > 0 && variantId == null) return null

  const precosPeriodo: Partial<Record<Periodo, number>> = {}
  const componentesPeriodo: Partial<Record<Periodo, ComponentePeriodo>> = {}
  let custoEnergiaPeriodo = 0
  let alertaGo = false
  let consumoTotal = 0
  let somaSemTarPonderada = 0
  let somaTarPonderada = 0

  const esquemaEfetivo = ehBteMt ? 'TETRA_HORARIO' : input.esquemaHorario
  for (const periodo of periodos) {
    const row = lookupEnergyRow(rows, esquemaEfetivo, periodo, variantId, input.potenciaContratadaKva)
    if (!row) return null // produto não tem preço para este esquema/período/variante — não entra na comparação

    const precoBase = precoBasePeriodo(product, formula, row, input, catalog)
    // TAR oficial/transversal, sempre calculada (independente de comTar/preco_estatico_com_tar) — usada
    // só para decompor a apresentação em Sem TAR / Com TAR (toggle da simulação), nunca para a poupança.
    const tarOficial = tarEnergiaOficial(
      product.segmento,
      periodo,
      input.esquemaHorario,
      input.potenciaContratadaKva,
      catalog.tarEnergiaBtn,
      catalog.tarEnergiaBteMt,
    )
    const tarEnergia = product.preco_estatico_com_tar || !input.comTar ? 0 : tarOficial

    const goResolvidoParaCalculo =
      input.goOverride != null ? input.goOverride : goValorResolvido(product, catalog)
    const goComponent = product.tipo === 'FECHADO' ? 0 : goResolvidoParaCalculo / 1000
    const precoFinal = product.preco_estatico_com_tar
      ? precoBase
      : precoBase + goComponent + tarEnergia

    precosPeriodo[periodo] = precoFinal
    const consumoPeriodo = input.consumoPeriodo[periodo] ?? 0
    custoEnergiaPeriodo += precoFinal * consumoPeriodo

    const semTar = product.preco_estatico_com_tar ? precoBase - tarOficial : precoBase + goComponent
    componentesPeriodo[periodo] = { semTar, tar: tarOficial }

    consumoTotal += consumoPeriodo
    somaSemTarPonderada += semTar * consumoPeriodo
    somaTarPonderada += tarOficial * consumoPeriodo

    if (product.preco_limite != null && precoFinal > product.preco_limite) {
      alertaGo = true
    }
  }

  // Potência contratada — SÓ informativo (mostrado à parte na UI). Nunca somado a custoEnergiaPeriodo
  // nem usado em qualquer poupancaEur*: a comparação de poupança é sempre só sobre energia.
  let potenciaEurDia = 0
  if (product.segmento === 'BTN') {
    if (product.tipo === 'FECHADO') {
      potenciaEurDia = lookupPotenciaTabela(catalog.potenciaValores, product.potencia_tabela_id, input.potenciaContratadaKva)
    } else if (input.comTar) {
      // Produtos Abertos usam a TAR de Potência transversal por defeito — mas quando o produto tem uma
      // tabela própria associada (ex: exceção EZU Aberto BTN, com tabela antiga por pedido explícito),
      // essa tabela prevalece sobre a transversal.
      potenciaEurDia = product.potencia_tabela_id
        ? lookupPotenciaTabela(catalog.potenciaValores, product.potencia_tabela_id, input.potenciaContratadaKva)
        : lookupTarPotenciaBtn(catalog.tarPotenciaBtn, input.potenciaContratadaKva)
    }
  } else if (ehBteMt && input.comTar) {
    const coef = catalog.tarPotenciaBteMt.find((r) => r.categoria === product.segmento)
    if (coef) {
      const encargoPcDia = coef.coef_pc * input.potenciaContratadaKva
      const horasPonta = input.horasPontaDiarias ?? 0
      const energiaAtivaPonta = input.consumoPeriodo.PONTA ?? 0
      const potenciaMediaPonta = horasPonta > 0 && input.diasFaturados > 0 ? energiaAtivaPonta / (horasPonta * input.diasFaturados) : 0
      const encargoPhpDia = coef.coef_php * potenciaMediaPonta
      potenciaEurDia = encargoPcDia + encargoPhpDia
    }
  }
  const potenciaEurPeriodo = potenciaEurDia * input.diasFaturados

  // Sem custo atual inserido (<=0), poupancaEurPeriodo fica só "-custoEnergiaPeriodo" (usado internamente
  // para a ordenação por defeito, cheapest-first) e poupancaPct fica 0 — nenhum dos dois deve ser mostrado
  // como "poupança" na UI: o consumidor da UI tem de verificar custoAtualIndefinido e mostrar "sem comparação".
  const custoAtualIndefinido = input.custoAtualPeriodo <= 0
  const poupancaEurPeriodo = input.custoAtualPeriodo - custoEnergiaPeriodo
  const poupancaEurMes = (poupancaEurPeriodo / input.diasFaturados) * 30
  const poupancaEurAno = (poupancaEurPeriodo / input.diasFaturados) * 365
  const poupancaPct = custoAtualIndefinido ? 0 : (poupancaEurPeriodo / input.custoAtualPeriodo) * 100

  const mediaQuatroPeriodos = ehBteMt
    ? (['PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO'] as Periodo[]).reduce((sum, p) => sum + (precosPeriodo[p] ?? 0), 0) / 4
    : null

  const precoMedioPonderado: PrecoMedioPonderado | null =
    periodos.length > 1 && consumoTotal > 0
      ? { semTar: somaSemTarPonderada / consumoTotal, comTar: custoEnergiaPeriodo / consumoTotal }
      : null

  return {
    product,
    variantId,
    precosPeriodo,
    componentesPeriodo,
    potenciaEurDia,
    potenciaEurPeriodo,
    precoMedioPonderado,
    custoEnergiaSemTarPeriodo: somaSemTarPonderada,
    custoTarPeriodo: somaTarPonderada,
    custoEnergiaPeriodo,
    poupancaEurPeriodo,
    poupancaEurMes,
    poupancaEurAno,
    poupancaPct,
    custoAtualIndefinido,
    alertaGo,
    tarSempreIncluida: product.preco_estatico_com_tar,
    mediaQuatroPeriodos,
  }
}

export interface OpcoesComparacao {
  /** Critério de ordenação principal. 'comissao' já está implementado mas não é usado por defeito — os valores de comissão ainda não estão todos definidos no sistema (ver estimarComissao). */
  criterio?: 'poupanca' | 'comissao'
  /** Comissão estimada por produto (id do produto -> ComissaoEstimada), só necessária quando criterio === 'comissao'. */
  comissoes?: Map<string, ComissaoEstimada>
}

/** Compara todos os produtos ativos de um segmento e devolve os resultados ordenados (por defeito, por poupança). */
export function compararProdutos(
  catalog: PricingCatalog,
  input: SimulationInput,
  opcoes: OpcoesComparacao = {},
): ProductPricingResult[] {
  const candidatos = catalog.products.filter(
    (p) =>
      p.ativo &&
      // BTN, BTE e MT são segmentos irmãos, nunca combináveis — filtrar por um único segmento de
      // cada vez já garante que produtos de segmentos diferentes nunca aparecem na mesma comparação.
      p.segmento === input.segmento,
  )
  const resultados = candidatos
    .map((p) => precificarProduto(p, catalog, input))
    .filter((r): r is ProductPricingResult => r !== null)

  if (opcoes.criterio === 'comissao' && opcoes.comissoes) {
    const comissoes = opcoes.comissoes
    return resultados.sort((a, b) => {
      const ca = comissoes.get(a.product.id)
      const cb = comissoes.get(b.product.id)
      const aIndefinida = !ca || ca.indefinida
      const bIndefinida = !cb || cb.indefinida
      if (aIndefinida !== bIndefinida) return aIndefinida ? 1 : -1 // indefinidas ficam sempre no fim, nunca competem como 0
      if (!aIndefinida && !bIndefinida) {
        const diff = cb!.valor - ca!.valor
        if (Math.abs(diff) > 0.01) return diff
      }
      return b.poupancaPct - a.poupancaPct // desempate/fallback por poupança %
    })
  }

  return ordenarPorPoupanca(resultados)
}

/**
 * Ordenação por defeito de qualquer lista de linhas: maior poupança % primeiro; empate desempatado
 * pela prioridade de comissão do produto quando definida (ex: EZU: ZC > Z > Deluxe+); produtos sem
 * prioridade definida (ex: SuperNova, ainda sem ordem de desempate acordada) caem para ordem
 * alfabética como fallback. Extraída de compararProdutos para poder ordenar também listas de linhas
 * construídas fora dele (ex: várias variantes do mesmo produto expandidas — ver linhasPorVariante).
 */
export function ordenarPorPoupanca(resultados: ProductPricingResult[]): ProductPricingResult[] {
  return [...resultados].sort((a, b) => {
    const diff = b.poupancaPct - a.poupancaPct
    if (Math.abs(diff) > 0.05) return diff // não é empate — ordena por poupança %
    const prioA = a.product.prioridade_comissao
    const prioB = b.product.prioridade_comissao
    if (prioA != null && prioB != null) return prioA - prioB
    if (prioA != null || prioB != null) return prioA != null ? -1 : 1
    return a.product.nome.localeCompare(b.product.nome)
  })
}

/** O primeiro resultado não sinalizado com alertaGo — um produto com GO acima do preço-limite nunca é sugerido, mesmo sendo o mais barato. */
export function sugerirMelhorProduto(resultados: ProductPricingResult[]): ProductPricingResult | null {
  return resultados.find((r) => !r.alertaGo) ?? null
}

export type ModoPrecoAtual = 'PERIODOS' | 'TOTAL'

export interface CustoAtualInput {
  /** Modo A ('PERIODOS'): €/kWh por período, multiplicado pelo consumo de cada período.
   *  Modo B ('TOTAL'): o consultor insere diretamente o valor total (€) da fatura no período. */
  modo: ModoPrecoAtual
  consumoPeriodo: Partial<Record<Periodo, number>>
  /** Só usado em modo 'PERIODOS'. */
  precoAtualPeriodos?: Partial<Record<Periodo, number>>
  /** Só usado em modo 'TOTAL'. */
  valorTotalPeriodo?: number
  /**
   * Modo A só — contexto para ajustar o preço atual à mesma TAR de energia oficial usada pelos
   * produtos, quando o preço inserido ainda não a inclui (checkbox "Este valor já inclui TAR"
   * desmarcada). Omitido, ou incluiTarAtual=true, → nenhum ajuste (o preço inserido já é usado tal
   * como está). Ver calcularCustoAtualPeriodo.
   */
  ajusteTarAtual?: {
    incluiTarAtual: boolean
    segmento: Segmento
    esquemaHorario: EsquemaHorario
    potenciaContratadaKva: number
    tarEnergiaBtn: TarEnergiaBtn[]
    tarEnergiaBteMt: TarEnergiaBteMt[]
  }
}

/**
 * Custo_Atual do pedido: Modo A → Σ (consumo_período × Preço_Atual_Ajustado(período)); Modo B → o
 * valor total inserido diretamente (já é um valor final, sem período a ajustar). Em Modo A,
 * Preço_Atual_Ajustado(período) é o preço tal como inserido quando "já inclui TAR" está marcada, ou
 * esse preço + a TAR de energia oficial do período (mesma tabela usada pelos produtos, ver
 * tarEnergiaOficial) quando não está — sem isto, um preço atual inserido sem TAR fica sistematicamente
 * abaixo do preço dos produtos novos (que incluem sempre TAR), inflando a poupança para menos, ou até
 * negativa, de forma errada. A potência continua de fora deste cálculo em ambos os modos — o
 * consultor introduz o custo de energia tal como paga hoje, e a poupança compara-o sempre só com o
 * custo de energia do produto (ver precificarProduto). O toggle "Com/Sem TAR" da tabela de
 * resultados é só uma etiqueta de apresentação dos produtos, sem relação nenhuma com este ajuste.
 */
export function calcularCustoAtualPeriodo(input: CustoAtualInput): number {
  if (input.modo === 'TOTAL') return input.valorTotalPeriodo ?? 0
  const ajuste = input.ajusteTarAtual
  let custo = 0
  for (const [periodo, consumo] of Object.entries(input.consumoPeriodo) as [Periodo, number | undefined][]) {
    const precoInserido = input.precoAtualPeriodos?.[periodo] ?? 0
    const tar =
      ajuste && !ajuste.incluiTarAtual
        ? tarEnergiaOficial(ajuste.segmento, periodo, ajuste.esquemaHorario, ajuste.potenciaContratadaKva, ajuste.tarEnergiaBtn, ajuste.tarEnergiaBteMt)
        : 0
    custo += (precoInserido + tar) * (consumo ?? 0)
  }
  return custo
}

// ---------------------------------------------------------------------------
// Comissões
// ---------------------------------------------------------------------------

export function selecionarRegraComissao(
  regras: CommissionRule[],
  goValor: number,
  dataFecho: string,
): CommissionRule | null {
  const data = new Date(dataFecho)
  const candidatas = regras.filter((r) => {
    const desde = new Date(r.valido_desde)
    const ate = r.valido_ate ? new Date(r.valido_ate) : null
    if (data < desde) return false
    if (ate && data > ate) return false
    if (r.go_min != null && goValor < r.go_min) return false
    if (r.go_max != null && goValor > r.go_max) return false
    return true
  })
  if (candidatas.length === 0) return null
  // desempate: regra com intervalo de GO mais específico (não "qualquer GO") ganha; depois a mais recente
  return candidatas.sort((a, b) => {
    const especificidadeA = a.go_min == null && a.go_max == null ? 1 : 0
    const especificidadeB = b.go_min == null && b.go_max == null ? 1 : 0
    if (especificidadeA !== especificidadeB) return especificidadeA - especificidadeB
    return new Date(b.valido_desde).getTime() - new Date(a.valido_desde).getTime()
  })[0]
}

export interface ComissaoCalculada {
  valor: number
  goAplicado: number | null
  multiplicadorAplicado: number | null
  regraId: string | null
}

export function calcularComissao(
  product: Product,
  regras: CommissionRule[],
  consumoAnualKwh: number,
  dataFecho: string,
  // GO já resolvido pela grelha (catalog.goGrid) — cai para o valor estático do produto quando omitido.
  goResolvido?: number,
): ComissaoCalculada {
  if (product.tipo === 'FECHADO') {
    return {
      valor: product.comissao_fixa ?? 0,
      goAplicado: null,
      multiplicadorAplicado: null,
      regraId: null,
    }
  }
  const go = goResolvido ?? product.go_valor ?? 0
  const regra = selecionarRegraComissao(regras, go, dataFecho)
  const multiplicador = regra?.multiplicador ?? 0
  const valor = consumoAnualKwh * (go / 1000) * multiplicador
  return { valor, goAplicado: go, multiplicadorAplicado: multiplicador, regraId: regra?.id ?? null }
}

export interface ComissaoEstimada {
  valor: number
  /** true quando não há dados de comissão configurados para este produto — nunca tratar como €0. */
  indefinida: boolean
}

/**
 * Estima a comissão de um produto para fins de comparação/ordenação numa simulação — nunca inventa um
 * valor: quando o produto Fechado não tem comissao_fixa definida, ou o produto Aberto não tem nenhuma
 * commission_rule aplicável, marca indefinida=true em vez de devolver 0.
 */
export function estimarComissao(
  product: Product,
  regras: CommissionRule[],
  consumoAnualKwh: number,
  dataFecho: string,
  goResolvido?: number,
): ComissaoEstimada {
  if (product.tipo === 'FECHADO') {
    if (product.comissao_fixa == null) return { valor: 0, indefinida: true }
    return { valor: product.comissao_fixa, indefinida: false }
  }
  if (regras.length === 0) return { valor: 0, indefinida: true }
  const calc = calcularComissao(product, regras, consumoAnualKwh, dataFecho, goResolvido)
  if (calc.regraId == null) return { valor: 0, indefinida: true }
  return { valor: calc.valor, indefinida: false }
}

export function indiceDesatualizado(indice: MarketIndex, diasLimite = 7): boolean {
  const atualizado = new Date(indice.data_atualizacao)
  const diffDias = (Date.now() - atualizado.getTime()) / (1000 * 60 * 60 * 24)
  return diffDias > diasLimite
}
