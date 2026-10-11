import { Fragment, useState } from 'react'
import clsx from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { GoSlider } from '@/components/GoSlider'
import { formatEur, formatEurPerKwh, formatPct } from '@/lib/format'
import { periodoLabel } from '@/components/PeriodoInputs'
import { chaveDaLinha, chaveLinha } from '@/lib/simulationLines'
import type { ComissaoEstimada, ProductPricingResult } from '@/lib/pricingEngine'
import type { ComponentePeriodo, Periodo, PrecoMedioPonderado, SimulationResultLine, TipoProduto } from '@/types/database'

const TIPO_LABEL: Record<TipoProduto, string> = {
  ABERTO_FIXO: 'Aberto',
  ABERTO_INDEXADO: 'Aberto',
  FECHADO: 'Fechado',
}

/** Marcações e GO de uma linha — vivem à parte do resultado do motor (não são cálculo, são decisão do consultor/estado gravado). */
export interface Marcacoes {
  goOverride: number | null
  goFixado: boolean
  candidata: boolean
  escolhida: boolean
}
const MARCACOES_PADRAO: Marcacoes = { goOverride: null, goFixado: false, candidata: false, escolhida: false }

export interface NormalizedRow {
  /** Chave estável da linha — Produto+Variante (ver chaveLinha em simulationLines.ts). Um produto pode ter várias linhas (uma por variante). */
  lineKey: string
  productId: string
  nome: string
  comercializadora: string
  tipo: TipoProduto
  precosPeriodo: Partial<Record<Periodo, number>>
  componentesPeriodo: Partial<Record<Periodo, ComponentePeriodo>>
  /** Só informativo — nunca influencia a poupança apresentada. */
  potenciaEurDia: number
  precoMedioPonderado: PrecoMedioPonderado | null
  poupancaEurMes: number
  poupancaEurAno: number
  poupancaPct: number
  /** true quando o custo atual do cliente ainda não foi inserido — a poupança não é comparável. */
  custoAtualIndefinido: boolean
  alertaGo: boolean
  prioridadeComissao: number | null
  /** null quando a fonte (ex: simulações antigas) não tem esta informação. */
  comissaoEstimada?: ComissaoEstimada | null
  /** Variante (período/prazo) usada — null quando o produto não tem variantes. */
  variantId: string | null
  /** Texto humano da variante usada (ex: "Jun27", "24 meses") — mostrado quando não há seletor editável. */
  varianteLabel: string | null
  /** GO desta linha (€/MWh) — null em produtos Fechados. */
  goOverride: number | null
  goFixado: boolean
  candidata: boolean
  escolhida: boolean
}

/** Opção de variante para o seletor editável (Nova Simulação) — id + texto a mostrar no dropdown. */
export interface VarianteOpcao {
  id: string
  label: string
}

/** Linha de referência (não é um produto) com o custo atual do cliente, mostrada sempre no fim da tabela. */
export interface LinhaAtual {
  precoMedio: number | null
  custoAtualIndefinido: boolean
}

export type ComercializadoraResolver = (productId: string) => string
/** Chaveado por lineKey, não productId — a comissão depende do GO, que agora varia por linha (ver Marcacoes.goOverride). */
export type ComissaoResolver = (lineKey: string) => ComissaoEstimada | null
export type VarianteLabelResolver = (variantId: string) => string | null
export type MarcacoesResolver = (lineKey: string) => Marcacoes | undefined

export function fromPricingResults(
  results: ProductPricingResult[],
  comercializadoraNome: ComercializadoraResolver,
  comissaoEstimada?: ComissaoResolver,
  varianteLabel?: VarianteLabelResolver,
  marcacoes?: MarcacoesResolver,
): NormalizedRow[] {
  return results.map((r) => {
    const lineKey = chaveLinha(r.product.id, r.variantId)
    const m = marcacoes?.(lineKey) ?? MARCACOES_PADRAO
    return {
      lineKey,
      productId: r.product.id,
      nome: r.product.nome,
      comercializadora: comercializadoraNome(r.product.id),
      tipo: r.product.tipo,
      precosPeriodo: r.precosPeriodo,
      componentesPeriodo: r.componentesPeriodo,
      potenciaEurDia: r.potenciaEurDia,
      precoMedioPonderado: r.precoMedioPonderado,
      poupancaEurMes: r.poupancaEurMes,
      poupancaEurAno: r.poupancaEurAno,
      poupancaPct: r.poupancaPct,
      custoAtualIndefinido: r.custoAtualIndefinido,
      alertaGo: r.alertaGo,
      prioridadeComissao: r.product.prioridade_comissao,
      comissaoEstimada: comissaoEstimada ? comissaoEstimada(lineKey) : null,
      variantId: r.variantId,
      varianteLabel: r.variantId && varianteLabel ? varianteLabel(r.variantId) : null,
      goOverride: m.goOverride,
      goFixado: m.goFixado,
      candidata: m.candidata,
      escolhida: m.escolhida,
    }
  })
}

