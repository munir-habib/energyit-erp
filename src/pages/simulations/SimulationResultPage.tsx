import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCreateSimulation, useDeleteSimulation, useSimulation, useUpdateSimulation } from '@/hooks/useSimulations'
import { useClient, useClients, useSaveClient } from '@/hooks/useClients'
import { useAlertsForEntity, useDismissAlert } from '@/hooks/useAlerts'
import { useCatalog, useSuppliers } from '@/hooks/useCatalog'
import { usePontoConsumo } from '@/hooks/usePontosConsumo'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import { AlertForm } from '@/components/AlertForm'
import { DocumentsSection } from '@/components/DocumentsSection'
import { RecommendationBanner } from '@/components/RecommendationBanner'
import { ResultsTable, fromStoredLines } from '@/pages/simulations/ResultsTable'
import { periodosDoEsquema } from '@/lib/pricingEngine'
import {
  alternarCandidata,
  chaveDaLinha,
  linhaEscolhidaDaSimulacao,
  linhasCandidatasDaSimulacao,
  marcarEscolhida,
  normalizarResultados,
} from '@/lib/simulationLines'
import { useGerarDocumentosSimulacao } from '@/hooks/useGerarDocumentosSimulacao'
import { useToast } from '@/context/ToastContext'
import { formatDate } from '@/lib/format'
import type { SimulationResultLine } from '@/types/database'

function addDias(base: Date, dias: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function AssociarClienteInline({ simulationId }: { simulationId: string }) {
  const { data: clients } = useClients()
  const saveClient = useSaveClient()
  const updateSimulation = useUpdateSimulation()
  const [selecionado, setSelecionado] = useState('')
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')

  async function associar(clientId: string) {
    await updateSimulation.mutateAsync({ id: simulationId, values: { client_id: clientId } })
  }

  async function criarEAssociar() {
    if (!nome.trim()) return
    const id = await saveClient.mutateAsync({
      values: {
        nome: nome.trim(),
        nif: null,
        morada: null,
        contacto: null,
        cui: null,
        grupo_id: null,
        segmento_principal: 'BTN',
        consultor_responsavel: null,
      },
    })
    await associar(id)
  }

  return (
    <Alert tone="warning" title="Sem cliente associado">
      <p className="mb-2">Esta simulação começou sem cliente. Associe ou crie um antes de fechar contrato.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selecionado} onChange={(e) => setSelecionado(e.target.value)} className="max-w-xs">
          <option value="">Selecionar cliente existente…</option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        <Button size="sm" disabled={!selecionado} onClick={() => void associar(selecionado)}>
          Associar
        </Button>
        {criando ? (
          <>
            <input
              className="rounded-lg border border-slate-300 bg-surface-card px-3 py-2 text-sm dark:border-white/10 dark:bg-surface-dark-muted"
              placeholder="Nome do novo cliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Button size="sm" disabled={!nome.trim()} onClick={() => void criarEAssociar()}>
              Criar e associar
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setCriando(true)}>
            + Novo cliente
          </Button>
        )}
      </div>
    </Alert>
  )
}

