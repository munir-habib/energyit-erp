import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDefinirDataRenovacao, usePeriodosContrato, usePontoConsumo } from '@/hooks/usePontosConsumo'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DiasRenovacaoBadge, EstadoPontoConsumoBadge } from '@/components/ui/Badge'
import { InlineDateInput } from '@/components/ui/InlineDateInput'
import { diasAteRenovacao } from '@/lib/pontoConsumo'
import { formatDate } from '@/lib/format'
import { RenovacaoModal } from '@/pages/pontosConsumo/RenovacaoModal'

export function PontoConsumoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ponto, isLoading } = usePontoConsumo(id)
  const { data: periodos, isLoading: periodosLoading } = usePeriodosContrato(id)
  const definirDataRenovacao = useDefinirDataRenovacao()
  const [renovacaoOpen, setRenovacaoOpen] = useState(false)

  if (isLoading) return <p className="text-sm text-slate-400">A carregar…</p>
  if (!ponto) return <p className="text-sm text-slate-400">Ponto de consumo não encontrado.</p>

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link to="/pontos-consumo" className="text-xs font-medium text-accent hover:underline">
          ← Pontos de Consumo
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-numeric text-xl font-semibold text-slate-900 dark:text-slate-100">{ponto.cpe}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{ponto.cliente}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ponto.client_id && (
            <Link to={`/simulacoes/nova?cliente=${ponto.client_id}&cpe=${ponto.id}`}>
              <Button variant="secondary">+ Nova simulação</Button>
            </Link>
          )}
          <Button onClick={() => setRenovacaoOpen(true)}>+ Nova Renovação</Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Dados atuais" subtitle="Do período de contrato mais recente" />
        <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">NIF</p>
            <p className="font-numeric text-slate-900 dark:text-slate-100">{ponto.nif ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Cliente associado</p>
            {ponto.client_id ? (
              <Link to={`/clientes/${ponto.client_id}`} className="text-accent hover:underline">
                {ponto.cliente}
              </Link>
            ) : (
              <p className="text-slate-900 dark:text-slate-100">{ponto.cliente} <span className="text-xs text-slate-400">(sem ficha)</span></p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400">Morada</p>
            <p className="text-slate-900 dark:text-slate-100">{ponto.morada ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Estado</p>
            <EstadoPontoConsumoBadge estado={ponto.estado} />
          </div>
          <div>
            <p className="text-xs text-slate-400">Potência contratada</p>
            <p className="text-slate-900 dark:text-slate-100">{ponto.potencia_contratada != null ? `${ponto.potencia_contratada} kVA` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Consumo anual</p>
            <p className="text-slate-900 dark:text-slate-100">{ponto.consumo_anual != null ? `${ponto.consumo_anual.toLocaleString('pt-PT')} kWh` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Data de início</p>
            <p className="text-slate-900 dark:text-slate-100">{formatDate(ponto.data_ativacao)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Data de renovação</p>
            <div className="-ml-2 flex flex-wrap items-center gap-2">
              <InlineDateInput
                value={ponto.data_fim_contrato}
                onSave={(dataFim) =>
                  void definirDataRenovacao.mutateAsync({ pontoConsumoId: ponto.id, dataFim })
                }
              />
              <DiasRenovacaoBadge dias={diasAteRenovacao(ponto)} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              A edição substitui o valor atual (importado ou manual). Os alertas recalculam de imediato.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Histórico de períodos de contrato" subtitle={`${ponto.num_periodos} período(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Início</th>
                <th className="px-5 py-3 font-medium">Fim</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Potência</th>
                <th className="px-5 py-3 font-medium">Consumo Anual</th>
                <th className="px-5 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {periodosLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}
              {!periodosLoading && (periodos?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    Nenhum período de contrato registado.
                  </td>
                </tr>
              )}
              {periodos?.map((per) => (
                <tr key={per.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-5 py-3">{formatDate(per.data_inicio)}</td>
                  <td className="px-5 py-3">{formatDate(per.data_fim)}</td>
                  <td className="px-5 py-3">
                    <EstadoPontoConsumoBadge estado={per.estado} />
                  </td>
                  <td className="px-5 py-3">{per.potencia_contratada != null ? `${per.potencia_contratada} kVA` : '—'}</td>
                  <td className="px-5 py-3">{per.consumo_anual != null ? `${per.consumo_anual.toLocaleString('pt-PT')} kWh` : '—'}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(per.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {renovacaoOpen && <RenovacaoModal ponto={ponto} onClose={() => setRenovacaoOpen(false)} />}
    </div>
  )
}
