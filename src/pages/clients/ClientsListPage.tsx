import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients, useDeleteClient } from '@/hooks/useClients'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ClientFormModal } from '@/pages/clients/ClientFormModal'
import { ExportButtons } from '@/components/ExportButtons'
import type { Client } from '@/types/database'

export function ClientsListPage() {
  const { data: clients, isLoading } = useClients()
  const deleteClient = useDeleteClient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)

  const filtered = (clients ?? []).filter((c) =>
    [c.nome, c.nif, c.cpe].some((v) => v?.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Clientes</h1>
        <div className="flex items-center gap-2">
          <ExportButtons
            filename="Clientes"
            headers={['Nome', 'NIF', 'CPE', 'Segmento', 'Contacto']}
            rows={filtered.map((c) => [c.nome, c.nif ?? '', c.cpe ?? '', c.segmento_principal, c.contacto ?? ''])}
          />
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            + Novo Cliente
          </Button>
        </div>
      </div>

      <Input placeholder="Pesquisar por nome, NIF ou CPE…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">NIF</th>
                <th className="px-5 py-3 font-medium">CPE</th>
                <th className="px-5 py-3 font-medium">Segmento</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
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
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                    <Link to={`/clientes/${c.id}`} className="hover:text-brand dark:hover:text-savings-dark">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-numeric text-slate-600 dark:text-slate-300">{c.nif ?? '—'}</td>
                  <td className="px-5 py-3 font-numeric text-slate-600 dark:text-slate-300">{c.cpe ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.segmento_principal}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.contacto ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      className="mr-3 text-xs font-medium text-accent hover:underline"
                      onClick={() => {
                        setEditing(c)
                        setFormOpen(true)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs font-medium text-danger hover:underline"
                      onClick={() => {
                        if (confirm(`Eliminar o cliente "${c.nome}"? Esta ação não pode ser revertida.`)) {
                          deleteClient.mutate(c.id)
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

      {formOpen && <ClientFormModal client={editing} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