export function SimulationResultPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: simulation, isLoading } = useSimulation(id)
  const { data: client } = useClient(simulation?.client_id ?? undefined)
  const { data: pontoConsumo } = usePontoConsumo(simulation?.ponto_consumo_id ?? undefined)
  const updateSimulation = useUpdateSimulation()
  const deleteSimulation = useDeleteSimulation()
  const createSimulation = useCreateSimulation()
  const { data: alerts } = useAlertsForEntity('SIMULATION', simulation?.id)
  const dismissAlert = useDismissAlert()
  const { data: catalog } = useCatalog()
  const { data: suppliers } = useSuppliers()

  // Toggle "Preço médio com TAR" — inicializado a partir do que já está gravado na simulação
  // (Simulation.com_tar) e sincronizado sempre que os dados chegam/mudam.
  const [tarOn, setTarOn] = useState(true)
  const [gerando, setGerando] = useState<'cliente' | 'interno' | null>(null)
  const toast = useToast()
  const { gerarDocumentoCliente, gerarDocumentoInterno } = useGerarDocumentosSimulacao()
  useEffect(() => {
    if (simulation) setTarOn(simulation.com_tar)
  }, [simulation])

  const comercializadoraNome = useMemo(() => {
    const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.nome]))
    const productSupplierId = new Map((catalog?.products ?? []).map((p) => [p.id, p.supplier_id]))
    return (productId: string) => {
      const supplierId = productSupplierId.get(productId)
      return supplierId ? (supplierById.get(supplierId) ?? 'Fornecedor removido') : 'Sem fornecedor'
    }
  }, [suppliers, catalog?.products])

  if (isLoading) return <p className="text-sm text-slate-400">A carregar…</p>
  if (!simulation || (simulation.client_id && !client)) return <p className="text-sm text-slate-400">Simulação não encontrada.</p>

  const escolhido = linhaEscolhidaDaSimulacao(simulation)
  const linhasNormalizadas = fromStoredLines(normalizarResultados(simulation), comercializadoraNome)
  const periodos = periodosDoEsquema(simulation.esquema_horario)
  const consumoTotal = (Object.values(simulation.consumo_periodo) as number[]).reduce((s, v) => s + (v ?? 0), 0)
  const primeiraLinha = simulation.resultados[0]
  const custoAtualPeriodo = primeiraLinha ? primeiraLinha.poupanca_eur_periodo + primeiraLinha.custo_energia_periodo : 0

  /** Marca/desmarca a linha escolhida (✓) diretamente sobre os resultados gravados — sem recálculo,
   * são só as decisões do consultor. Mantém produto_escolhido_id sincronizado como cache de leitura
   * rápida (ContractNewPage/SimulationsListPage continuam a lê-lo). */
  async function handleToggleEscolhida(lineKey: string) {
    const jaEraEscolhida = linhaEscolhidaDaSimulacao(simulation!)
    const novos: SimulationResultLine[] =
      jaEraEscolhida && chaveDaLinha(jaEraEscolhida) === lineKey
        ? normalizarResultados(simulation!).map((l) => ({ ...l, escolhida: false }))
        : marcarEscolhida(simulation!.resultados, simulation!.go_override, simulation!.produto_escolhido_id, lineKey)
    const novaEscolhida = novos.find((l) => l.escolhida) ?? null
    await updateSimulation.mutateAsync({
      id: simulation!.id,
      values: { resultados: novos, produto_escolhido_id: novaEscolhida?.product_id ?? null },
    })
  }

  /** Marca/desmarca candidata (⭐) — sem limite, não mexe na escolhida. */
  async function handleToggleCandidata(lineKey: string) {
    const novos = alternarCandidata(simulation!.resultados, simulation!.go_override, simulation!.produto_escolhido_id, lineKey)
    await updateSimulation.mutateAsync({ id: simulation!.id, values: { resultados: novos } })
  }

  async function handleMarcarEnviada() {
    await updateSimulation.mutateAsync({
      id: simulation!.id,
      values: { estado: 'ENVIADA', enviada_em: new Date().toISOString() },
    })
  }

  async function handleApagar() {
    if (!confirm('Tens a certeza? Esta ação não pode ser desfeita.')) return
    const destino = simulation!.client_id ? `/clientes/${simulation!.client_id}` : '/simulacoes'
    await deleteSimulation.mutateAsync(simulation!.id)
    navigate(destino)
  }

  /** Cópia completa desta simulação (mesma CPE/consumo/preço atual/GO/seleção de produtos), como
   * rascunho inativo — nunca mexe na original, que continua ativa e intacta. Abre a cópia em modo de
   * edição para o consultor testar variações (ex: mudar o prazo de um produto). */
  async function handleDuplicar() {
    if (!simulation) return
    const { id: _id, owner_id: _owner, created_at: _c, updated_at: _u, ...dados } = simulation
    const novoId = await createSimulation.mutateAsync({ ...dados, ativa: false, estado: 'RASCUNHO', enviada_em: null })
    navigate(`/simulacoes/nova?editar=${novoId}`)
  }

  /** Antes de gerar o PDF, grava o estado atual do toggle "Com TAR" (se mudou desde a última vez) —
   * os documentos têm de apresentar os preços tal como o consultor os está a ver agora, não o que
   * ficou gravado da última vez. */
  async function handleGerarPdf() {
    if (!client || !simulation) return
    setGerando('cliente')
    try {
      if (tarOn !== simulation.com_tar) {
        await updateSimulation.mutateAsync({ id: simulation.id, values: { com_tar: tarOn } })
      }
      await gerarDocumentoCliente({
        client,
        simulation: { ...simulation, com_tar: tarOn },
        pontoConsumo: pontoConsumo ?? null,
        comercializadoraNome,
        tarTables: { tarEnergiaBtn: catalog?.tarEnergiaBtn ?? [], tarEnergiaBteMt: catalog?.tarEnergiaBteMt ?? [] },
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o documento para o cliente.')
    } finally {
      setGerando(null)
    }
  }

  async function handleGerarInterno() {
    if (!client || !simulation) return
    setGerando('interno')
    try {
      await gerarDocumentoInterno({ client, simulation, pontoConsumo: pontoConsumo ?? null, comercializadoraNome })
    } finally {
      setGerando(null)
    }
  }

  /** "Anular" do envio — volta a RASCUNHO (o sistema de toasts não tem botões de ação, por isso vive aqui). */
  async function handleVoltarRascunho() {
    await updateSimulation.mutateAsync({ id: simulation!.id, values: { estado: 'RASCUNHO', enviada_em: null } })
    toast.info('Simulação voltou a Rascunho.')
  }

  const temCandidata = linhasCandidatasDaSimulacao(simulation).length > 0
  const faltaCliente: string[] = []
  if (simulation.resultados.length === 0) faltaCliente.push('produtos comparáveis')
  if (!client) faltaCliente.push('associar cliente')
  if (!escolhido) faltaCliente.push('marcar uma linha como escolhida')
  const faltaInterno: string[] = []
  if (!client) faltaInterno.push('associar cliente')
  if (!temCandidata) faltaInterno.push('marcar pelo menos uma candidata')

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Simulação {client ? `— ${client.nome}` : '(sem cliente)'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {simulation.segmento} · {formatDate(simulation.created_at)}
          </p>
          {simulation.client_id && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="text-xs text-slate-400">CPE: </span>
              {pontoConsumo?.cpe ?? '— (simulação sem CPE)'}
              {pontoConsumo?.morada ? ` · ${pontoConsumo.morada}` : ''}
            </p>
          )}
          <div className="mt-1">
            <Badge tone={simulation.estado === 'CONVERTIDA' ? 'accent' : simulation.estado === 'ENVIADA' ? 'neutral' : 'neutral'}>
              {simulation.estado}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={faltaCliente.length > 0 || gerando !== null}
              title={faltaCliente.length > 0 ? `Falta: ${faltaCliente.join(' · ')}` : undefined}
              onClick={() => void handleGerarPdf()}
            >
              {gerando === 'cliente' ? 'A gerar…' : 'Gerar PDF'}
            </Button>
            <Button
              variant="secondary"
              disabled={faltaInterno.length > 0 || gerando !== null}
              title={faltaInterno.length > 0 ? `Falta: ${faltaInterno.join(' · ')}` : undefined}
              onClick={() => void handleGerarInterno()}
            >
              {gerando === 'interno' ? 'A gerar…' : 'Documento interno'}
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/simulacoes/nova?editar=${simulation.id}`)}>
              Editar simulação
            </Button>
            <Button variant="secondary" onClick={() => void handleDuplicar()}>
              Duplicar simulação
            </Button>
            {simulation.estado === 'RASCUNHO' && (
              <Button variant="secondary" onClick={() => void handleMarcarEnviada()}>
                Marcar como enviada
              </Button>
            )}
            {simulation.estado === 'ENVIADA' && (
              <Button variant="ghost" disabled={updateSimulation.isPending} onClick={() => void handleVoltarRascunho()}>
                Voltar a rascunho
              </Button>
            )}
            {escolhido && client && (
              <Button onClick={() => navigate(`/contratos/novo?simulacao=${simulation.id}`)}>Criar contrato</Button>
            )}
            <Button variant="danger" disabled={deleteSimulation.isPending} onClick={() => void handleApagar()}>
              {deleteSimulation.isPending ? 'A apagar…' : 'Apagar simulação'}
            </Button>
          </div>
          {(faltaCliente.length > 0 || faltaInterno.length > 0) && (
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              {faltaCliente.length > 0 && <p>Gerar PDF — falta: {faltaCliente.join(' · ')}</p>}
              {faltaInterno.length > 0 && <p>Documento interno — falta: {faltaInterno.join(' · ')}</p>}
            </div>
          )}
        </div>
      </div>

      {!simulation.client_id && <AssociarClienteInline simulationId={simulation.id} />}

      <Card>
        <CardHeader
          title="Comparação de produtos"
          subtitle="⭐ marca candidatas (entram no Documento Interno) · ✓ marca a escolhida (vai para o Documento do Cliente) — a decisão é sempre sua"
        />
        <CardBody className="space-y-4">
          {simulation.resultados.length === 0 ? (
            <Alert tone="warning">Esta simulação não tem produtos comparáveis para o esquema/segmento indicado.</Alert>
          ) : (
            <>
              <RecommendationBanner rows={linhasNormalizadas} onMarcarEscolhida={(k) => void handleToggleEscolhida(k)} />
              <ResultsTable
                resultados={linhasNormalizadas}
                comercializadoraNome={comercializadoraNome}
                periodos={periodos}
                linhaAtual={{
                  precoMedio: consumoTotal > 0 ? custoAtualPeriodo / consumoTotal : null,
                  custoAtualIndefinido: custoAtualPeriodo <= 0,
                }}
                suggestedId={simulation.produto_sugerido_id}
                onToggleCandidata={(k) => void handleToggleCandidata(k)}
                onToggleEscolhida={(k) => void handleToggleEscolhida(k)}
                tarOn={tarOn}
                onChangeTarOn={setTarOn}
              />
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Fatura do cliente" subtitle="Ficheiro da fatura usada nesta simulação — referência para comparar mais tarde com a poupança real" />
        <CardBody>
          <DocumentsSection entityType="simulation" entityId={simulation.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Alertas" subtitle="Define um lembrete para fazeres follow-up desta proposta" />
        <CardBody className="space-y-3">
          {(alerts ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm dark:bg-surface-dark-muted">
              <span>Aviso em {formatDate(a.data_alvo)}</span>
              <Button size="sm" variant="ghost" onClick={() => dismissAlert.mutate(a.id)}>
                Marcar como visto
              </Button>
            </div>
          ))}
          <AlertForm
            entityType="SIMULATION"
            entityId={simulation.id}
            options={[
              {
                tipo: 'DIAS_APOS_ENVIO',
                label: 'X dias depois de enviada',
                computeDataAlvo: (dias) => addDias(new Date(simulation.enviada_em ?? Date.now()), dias),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  )
}
