import { Link } from 'react-router-dom'
import { useContracts } from '@/hooks/useContracts'
import { useClients } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { EstadoContratoBadge } from '@/components/ui/Badge'
import { ExportButtons } from '@/components/ExportButtons'
import { formatDate } from '@/lib/format'

export function ContractsListPage() {
  const { data: contracts, isLoading } = useContracts()
  const { data: clients } = useClients()
  const clientName = (id: string) => clients?.find((c) => c.id === id)?.nome ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contratos</h1>
        <ExportButtons
          filename="Contratos"
          headers={['Cliente', 'Início', 'Fim', 'Estado']}
          rows={(contracts ?? []).map((c) => [clientName(c.client_id), c.data_inicio, c.data_fim ?? '', c.estado])}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Início</th>
                <th className="px-5 py-3 font-medium">Fim</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}
              {(contracts ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{clientName(c.client_id)}</td>
                  <td className="px-5 py-3">{formatDate(c.data_inicio)}</td>
                  <td className="px-5 py-3">{formatDate(c.data_fim)}</td>
                  <td className="px-5 py-3">
                    <EstadoContratoBadge estado={c.estado} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/contratos/${c.id}`} className="text-xs font-medium text-accent hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && (contracts?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    Nenhum contrato registado.
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