/** A chamar sempre com linhas já normalizadas (ver normalizarResultados em simulationLines.ts) — simulações antigas sem candidata/escolhida/go_override por linha já chegam aqui com os valores derivados. */
export function fromStoredLines(lines: SimulationResultLine[], comercializadoraNome: ComercializadoraResolver): NormalizedRow[] {
  return lines.map((l) => ({
    lineKey: chaveDaLinha(l),
    productId: l.product_id,
    nome: l.produto_nome,
    comercializadora: comercializadoraNome(l.product_id),
    tipo: l.tipo,
    precosPeriodo: l.precos_periodo,
    componentesPeriodo: l.componentes_periodo ?? {},
    potenciaEurDia: l.potencia_eur_dia ?? 0,
    precoMedioPonderado: l.preco_medio_ponderado ?? null,
    poupancaEurMes: l.poupanca_eur_mes,
    poupancaEurAno: l.poupanca_eur_ano,
    poupancaPct: l.poupanca_pct,
    custoAtualIndefinido: l.custo_atual_indefinido,
    alertaGo: l.alerta_go,
    prioridadeComissao: l.prioridade_comissao,
    comissaoEstimada: null,
    variantId: l.variant_id,
    varianteLabel: l.variant_label,
    goOverride: l.go_override ?? null,
    goFixado: l.go_fixado ?? false,
    candidata: l.candidata ?? false,
    escolhida: l.escolhida ?? false,
  }))
}

function precoRepresentativo(r: NormalizedRow, tarOn: boolean): number | null {
  if (r.precoMedioPonderado != null) return tarOn ? r.precoMedioPonderado.comTar : r.precoMedioPonderado.semTar
  const valores = Object.values(r.precosPeriodo) as number[]
  return valores[0] ?? null
}

