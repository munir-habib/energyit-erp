import { useAdminAuditLog } from '@/hooks/useAdminCatalog'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'

const ACAO_TONE = { INSERT: 'savings', UPDATE: 'accent', DELETE: 'danger' } as const

export function AdminAuditPage() {
  const { data: entries, isLoading } = useAdminAuditLog()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Auditoria do Catálogo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Registo de todas as alterações a produtos, fórmulas, GO, TAR e regras de comissão.
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Tabela</th>
                <th className="px-5 py-3 font-medium">Ação</th>
                <th className="px-5 py-3 font-medium">Registo</th>
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
              {(entries ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-3 whitespace-nowrap">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-3 font-numeric">{e.tabela}</td>
                  <td className="px-5 py-3">
                    <Badge tone={ACAO_TONE[e.acao as keyof typeof ACAO_TONE] ?? 'neutral'}>{e.acao}</Badge>
                  </td>
                  <td className="px-5 py-3 font-numeric text-xs text-slate-400">{e.registo_id}</td>
                </tr>
              ))}
              {!isLoading && (entries?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                    Sem alterações registadas.
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
