import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'

export function InvoicesListPage() {
  const { data: invoices, isLoading } = useInvoices()
  const { data: clients } = useClients()
  const clientName = (id: string) => clients?.find((c) => c.id === id)?.nome ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Faturas / Consumo Atual</h1>
        <Link to="/faturas/nova">
          <Button>+ Nova Fatura</Button>
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Segmento</th>
                <th className="px-5 py-3 font-medium">Esquema</th>
                <th className="px-5 py-3 font-medium">Fornecedor atual</th>
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
              {(invoices ?? []).map((inv) => (
                <tr key={inv.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{clientName(inv.client_id)}</td>
                  <td className="px-5 py-3">{formatDate(inv.data_fatura)}</td>
                  <td className="px-5 py-3">{inv.segmento}</td>
                  <td className="px-5 py-3">{inv.esquema_horario}</td>
                  <td className="px-5 py-3">{inv.fornecedor_atual ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/faturas/${inv.id}/editar`} className="text-xs font-medium text-accent hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && (invoices?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    Nenhuma fatura registada.
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