export function ResultsTable({
  resultados,
  comercializadoraNome,
  /** Lista canónica de períodos do esquema (ex: periodosDoEsquema('TRI_HORARIO')) — mostrada sempre por completo no detalhe. */
  periodos,
  linhaAtual,
  suggestedId,
  variantesPorProduto,
  onChangeVariante,
  tarOn,
  onChangeTarOn,
  onToggleCandidata,
  onToggleEscolhida,
  onChangeGoLinha,
  onFixarGoLinha,
  produtosComMaisVariantes,
  produtosExpandidos,
  onToggleVerMaisVariantes,
}: {
  resultados: ProductPricingResult[] | NormalizedRow[]
  comercializadoraNome: ComercializadoraResolver
  periodos: Periodo[]
  linhaAtual?: LinhaAtual
  suggestedId?: string | null
  /** Opções de variante por produto — só passar quando o seletor deve ser editável (Nova Simulação). */
  variantesPorProduto?: Map<string, VarianteOpcao[]>
  onChangeVariante?: (productId: string, variantId: string) => void
  /** Estado do toggle "Preço médio com TAR" — controlado pelo pai (em vez de estado interno) para
   * poder ser gravado com a simulação: os documentos (PDF) têm de refletir o mesmo estado que o
   * consultor viu no ecrã, ver Simulation.com_tar. */
  tarOn: boolean
  onChangeTarOn: (value: boolean) => void
  /** Presentes = mostra as colunas de marcação (⭐ candidata / ✓ escolhida) por linha. */
  onToggleCandidata?: (lineKey: string) => void
  onToggleEscolhida?: (lineKey: string) => void
  /** Presentes = mostra a coluna de GO por linha (slider + campo + "Fixar GO"), sempre visível na linha, nunca escondida atrás do "expandir" — só faz sentido onde há recálculo em tempo real (Nova Simulação/Editar). Cada linha tem o seu próprio GO, 100% independente das outras. */
  onChangeGoLinha?: (lineKey: string, value: number) => void
  onFixarGoLinha?: (lineKey: string) => void
  /** Produtos com mais do que 1 variante comparável — mostram o botão "Ver mais prazos/períodos". */
  produtosComMaisVariantes?: Set<string>
  /** Produtos atualmente expandidos (as variantes extra já estão em `resultados`, isto só controla o botão/rótulo). */
  produtosExpandidos?: Set<string>
  onToggleVerMaisVariantes?: (productId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const mostrarMarcacoes = !!onToggleCandidata || !!onToggleEscolhida
  const mostrarGoPorLinha = !!onChangeGoLinha

  const rows: NormalizedRow[] =
    resultados.length > 0 && 'product' in resultados[0]
      ? fromPricingResults(resultados as ProductPricingResult[], comercializadoraNome)
      : (resultados as NormalizedRow[])

  // A ordem já vem definida pelo motor (maior poupança % primeiro, empate por prioridade de
  // comissão) — a pesquisa só filtra, nunca reordena.
  const suggested = suggestedId ?? rows[0]?.lineKey
  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return r.nome.toLowerCase().includes(q) || r.comercializadora.toLowerCase().includes(q)
  })

  function toggleExpandido(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const numColunas = 5 + (mostrarGoPorLinha ? 1 : 0) + (mostrarMarcacoes ? 1 : 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Pesquisar por comercializadora ou produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <ToggleSwitch label="Preço médio com TAR" checked={tarOn} onChange={onChangeTarOn} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
            <tr>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Preço médio (€/kWh)</th>
              <th className="px-3 py-2 font-medium">Poupança/mês</th>
              <th className="px-3 py-2 font-medium">Poupança/ano</th>
              <th className="px-3 py-2 font-medium">Poupança (%)</th>
              {mostrarGoPorLinha && <th className="px-3 py-2 font-medium">GO (€/MWh)</th>}
              {mostrarMarcacoes && <th className="px-3 py-2 text-right font-medium">Marcação</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {filtered.map((r, index) => {
              const isSuggested = r.lineKey === suggested && index === 0
              const isExpanded = expandidos.has(r.lineKey)
              const preco = precoRepresentativo(r, tarOn)
              const temMaisVariantes = produtosComMaisVariantes?.has(r.productId) ?? false
              const expandidoVariantes = produtosExpandidos?.has(r.productId) ?? false
              // Só mostra "Ver mais" na 1ª linha visível desse produto — depois de expandido, cada
              // variante já aparece como a sua própria linha na tabela.
              const primeiraLinhaDoProduto = filtered.findIndex((x) => x.productId === r.productId) === index

              return (
                <Fragment key={r.lineKey}>
                  <tr
                    className={clsx(
                      'transition-colors duration-200',
                      r.escolhida
                        ? 'bg-brand/[0.08]'
                        : isSuggested && 'row-highlight',
                    )}
                  >
                    <td className="px-3 py-2.5 align-top">
                      <button type="button" onClick={() => toggleExpandido(r.lineKey)} className="flex w-full items-start gap-2 text-left">
                        <span aria-hidden className="mt-0.5 text-xs text-slate-400">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{r.comercializadora}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{r.nome}</span>
                            <Badge tone="neutral">{TIPO_LABEL[r.tipo]}</Badge>
                            {r.escolhida && (
                              <Badge tone="savings" bold>
                                Escolhido
                              </Badge>
                            )}
                            {r.candidata && !r.escolhida && <Badge tone="accent">Candidata</Badge>}
                            {r.alertaGo && <Badge tone="pending">GO acima do preço-limite</Badge>}
                          </div>
                        </div>
                      </button>
                      {(() => {
                        const opcoes = variantesPorProduto?.get(r.productId)
                        if (onChangeVariante && opcoes && opcoes.length > 0) {
                          return (
                            <select
                              value={r.variantId ?? ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onChangeVariante(r.productId, e.target.value)}
                              className="mt-1.5 rounded-md border border-slate-300 bg-surface-card px-2 py-1 text-xs dark:border-white/15 dark:bg-surface-dark-muted"
                            >
                              {opcoes.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          )
                        }
                        return r.varianteLabel ? <p className="mt-1 text-xs text-slate-400">{r.varianteLabel}</p> : null
                      })()}
                      {primeiraLinhaDoProduto && temMaisVariantes && onToggleVerMaisVariantes && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleVerMaisVariantes(r.productId)
                          }}
                          className="mt-1.5 block text-xs font-medium text-accent hover:underline"
                        >
                          {expandidoVariantes ? 'Ocultar outros prazos/períodos' : 'Ver mais prazos/períodos'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-numeric text-slate-700 dark:text-slate-200">
                      {preco != null ? formatEurPerKwh(preco) : '—'}
                    </td>
                    {r.custoAtualIndefinido ? (
                      <td colSpan={3} className="px-3 py-2.5 text-slate-400">
                        Sem comparação — insira o custo atual
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 font-numeric">
                          <span className={r.poupancaEurMes >= 0 ? 'text-savings dark:text-savings-dark' : 'text-danger'}>
                            {formatEur(r.poupancaEurMes)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-numeric">
                          <span className={r.poupancaEurAno >= 0 ? 'text-savings dark:text-savings-dark' : 'text-danger'}>
                            {formatEur(r.poupancaEurAno)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-numeric">
                          <span className={`font-semibold ${r.poupancaPct >= 0 ? 'text-savings dark:text-savings-dark' : 'text-danger'}`}>
                            {formatPct(r.poupancaPct)}
                          </span>
                        </td>
                      </>
                    )}
                    {mostrarGoPorLinha && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {r.tipo === 'FECHADO' || r.goOverride == null ? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        ) : r.goFixado ? (
                          <div className="flex items-center gap-2">
                            <Badge tone="savings" bold>
                              GO fixado: {r.goOverride}
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex min-w-[16rem] items-center gap-2">
                            <GoSlider value={r.goOverride} onChange={(v) => onChangeGoLinha?.(r.lineKey, v)} />
                            {onFixarGoLinha && (
                              <Button type="button" size="sm" variant="secondary" onClick={() => onFixarGoLinha(r.lineKey)}>
                                Fixar GO
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    {mostrarMarcacoes && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          {onToggleCandidata && (
                            <button
                              type="button"
                              title={r.candidata ? 'Remover candidata' : 'Marcar como candidata'}
                              onClick={() => onToggleCandidata(r.lineKey)}
                              className={clsx('text-xl leading-none', r.candidata ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600')}
                            >
                              {r.candidata ? '★' : '☆'}
                            </button>
                          )}
                          {onToggleEscolhida && (
                            <button
                              type="button"
                              title={r.escolhida ? 'Remover escolhida' : 'Marcar como escolhida'}
                              onClick={() => onToggleEscolhida(r.lineKey)}
                              className={clsx(
                                'flex h-6 w-6 items-center justify-center rounded-full border text-sm font-bold leading-none',
                                r.escolhida
                                  ? 'border-savings bg-savings text-white dark:border-savings-dark dark:bg-savings-dark'
                                  : 'border-slate-300 text-slate-300 hover:border-savings hover:text-savings dark:border-slate-600',
                              )}
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={numColunas} className="bg-surface-muted/40 px-4 py-4 dark:bg-surface-dark-muted/30">
                        <DetalhePeriodos row={r} periodos={periodos} tarOn={tarOn} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={numColunas} className="px-3 py-4 text-center text-slate-400">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
            {linhaAtual && (
              <tr className="opacity-50">
                <td className="px-3 py-2.5 italic text-slate-500 dark:text-slate-400">Valor atual do cliente</td>
                <td className="px-3 py-2.5 font-numeric text-slate-500 dark:text-slate-400">
                  {linhaAtual.precoMedio != null ? formatEurPerKwh(linhaAtual.precoMedio) : '—'}
                </td>
                <td colSpan={3} className="px-3 py-2.5 text-slate-400">
                  Referência — sem poupança aplicável
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DetalhePeriodos({ row, periodos, tarOn }: { row: NormalizedRow; periodos: Periodo[]; tarOn: boolean }) {
  return (
    <div className="space-y-3">
      <table className="w-full max-w-md text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-1 pr-4 font-medium">Período</th>
            <th className="py-1 font-medium">Preço</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
          {periodos.map((p) => {
            const comp = row.componentesPeriodo[p]
            return (
              <tr key={p}>
                <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">{periodoLabel(p)}</td>
                <td className="py-1.5 font-numeric text-slate-700 dark:text-slate-200">
                  {comp ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      <span>
                        <span className="text-xs text-slate-400">Energia: </span>
                        {formatEurPerKwh(comp.semTar)}
                      </span>
                      {tarOn && (
                        <span>
                          <span className="text-xs text-slate-400">TAR: </span>
                          {formatEurPerKwh(comp.tar)}
                        </span>
                      )}
                    </div>
                  ) : row.precosPeriodo[p] != null ? (
                    formatEurPerKwh(row.precosPeriodo[p]!)
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <span className="text-xs text-slate-400">Potência contratada (informativo, não entra na poupança): </span>
        {formatEur(row.potenciaEurDia, 4)} €/dia
      </p>
      {row.comissaoEstimada !== undefined && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="text-xs text-slate-400">Comissão estimada: </span>
          {!row.comissaoEstimada || row.comissaoEstimada.indefinida ? (
            <Badge tone="neutral">Não definida</Badge>
          ) : (
            formatEur(row.comissaoEstimada.valor)
          )}
        </p>
      )}
    </div>
  )
}
