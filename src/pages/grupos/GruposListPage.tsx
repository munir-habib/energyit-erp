import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { useDeleteGrupo, useGrupos } from '@/hooks/useGrupos'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GrupoFormModal } from '@/pages/grupos/GrupoFormModal'
import type { Grupo } from '@/types/database'

export function GruposListPage() {
  const { data: grupos, isLoading } = useGrupos()
  const { data: clients } = useClients()
  const deleteGrupo = useDeleteGrupo()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Grupo | null>(null)

  const empresasPorGrupo = new Map<string, number>()
  for (const c of clients ?? []) if (c.grupo_id) empresasPorGrupo.set(c.grupo_id, (empresasPorGrupo.get(c.grupo_id) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Grupos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Várias Empresas do mesmo Grupo económico, agrupadas para as encontrar e acompanhar em conjunto.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          + Novo Grupo
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Empresas</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}
              {!isLoading && (grupos ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                    Ainda sem grupos. Crie um para juntar várias Empresas no mesmo documento.
                  </td>
                </tr>
              )}
              {(grupos ?? []).map((g) => (
                <tr key={g.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    <Link to={`/grupos/${g.id}`} className="hover:text-brand dark:hover:text-savings-dark">
                      {g.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-numeric text-slate-600 dark:text-slate-300">{empresasPorGrupo.get(g.id) ?? 0}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      className="mr-3 text-xs font-medium text-accent hover:underline"
                      onClick={() => {
                        setEditing(g)
                        setFormOpen(true)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs font-medium text-danger hover:underline"
                      onClick={() => {
                        if (confirm(`Eliminar o grupo "${g.nome}"? As Empresas deste grupo não são apagadas, ficam sem grupo.`)) {
                          deleteGrupo.mutate(g.id)
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && <GrupoFormModal grupo={editing} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
