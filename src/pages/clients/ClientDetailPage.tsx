import { Fragment, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useClient } from '@/hooks/useClients'
import { useInvoices } from '@/hooks/useInvoices'
import { useDeleteSimulation, useMarcarSimulacaoAtiva, useSimulations } from '@/hooks/useSimulations'
import { useContracts } from '@/hooks/useContracts'
import { useCatalog, useSuppliers } from '@/hooks/useCatalog'
import { usePontosConsumo } from '@/hooks/usePontosConsumo'
import { useToast } from '@/context/ToastContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge, EstadoContratoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DocumentsSection } from '@/components/DocumentsSection'
import { gerarDocumentoAprovacaoInterna, gerarPropostaPdf, type DocSimulacao } from '@/lib/pdf'
import { linhaEscolhidaDaSimulacao } from '@/lib/simulationLines'
import { formatDate } from '@/lib/format'
import type { EstadoSimulation, Simulation, SimulationResultLine } from '@/types/database'

const ESTADO_TONE: Record<EstadoSimulation, 'neutral' | 'pending' | 'savings' | 'accent'> = {
  RASCUNHO: 'pending',
  ENVIADA: 'neutral',
  CONVERTIDA: 'savings',
  PERDIDA: 'neutral',
}

/** Linha efetivamente escolhida (✓) de uma simulação — nunca a sugerida nem a primeira da lista: sem
 * escolha explícita devolve null e a UI mostra "Por escolher" (nunca apresenta a sugestão como decidida). */
