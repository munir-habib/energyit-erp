import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useClients, useSaveClient } from '@/hooks/useClients'
import { useGrupo } from '@/hooks/useGrupos'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { GrupoFormModal } from '@/pages/grupos/GrupoFormModal'

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: grupo, isLoading } = useGrupo(id)
  const { data: clients } = useClients()
  const saveClient = useSaveClient()
  const [renaming, setRenaming] = useState(false)
  const [addingId, setAddingId] = useState('')

  const membros = useMemo(() => (clients ?? []).filter((c) => c.grupo_id === id), [clients, id])
  const disponiveis = useMemo(() => (clients ?? []).filter((c) => c.grupo_id !== id), [clients, id])

  async function handleAdicionar() {
    if (!addingId) return
    await saveClient.mutateAsync({ id: addingId, values: { ...toInput(clients!.find((c) => c.id === addingId)!), grupo_id: id! } })
    setAddingId('')
  }

  async function handleRemover(clientId: string) {
    await saveClient.mutateAsync({ id: clientId, values: { ...toInput(clients!.find((c) => c.id === clientId)!), grupo_id: null } })
  }

  if (isLoading) return <p className="text-sm text-slate-400">A carregar…</p>
  if (!grupo) return <p className="text-sm text-slate-400">Grupo não encontrado.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{grupo.nome}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{membros.length} Empresa(s) neste grupo</p>
        </div>
        <Button variant="secondary" onClick={() => setRenaming(true)}>
          Editar grupo
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Empresas do grupo"
          subtitle="Cada Empresa mantém as suas próprias CPEs, simulações e contratos — o Grupo é só uma forma de as agrupar e consultar em conjunto."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={addingId} onChange={(e) => setAddingId(e.target.value)} className="max-w-xs">
              <option value="">Adicionar Empresa existente…</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" disabled={!addingId || saveClient.isPending} onClick={() => void handleAdicionar()}>
              Adicionar
            </Button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {membros.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                <div>
                  <Link to={`/clientes/${c.id}`} className="font-medium text-slate-900 hover:text-brand dark:text-slate-100 dark:hover:text-savings-dark">
                    {c.nome}
                  </Link>
                  <p className="text-xs text-slate-400">
                    NIF {c.nif ?? '—'} · {c.segmento_principal}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-danger hover:underline"
                  onClick={() => void handleRemover(c.id)}
                >
                  Remover do grupo
                </button>
              </div>
            ))}
            {membros.length === 0 && <p className="py-4 text-sm text-slate-400">Ainda sem Empresas neste grupo.</p>}
          </div>
        </CardBody>
      </Card>

      {renaming && <GrupoFormModal grupo={grupo} onClose={() => setRenaming(false)} />}
    </div>
  )
}

// A mutação de gravar cliente espera o objeto ClientInput completo — reconstrói-o a partir do cliente
// já carregado (só o grupo_id muda), nunca perdendo os outros campos já preenchidos.
function toInput(c: NonNullable<ReturnType<typeof useClients>['data']>[number]) {
  const { id: _id, owner_id: _owner_id, created_at: _created_at, updated_at: _updated_at, cpe: _cpe, ...input } = c
  return input
}
