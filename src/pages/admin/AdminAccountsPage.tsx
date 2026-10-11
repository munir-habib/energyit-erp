import { useAllProfiles } from '@/hooks/useAdminCatalog'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'

export function AdminAccountsPage() {
  const { data: profiles, isLoading } = useAllProfiles()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Lista de consultores registados. Os dados de clientes, simulações e comissões de cada conta não são acessíveis ao Admin.
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Papel</th>
                <th className="px-5 py-3 font-medium">Registado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}
              {(profiles ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{p.nome ?? '—'}</td>
                  <td className="px-5 py-3">{p.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={p.role === 'admin' ? 'accent' : 'neutral'}>{p.role === 'admin' ? 'Admin' : 'Consultor'}</Badge>
                  </td>
                  <td className="px-5 py-3">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