function linhaDestaque(sim: Simulation): SimulationResultLine | null {
  return linhaEscolhidaDaSimulacao(sim)
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: client, isLoading } = useClient(id)
  const { data: invoices } = useInvoices(id)
  const { data: simulations } = useSimulations(id)
  const { data: contracts } = useContracts(id)
  const { data: catalog } = useCatalog()
  const { data: suppliers } = useSuppliers()
  const { data: pontosConsumo } = usePontosConsumo()
  const toast = useToast()
  const marcarAtiva = useMarcarSimulacaoAtiva()
  const deleteSimulation = useDeleteSimulation()

  // Seleção ao nível da simulação (não da CPE) — permite juntar no mesmo documento a ativa de uma CPE
  // e uma do histórico de outra, ou até 2 simulações da mesma CPE (ex: 12 e 24 meses lado a lado).
  const [simulacoesSelecionadas, setSimulacoesSelecionadas] = useState<Set<string>>(new Set())
  const [historicoExpandido, setHistoricoExpandido] = useState<Set<string>>(new Set())

  const pontosDoCliente = useMemo(
    () => (id ? (pontosConsumo ?? []).filter((p) => p.client_id === id) : []),
    [pontosConsumo, id],
  )

  // Uma CPE pode ter várias simulações (histórico/rascunhos), mas só 1 ativa — é essa que a linha da
  // CPE mostra e que os documentos usam. As restantes ficam disponíveis em "Ver histórico".
  const ativaPorPonto = useMemo(() => {
    const map = new Map<string, Simulation>()
    for (const s of simulations ?? []) if (s.ponto_consumo_id && s.ativa) map.set(s.ponto_consumo_id, s)
    return map
  }, [simulations])
  const historicoPorPonto = useMemo(() => {
    const map = new Map<string, Simulation[]>()
    for (const s of simulations ?? []) {
      if (!s.ponto_consumo_id || s.ativa) continue
      const lista = map.get(s.ponto_consumo_id) ?? []
      lista.push(s)
      map.set(s.ponto_consumo_id, lista)
    }
    for (const lista of map.values()) lista.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return map
  }, [simulations])

  function toggleHistorico(pontoId: string) {
    setHistoricoExpandido((prev) => {
      const next = new Set(prev)
      if (next.has(pontoId)) next.delete(pontoId)
      else next.add(pontoId)
      return next
    })
  }

  async function handleMarcarAtiva(sim: Simulation) {
    if (!sim.ponto_consumo_id) return
    await marcarAtiva.mutateAsync({ id: sim.id, pontoConsumoId: sim.ponto_consumo_id })
    toast.success('Simulação marcada como ativa.')
  }

  async function handleApagarDoHistorico(sim: Simulation) {
    if (!confirm('Tens a certeza? Esta ação não pode ser desfeita.')) return
    await deleteSimulation.mutateAsync(sim.id)
  }

  const comercializadoraNome = useMemo(() => {
    const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.nome]))
    const productSupplierId = new Map((catalog?.products ?? []).map((p) => [p.id, p.supplier_id]))
    return (productId: string) => {
      const supplierId = productSupplierId.get(productId)
      return supplierId ? (supplierById.get(supplierId) ?? 'Fornecedor removido') : 'Sem fornecedor'
    }
  }, [suppliers, catalog?.products])

  if (isLoading) return <p className="text-sm text-slate-400">A carregar…</p>
  if (!client) return <p className="text-sm text-slate-400">Cliente não encontrado.</p>

  function toggleSimulacao(simulationId: string) {
    setSimulacoesSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(simulationId)) next.delete(simulationId)
      else next.add(simulationId)
      return next
    })
  }
  // "Selecionar todas" só marca as ativas — o histórico é sempre opt-in à parte, uma a uma.
  const ativasSelecionaveis = pontosDoCliente.map((p) => ativaPorPonto.get(p.id)).filter((s): s is Simulation => !!s)
  const todasSelecionadas = ativasSelecionaveis.length > 0 && ativasSelecionaveis.every((s) => simulacoesSelecionadas.has(s.id))
  function toggleTodas() {
    setSimulacoesSelecionadas(todasSelecionadas ? new Set() : new Set(ativasSelecionaveis.map((s) => s.id)))
  }

  function docSimulacoes(): DocSimulacao[] {
    const pontoById = new Map(pontosDoCliente.map((p) => [p.id, p]))
    const simById = new Map((simulations ?? []).map((s) => [s.id, s]))
    return [...simulacoesSelecionadas]
      .map((simId) => {
        const simulation = simById.get(simId)
        if (!simulation) return null
        const pontoConsumo = simulation.ponto_consumo_id ? (pontoById.get(simulation.ponto_consumo_id) ?? null) : null
        return { simulation, pontoConsumo }
      })
      .filter((x): x is DocSimulacao => x !== null)
  }

  function gerarParaCliente() {
    if (!client) return
    const simulacoes = docSimulacoes()
    // Bloqueia por completo (nunca gera um documento parcial nem adivinha uma escolha) se alguma CPE
    // selecionada ainda não tiver nenhuma linha marcada como Escolhida — ver ponto 4 do redesenho.
    const semEscolha = simulacoes.filter((s) => !linhaEscolhidaDaSimulacao(s.simulation))
    if (semEscolha.length > 0) {
      const codigos = semEscolha.map((s) => s.pontoConsumo?.cpe ?? '—').join(', ')
      toast.error(
        semEscolha.length === 1
          ? `A CPE ${codigos} ainda não tem nenhuma linha marcada como Escolhida — marque uma opção na simulação antes de gerar o documento para o cliente.`
          : `${semEscolha.length} CPEs selecionadas ainda não têm uma linha marcada como Escolhida (${codigos}) — marque uma opção em cada uma antes de gerar o documento para o cliente.`,
      )
      return
    }
    void gerarPropostaPdf({
      client,
      simulacoes,
      comercializadoraNome,
      // Nunca o email da conta autenticada — só o texto livre associado ao cliente, em branco se não estiver preenchido.
      consultor: { nome: client.consultor_responsavel, contacto: null },
      tarTables: { tarEnergiaBtn: catalog?.tarEnergiaBtn ?? [], tarEnergiaBteMt: catalog?.tarEnergiaBteMt ?? [] },
    }).catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o documento para o cliente.'))
  }
  function gerarInterno() {
    if (!client) return
    const simulacoes = docSimulacoes()
    if (simulacoes.length > 0) void gerarDocumentoAprovacaoInterna({ client, simulacoes, comercializadoraNome })
  }

  const nSelecionadas = simulacoesSelecionadas.size

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{client.nome}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            NIF {client.nif ?? '—'} · {client.segmento_principal}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/faturas/nova?cliente=${client.id}`}>
            <Button variant="secondary">+ Fatura</Button>
          </Link>
          <Link to={`/simulacoes/nova?cliente=${client.id}`}>
            <Button>+ Simulação</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">Morada</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{client.morada ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Contacto</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{client.contacto ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">CUI (gás)</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{client.cui ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Consultor responsável</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{client.consultor_responsavel ?? '—'}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Pontos de Consumo (CPE)"
          subtitle={`${pontosDoCliente.length} CPE(s) · cada CPE tem 1 simulação ativa (as restantes ficam no histórico). Marque simulações — ativas ou do histórico, até mais do que uma da mesma CPE — para juntar num documento.`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={nSelecionadas === 0} onClick={gerarParaCliente}>
                Documento para o cliente ({nSelecionadas})
              </Button>
              <Button size="sm" variant="secondary" disabled={nSelecionadas === 0} onClick={gerarInterno}>
                Documento interno ({nSelecionadas})
              </Button>
            </div>
          }
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                <tr>
                  <th className="w-8 px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as CPEs com simulação"
                      checked={todasSelecionadas}
                      onChange={toggleTodas}
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">CPE</th>
                  <th className="px-5 py-3 font-medium">Morada</th>
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 font-medium">Poupança</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {pontosDoCliente.map((p) => {
                  const sim = ativaPorPonto.get(p.id)
                  const destaque = sim ? linhaDestaque(sim) : null
                  const historico = historicoPorPonto.get(p.id) ?? []
                  const expandido = historicoExpandido.has(p.id)
                  return (
                    <Fragment key={p.id}>
                      <tr>
                        <td className="px-5 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar simulação ativa da CPE ${p.cpe}`}
                            disabled={!sim}
                            checked={!!sim && simulacoesSelecionadas.has(sim.id)}
                            onChange={() => sim && toggleSimulacao(sim.id)}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-numeric">{p.cpe}</p>
                          {historico.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleHistorico(p.id)}
                              className="mt-0.5 text-xs font-medium text-accent hover:underline"
                            >
                              {expandido ? '▾' : '▸'} Ver histórico ({historico.length})
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3">{p.morada ?? '—'}</td>
                        {sim ? (
                          <>
                            <td className="px-5 py-3">
                              {destaque ? destaque.produto_nome : <Badge tone="pending">Por escolher</Badge>}
                            </td>
                            <td className="px-5 py-3 font-numeric">
                              {!destaque || destaque.custo_atual_indefinido ? '—' : `${destaque.poupanca_pct.toFixed(1)}%`}
                            </td>
                            <td className="px-5 py-3">
                              <Badge tone={ESTADO_TONE[sim.estado]}>{sim.estado}</Badge>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Link to={`/simulacoes/${sim.id}`} className="text-xs font-medium text-accent hover:underline">
                                Ver / refazer simulação
                              </Link>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-slate-400" colSpan={3}>
                              Sem simulação ativa
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Link
                                to={`/simulacoes/nova?cliente=${client.id}&cpe=${p.id}`}
                                className="text-xs font-medium text-accent hover:underline"
                              >
                                Nova simulação
                              </Link>
                            </td>
                          </>
                        )}
                      </tr>
                      {expandido && historico.length > 0 && (
                        <tr>
                          <td colSpan={7} className="bg-surface-muted/40 px-5 py-3 dark:bg-surface-dark-muted/30">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                              Histórico de simulações — {p.cpe}
                            </p>
                            <div className="space-y-2">
                              {historico.map((h) => {
                                const l = linhaDestaque(h)
                                return (
                                  <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-card px-3 py-2 text-sm dark:bg-surface-dark">
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        aria-label={`Selecionar simulação de ${formatDate(h.created_at)} da CPE ${p.cpe}`}
                                        checked={simulacoesSelecionadas.has(h.id)}
                                        onChange={() => toggleSimulacao(h.id)}
                                      />
                                      <div>
                                        <p className="text-slate-800 dark:text-slate-200">
                                          {l ? l.produto_nome : <Badge tone="pending">Por escolher</Badge>}
                                          {l && !l.custo_atual_indefinido && (
                                            <span className="ml-1.5 text-slate-400">· poupança {l.poupanca_pct.toFixed(1)}%</span>
                                          )}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                          {formatDate(h.created_at)} · <Badge tone={ESTADO_TONE[h.estado]}>{h.estado}</Badge>
                                        </p>
                                      </div>
                                    </label>
                                    <div className="flex items-center gap-3">
                                      <Link to={`/simulacoes/${h.id}`} className="text-xs font-medium text-accent hover:underline">
                                        Ver
                                      </Link>
                                      <button
                                        type="button"
                                        className="text-xs font-medium text-accent hover:underline"
                                        onClick={() => void handleMarcarAtiva(h)}
                                      >
                                        Marcar como ativa
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs font-medium text-danger hover:underline"
                                        onClick={() => void handleApagarDoHistorico(h)}
                                      >
                                        Apagar
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {pontosDoCliente.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                      Sem CPEs associadas. Associe na lista de Pontos de Consumo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Faturas / Consumo atual" subtitle={`${invoices?.length ?? 0} registo(s)`} />
        <CardBody className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Fornecedor atual</th>
                <th className="px-5 py-3 font-medium">Esquema</th>
                <th className="px-5 py-3 font-medium">Potência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {(invoices ?? []).map((inv) => (
                <tr key={inv.id}>
                  <td className="px-5 py-3">{formatDate(inv.data_fatura)}</td>
                  <td className="px-5 py-3">{inv.fornecedor_atual ?? '—'}</td>
                  <td className="px-5 py-3">{inv.esquema_horario}</td>
                  <td className="px-5 py-3 font-numeric">{inv.potencia_contratada_kva ?? '—'} kVA</td>
                </tr>
              ))}
              {(invoices?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                    Sem faturas registadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contratos" subtitle={`${contracts?.length ?? 0} registo(s)`} />
        <CardBody className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Início</th>
                <th className="px-5 py-3 font-medium">Fim</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {(contracts ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">{formatDate(c.data_inicio)}</td>
                  <td className="px-5 py-3">{formatDate(c.data_fim)}</td>
                  <td className="px-5 py-3">
                    <EstadoContratoBadge estado={c.estado} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/contratos/${c.id}`} className="text-xs font-medium text-accent hover:underline">
                      Ver contrato
                    </Link>
                  </td>
                </tr>
              ))}
              {(contracts?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                    Sem contratos registados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documentos" subtitle="Contratos assinados, faturas, documentos de identificação" />
        <CardBody>
          <DocumentsSection entityType="client" entityId={client.id} />
        </CardBody>
      </Card>
    </div>
  )
}
