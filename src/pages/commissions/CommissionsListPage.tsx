import { useMemo } from 'react'
import { useCommissions, useSetCommissionPaid } from '@/hooks/useCommissions'
import { useContracts } from '@/hooks/useContracts'
import { useClients } from '@/hooks/useClients'
import { Card, CardBody } from '@/components/ui/Card'
import { EstadoComissaoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ExportButtons } from '@/components/ExportButtons'
import { formatDate, formatEur } from '@/lib/format'

export function CommissionsListPage() {
  const { data: commissions, isLoading } = useCommissions()
  const { data: contracts } = useContracts()
  const { data: clients } = useClients()
  const setPaid = useSetCommissionPaid()

  const clientNameForContract = (contractId: string) => {
    const contract = contracts?.find((c) => c.id === contractId)
    return clients?.find((c) => c.id === contract?.client_id)?.nome ?? '—'
  }

  const totals = useMemo(() => {
    const pendente = (commissions ?? []).filter((c) => c.estado === 'NAO_PAGO').reduce((s, c) => s + c.valor, 0)
    const pago = (commissions ?? []).filter((c) => c.estado === 'PAGO').reduce((s, c) => s + c.valor, 0)
    return { pendente, pago }
  }, [commissions])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Comissões</h1>
        <ExportButtons
          filename="Comissoes"
          headers={['Cliente', 'Data', 'Consumo anual (kWh)', 'Valor', 'Estado']}
          rows={(commissions ?? []).map((c) => [
            clientNameForContract(c.contract_id),
            c.created_at,
            c.consumo_anual_kwh ?? '',
            c.valor,
            c.estado,
          ])}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-400">Total pendente</p>
            <p className="commission-value text-2xl font-semibold">{formatEur(totals.pendente)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-400">Total pago</p>
            <p className="commission-value text-2xl font-semibold">{formatEur(totals.pago)}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Consumo anual</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}
              {(commissions ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{clientNameForContract(c.contract_id)}</td>
                  <td className="px-5 py-3">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3 font-numeric">{c.consumo_anual_kwh?.toLocaleString('pt-PT') ?? '—'} kWh</td>
                  <td className="px-5 py-3 commission-value font-semibold">{formatEur(c.valor)}</td>
                  <td className="px-5 py-3">
                    <EstadoComissaoBadge estado={c.estado} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPaid.mutate({ id: c.id, estado: c.estado === 'PAGO' ? 'NAO_PAGO' : 'PAGO' })}
                    >
                      {c.estado === 'PAGO' ? 'Marcar não pago' : 'Marcar pago'}
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (commissions?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    Nenhuma comissão registada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
