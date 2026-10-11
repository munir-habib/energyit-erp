import type {
  ConsumoPeriodos,
  EsquemaHorario,
  ModoPrecoAtual,
  PrecoPeriodos,
  Segmento,
  Simulation,
  SimulationResultLine,
} from '@/types/database'
import { goValorResolvido, precificarProduto, type PricingCatalog, type ProductPricingResult, type SimulationInput } from './pricingEngine'
import { chaveLinha, normalizarResultados } from './simulationLines'

/**
 * Estado do formulário de Nova/Editar Simulação (SimulationNewPage) que é gravado na simulação e tem de
 * voltar intacto ao reabrir para editar. Extraído do componente para poder testar o round-trip
 * formulário → gravar → formulário sem React (ver simulationForm.test.ts).
 */
export interface EstadoFormularioSimulacao {
  segmento: Segmento
  clientId: string
  pontoConsumoId: string
  /** Só BTN escolhe esquema — BTE/MT são sempre Tetra-Horário. null = não mexer no valor por omissão do formulário. */
  esquemaBtn: EsquemaHorario | null
  diasFaturados: number
  potencia: number
  horasPonta: number | null
  consumoPeriodo: ConsumoPeriodos
  modoPrecoAtual: ModoPrecoAtual
  precoAtualPeriodos: PrecoPeriodos
  valorTotalPeriodo: number
  incluiTarAtual: boolean
  tarOn: boolean
  goPorLinha: Record<string, number>
  goFixadoPorLinha: Record<string, boolean>
  candidatas: Set<string>
  escolhidaKey: string | null
  produtosExpandidos: Set<string>
  /** Produtos desmarcados no filtro 3.8 ("Escolher comercializadoras/produtos") — gravados em simulations.produtos_excluidos. */
  produtosExcluidos: Set<string>
}

/** Marcações e GO de uma linha — mesma forma que ResultsTable.Marcacoes (redefinida aqui para src/lib não depender de um componente). */
export interface MarcacoesLinha {
  goOverride: number | null
  goFixado: boolean
  candidata: boolean
  escolhida: boolean
}

/**
 * Simulação gravada → estado do formulário de edição. Nenhum campo gravado pode perder-se aqui (já foi
 * bug: só o consumo voltava). GO/fixação/candidata/escolhida vêm de normalizarResultados, que já
 * reconstrói os valores por linha mesmo para simulações antigas.
 *
 * `variantePadrao` (product_id → variante por omissão hoje) serve para decidir que produtos abrir já
 * expandidos: só os que têm uma linha gravada numa variante que NÃO é a por omissão — essa linha só é
 * visível com "Ver mais prazos/períodos" aberto, e nunca pode "desaparecer" ao reabrir. Sem esta
 * função, qualquer produto com variante gravada fica expandido (comportamento conservador).
 */
export function estadoFormularioDaSimulacao(
  s: Simulation,
  variantePadrao?: (productId: string) => string | null,
): EstadoFormularioSimulacao {
  const normalizados = normalizarResultados(s)
  const goPorLinha: Record<string, number> = {}
  const goFixadoPorLinha: Record<string, boolean> = {}
  const candidatas = new Set<string>()
  const produtosExpandidos = new Set<string>()
  let escolhidaKey: string | null = null
  for (const l of normalizados) {
    const key = chaveLinha(l.product_id, l.variant_id)
    if (l.go_override != null) goPorLinha[key] = l.go_override
    if (l.go_fixado) goFixadoPorLinha[key] = true
    if (l.candidata) candidatas.add(key)
    if (l.escolhida) escolhidaKey = key
    if (l.variant_id && (!variantePadrao || variantePadrao(l.product_id) !== l.variant_id)) produtosExpandidos.add(l.product_id)
  }
  return {
    segmento: s.segmento,
    clientId: s.client_id ?? '',
    pontoConsumoId: s.ponto_consumo_id ?? '',
    esquemaBtn: s.segmento === 'BTN' ? s.esquema_horario : null,
    diasFaturados: s.dias_faturados,
    potencia: s.potencia_contratada_kva ?? 6.9,
    horasPonta: s.horas_ponta_diarias,
    consumoPeriodo: s.consumo_periodo,
    modoPrecoAtual: s.modo_preco_atual,
    precoAtualPeriodos: s.preco_atual_periodos ?? {},
    valorTotalPeriodo: s.valor_total_periodo ?? 0,
    incluiTarAtual: s.inclui_tar_atual,
    tarOn: s.com_tar,
    goPorLinha,
    goFixadoPorLinha,
    candidatas,
    escolhidaKey,
    produtosExpandidos,
    produtosExcluidos: new Set(s.produtos_excluidos ?? []),
  }
}

/**
 * Aplica o GO ajustado manualmente por linha, recalculando só as linhas com um GO próprio — cada linha
 * é 100% independente das outras (mesmo produto noutra variante incluído), nunca há um GO "global".
 */
export function aplicarGoPorLinha(
  linhasBase: ProductPricingResult[],
  catalog: PricingCatalog,
  inputBase: SimulationInput,
  goPorLinha: Record<string, number>,
): ProductPricingResult[] {
  return linhasBase.map((r) => {
    if (r.product.tipo === 'FECHADO') return r
    const override = goPorLinha[chaveLinha(r.product.id, r.variantId)]
    if (override == null) return r
    const recalc = precificarProduto(r.product, catalog, {
      ...inputBase,
      goOverride: override,
      variantePorProduto: r.variantId ? { [r.product.id]: r.variantId } : undefined,
    })
    return recalc ?? r
  })
}

