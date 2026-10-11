import { Link } from 'react-router-dom'
import { useSimulations } from '@/hooks/useSimulations'
import { useClients } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatEur } from '@/lib/format'

export function SimulationsListPage() {
  const { data: simulations, isLoading } = useSimulations()
  const { data: clients } = useClients()
  const clientName = (id: string) => clients?.find((c) => c.id === id)?.nome ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Simulações</h1>
        <Link to="/simulacoes/nova">
          <Button>+ Nova Simulação</Button>
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
                <th className="px-5 py-3 font-medium">Melhor poupança</th>
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
              {(simulations ?? []).map((sim) => {
                const melhor = sim.resultados[0]
                return (
                  <tr key={sim.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {sim.client_id ? clientName(sim.client_id) : <span className="text-slate-400">Sem cliente</span>}
                    </td>
                    <td className="px-5 py-3">{formatDate(sim.created_at)}</td>
                    <td className="px-5 py-3">{sim.segmento}</td>
                    <td className="px-5 py-3 font-numeric text-savings dark:text-savings-dark">
                      {melhor ? `${formatEur(melhor.poupanca_eur_ano)}/ano` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {sim.produto_escolhido_id ? <Badge tone="savings">Escolhido</Badge> : <Badge tone="pending">Por decidir</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/simulacoes/${sim.id}`} className="text-xs font-medium text-accent hover:underline">
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && (simulations?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    Nenhuma simulação registada.
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
