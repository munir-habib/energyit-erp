import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useClient } from '@/hooks/useClients'
import { useContract, useUpdateContract, useRealSavings } from '@/hooks/useContracts'
import { useProduct, useCommissionRules } from '@/hooks/useCatalog'
import { useCommissionForContract, useCreateCommission } from '@/hooks/useCommissions'
import { useAlertsForEntity, useDismissAlert } from '@/hooks/useAlerts'
import { AlertForm } from '@/components/AlertForm'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select, Input, FormRow } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { EstadoContratoBadge, EstadoComissaoBadge } from '@/components/ui/Badge'
import { formatDate, formatEur, formatEurPerKwh, formatPct } from '@/lib/format'
import { periodoLabel } from '@/components/PeriodoInputs'
import { anualizarConsumo, calcularComissao } from '@/lib/pricingEngine'
import { goDaLinhaDoContrato } from '@/lib/contractLine'
import { useSimulation } from '@/hooks/useSimulations'
import { RealSavingForm } from '@/pages/contracts/RealSavingForm'
import { DocumentsSection } from '@/components/DocumentsSection'
import type { EstadoContrato, Periodo } from '@/types/database'

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: contract, isLoading } = useContract(id)
  const { data: client } = useClient(contract?.client_id)
  const { data: product } = useProduct(contract?.product_id)
  const { data: rules } = useCommissionRules()
  // Só para contratos antigos (sem GO congelado): o GO vem da linha escolhida da simulação de origem.
  const precisaSimulacao = !!contract && contract.precos_congelados.go_override === undefined
  const { data: simulacaoOrigem } = useSimulation(precisaSimulacao ? (contract?.simulation_id ?? undefined) : undefined)
  const { data: alerts } = useAlertsForEntity('CONTRACT', contract?.id)
  const dismissAlert = useDismissAlert()
  const { data: existingCommission } = useCommissionForContract(id)
  const { data: realSavings } = useRealSavings(id)
  const updateContract = useUpdateContract()
  const createCommission = useCreateCommission()
  const [showRealSavingForm, setShowRealSavingForm] = useState(false)
  const [goManual, setGoManual] = useState('')

  if (isLoading) return <p className="text-sm text-slate-400">A carregar…</p>
  if (!contract || !client) return <p className="text-sm text-slate-400">Contrato não encontrado.</p>

  const precos = contract.precos_congelados
  const periodos = Object.keys(precos.precos_periodo ?? {}) as Periodo[]
  const consumoAnualKwh = Object.values(anualizarConsumo(precos.consumo_periodo ?? {}, precos.dias_faturados)).reduce(
    (s, v) => s + (v ?? 0),
    0,
  )

  // GO fixado/negociado na linha escolhida — nunca o GO por omissão do catálogo (ver contractLine.ts).
  const goDaLinha = goDaLinhaDoContrato(contract, simulacaoOrigem)
  const goDesconhecido = !!product && product.tipo !== 'FECHADO' && goDaLinha == null

  async function handleAtribuirGoManual() {
    const go = Number(goManual.replace(',', '.'))
    if (!contract || Number.isNaN(go)) return
    await updateContract.mutateAsync({
      id: contract.id,
      values: { precos_congelados: { ...contract.precos_congelados, go_override: go, go_fixado: true } },
    })
    setGoManual('')
  }

  async function handleGerarComissao() {
    if (!product || !rules || goDesconhecido) return
    const calc = calcularComissao(product, rules, consumoAnualKwh, contract!.data_inicio, goDaLinha ?? undefined)
    await createCommission.mutateAsync({
      contract_id: contract!.id,
      consumo_anual_kwh: consumoAnualKwh,
      go_aplicado: calc.goAplicado,
      multiplicador_aplicado: calc.multiplicadorAplicado,
      regra_id: calc.regraId,
      valor: calc.valor,
      estado: 'NAO_PAGO',
      data_pagamento: null,
    })
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contrato — {client.nome}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{precos.produto_nome}</p>
        </div>
        <EstadoContratoBadge estado={contract.estado} />
      </div>

      <Card>
        <CardHeader title="Detalhes" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Início</p>
              <p className="text-sm font-medium">{formatDate(contract.data_inicio)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Fim</p>
              <p className="text-sm font-medium">{formatDate(contract.data_fim)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Potência</p>
              <p className="text-sm font-medium font-numeric">{contract.potencia_contratada_kva ?? '—'} kVA</p>
            </div>
          </div>

          <FormRow label="Estado do contrato">
            <Select
              value={contract.estado}
              onChange={(e) => updateContract.mutate({ id: contract.id, values: { estado: e.target.value as EstadoContrato } })}
              className="max-w-xs"
            >
              <option value="ATIVO">Ativo</option>
              <option value="TERMINADO">Terminado</option>
              <option value="CANCELADO">Cancelado</option>
            </Select>
          </FormRow>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Preços congelados na data do contrato</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {periodos.map((p) => (
                <div key={p} className="rounded-lg bg-surface-muted px-3 py-2 dark:bg-surface-dark-muted">
                  <p className="text-[11px] text-slate-400">{periodoLabel(p)}</p>
                  <p className="font-numeric text-sm font-medium">{formatEurPerKwh(precos.precos_periodo[p] ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-6 text-sm">
            <p>
              Custo de energia do período: <span className="font-numeric font-medium">{formatEur(precos.custo_energia_periodo)}</span>
            </p>
            <p className="text-savings dark:text-savings-dark">
              Poupança estimada:{' '}
              <span className="font-numeric font-semibold">
                {formatEur(precos.poupanca_eur_ano)} / ano ({formatPct(precos.poupanca_pct)})
              </span>
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Poupança real"
          subtitle="Ao fim do período contratado, compare o consumo real faturado com o que o cliente pagaria antes"
          action={
            <Button size="sm" variant="secondary" onClick={() => setShowRealSavingForm((s) => !s)}>
              {showRealSavingForm ? 'Cancelar' : '+ Registar'}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {showRealSavingForm && (
            <RealSavingForm contract={contract} onDone={() => setShowRealSavingForm(false)} />
          )}
          {(realSavings ?? []).map((rs) => (
            <div key={rs.id} className="rounded-lg border border-slate-200/70 p-3 text-sm dark:border-white/10">
              <div className="flex justify-between">
                <span className="text-slate-500">{rs.periodo_referencia ?? formatDate(rs.created_at)}</span>
                <span
                  className={`font-numeric font-semibold ${rs.poupanca_real_eur >= 0 ? 'text-savings dark:text-savings-dark' : 'text-danger'}`}
                >
                  {formatEur(rs.poupanca_real_eur)} ({formatPct(rs.poupanca_real_pct)})
                </span>
              </div>
            </div>
          ))}
          {(realSavings?.length ?? 0) === 0 && !showRealSavingForm && (
            <p className="text-sm text-slate-400">Ainda sem registos de poupança real.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Comissão" />
        <CardBody className="space-y-3">
          {existingCommission ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-numeric text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatEur(existingCommission.valor)}
                </p>
                <p className="text-xs text-slate-400">
                  {existingCommission.go_aplicado != null
                    ? `GO ${existingCommission.go_aplicado} × multiplicador ${existingCommission.multiplicador_aplicado}`
                    : 'Comissão fixa do produto fechado'}
                </p>
              </div>
              <EstadoComissaoBadge estado={existingCommission.estado} />
            </div>
          ) : (
            <>
              <Alert tone="info">
                Comissão ainda não calculada para este contrato. Consumo anual considerado: {consumoAnualKwh.toLocaleString('pt-PT')} kWh.
              </Alert>
              {goDesconhecido && (
                <Alert tone="warning">
                  <p>
                    GO não determinado para este contrato — contrato antigo sem GO congelado e sem a simulação de origem
                    com esse GO. Por segurança, a comissão não é calculada com o GO por omissão do catálogo.
                  </p>
                  <p className="mt-1">Reatribua manualmente o GO negociado para poder calcular a comissão:</p>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="w-32">
                      <Input
                        numeric
                        placeholder="GO €/MWh"
                        value={goManual}
                        onChange={(e) => setGoManual(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleAtribuirGoManual}
                      disabled={goManual.trim() === '' || Number.isNaN(Number(goManual.replace(',', '.'))) || updateContract.isPending}
                    >
                      {updateContract.isPending ? 'A guardar…' : 'Atribuir GO'}
                    </Button>
                  </div>
                </Alert>
              )}
              <Button onClick={handleGerarComissao} disabled={!product || goDesconhecido || createCommission.isPending}>
                {createCommission.isPending ? 'A calcular…' : 'Calcular comissão'}
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Alertas de renovação" subtitle="Recebe um aviso antes do fim do contrato" />
        <CardBody className="space-y-3">
          {(alerts ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm dark:bg-surface-dark-muted">
              <span>Aviso em {formatDate(a.data_alvo)}</span>
              <Button size="sm" variant="ghost" onClick={() => dismissAlert.mutate(a.id)}>
                Marcar como visto
              </Button>
            </div>
          ))}
          {contract.data_fim ? (
            <AlertForm
              entityType="CONTRACT"
              entityId={contract.id}
              options={[
                {
                  tipo: 'DIAS_ANTES_RENOVACAO',
                  label: 'X dias antes da renovação',
                  computeDataAlvo: (dias) => {
                    const d = new Date(contract.data_fim as string)
                    d.setDate(d.getDate() - dias)
                    return d.toISOString().slice(0, 10)
                  },
                },
              ]}
            />
          ) : (
            <p className="text-sm text-slate-400">Este contrato não tem data de fim definida.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documentos" subtitle="Contrato assinado, faturas, comprovativos" />
        <CardBody>
          <DocumentsSection entityType="contract" entityId={contract.id} />
        </CardBody>
      </Card>
    </div>
  )
}