/**
 * Marcações de cada linha: GO próprio (ou o GO por omissão do produto quando ainda não foi ajustado —
 * null em Fechados), fixação, candidata e escolhida — chaveado por chaveLinha.
 */
export function marcacoesDasLinhas(
  resultados: ProductPricingResult[],
  catalog: Pick<PricingCatalog, 'goGrid'>,
  estado: Pick<EstadoFormularioSimulacao, 'goPorLinha' | 'goFixadoPorLinha' | 'candidatas' | 'escolhidaKey'>,
): Map<string, MarcacoesLinha> {
  const map = new Map<string, MarcacoesLinha>()
  for (const r of resultados) {
    const key = chaveLinha(r.product.id, r.variantId)
    const fechado = r.product.tipo === 'FECHADO'
    map.set(key, {
      goOverride: fechado ? null : (estado.goPorLinha[key] ?? goValorResolvido(r.product, catalog)),
      goFixado: estado.goFixadoPorLinha[key] ?? false,
      candidata: estado.candidatas.has(key),
      escolhida: estado.escolhidaKey === key,
    })
  }
  return map
}

/** Linhas de comparação tal como gravadas em simulations.resultados — cada uma com o seu GO/marcações. */
export function linhasParaGravar(
  resultados: ProductPricingResult[],
  marcacoes: Map<string, MarcacoesLinha>,
  varianteLabel: (variantId: string) => string | null,
): SimulationResultLine[] {
  return resultados.map((r) => {
    const m = marcacoes.get(chaveLinha(r.product.id, r.variantId))
    return {
      product_id: r.product.id,
      produto_nome: r.product.nome,
      tipo: r.product.tipo,
      variant_id: r.variantId,
      variant_label: r.variantId ? varianteLabel(r.variantId) : null,
      precos_periodo: r.precosPeriodo,
      custo_energia_periodo: r.custoEnergiaPeriodo,
      poupanca_eur_periodo: r.poupancaEurPeriodo,
      poupanca_eur_mes: r.poupancaEurMes,
      poupanca_eur_ano: r.poupancaEurAno,
      poupanca_pct: r.poupancaPct,
      alerta_go: r.alertaGo,
      prioridade_comissao: r.product.prioridade_comissao,
      custo_atual_indefinido: r.custoAtualIndefinido,
      componentes_periodo: r.componentesPeriodo,
      potencia_eur_dia: r.potenciaEurDia,
      preco_medio_ponderado: r.precoMedioPonderado,
      go_override: m?.goOverride ?? null,
      go_fixado: m?.goFixado ?? false,
      candidata: m?.candidata ?? false,
      escolhida: m?.escolhida ?? false,
    }
  })
}

/** Colunas da simulação gravadas a partir do formulário (sem ativa/estado — ver useCreateSimulation/useUpdateSimulation). */
export type DadosSimulacao = Omit<Simulation, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'estado' | 'enviada_em' | 'ativa'>

/**
 * Estado do formulário + linhas já calculadas → colunas a gravar. `esquema` é o esquema efetivo
 * (BTE/MT sempre Tetra-Horário) e `pontoConsumoId` a CPE efetiva (pré-selecionada quando o cliente só
 * tem 1).
 */
export function dadosDaSimulacao(
  estado: EstadoFormularioSimulacao,
  esquema: EsquemaHorario,
  pontoConsumoId: string,
  linhas: SimulationResultLine[],
  produtoSugeridoId: string | null,
): DadosSimulacao {
  const linhaEscolhida = linhas.find((l) => l.escolhida) ?? null
  return {
    client_id: estado.clientId || null,
    invoice_id: null,
    ponto_consumo_id: pontoConsumoId || null,
    segmento: estado.segmento,
    esquema_horario: esquema,
    com_tar: estado.tarOn,
    horas_ponta_diarias: estado.horasPonta,
    dias_faturados: estado.diasFaturados,
    modo_preco_atual: estado.modoPrecoAtual,
    inclui_tar_atual: estado.incluiTarAtual,
    consumo_periodo: estado.consumoPeriodo,
    resultados: linhas,
    produto_sugerido_id: produtoSugeridoId,
    // Cache só de leitura (ContractNewPage/SimulationsListPage) — deriva da linha marcada escolhida.
    produto_escolhido_id: linhaEscolhida?.product_id ?? null,
    potencia_contratada_kva: estado.potencia,
    preco_atual_periodos: estado.modoPrecoAtual === 'PERIODOS' ? estado.precoAtualPeriodos : null,
    valor_total_periodo: estado.modoPrecoAtual === 'TOTAL' ? estado.valorTotalPeriodo : null,
    // Deprecated (GO a nível da simulação inteira) — cada linha grava o seu go_override em resultados.
    go_override: null,
    produtos_excluidos: produtosExcluidosParaGravar(estado.produtosExcluidos),
  }
}

/**
 * Filtro 3.8 → valor de simulations.produtos_excluidos: ids ordenados e sem repetidos (lista estável,
 * para gravar o mesmo valor sempre que a seleção é a mesma). Lista vazia = nenhum produto excluído
 * (grava [] e não null, para uma edição que volta a incluir tudo limpar o filtro antigo).
 */
export function produtosExcluidosParaGravar(excluidos: Iterable<string>): string[] {
  return [...new Set(excluidos)].sort()
}
