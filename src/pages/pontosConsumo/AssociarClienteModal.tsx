import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useClients } from '@/hooks/useClients'
import { useAssociarPontosConsumo } from '@/hooks/usePontosConsumo'
import { useToast } from '@/context/ToastContext'
import type { PontoConsumo } from '@/types/database'

export function AssociarClienteModal({
  pontos,
  onClose,
  onDone,
}: {
  pontos: PontoConsumo[]
  onClose: () => void
  onDone: () => void
}) {
  const { data: clients } = useClients()
  const associar = useAssociarPontosConsumo()
  const toast = useToast()
  const [busca, setBusca] = useState('')
  const [clienteAlvo, setClienteAlvo] = useState<string>('')

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const lista = clients ?? []
    if (!q) return lista.slice(0, 20)
    return lista
      .filter((c) => c.nome.toLowerCase().includes(q) || (c.nif ?? '').toLowerCase().includes(q))
      .slice(0, 20)
  }, [clients, busca])

  const clienteAlvoObj = (clients ?? []).find((c) => c.id === clienteAlvo) ?? null

  // CPEs já associados a um cliente diferente do alvo — nunca reatribuir sem o consultor ver.
  const jaAssociadosNoutro = useMemo(
    () => pontos.filter((p) => p.client_id && p.client_id !== clienteAlvo),
    [pontos, clienteAlvo],
  )
  const resumoConflitos = useMemo(() => {
    const porCliente = new Map<string, number>()
    for (const p of jaAssociadosNoutro) {
      const nome = (clients ?? []).find((c) => c.id === p.client_id)?.nome ?? 'cliente removido'
      porCliente.set(nome, (porCliente.get(nome) ?? 0) + 1)
    }
    return [...porCliente.entries()]
  }, [jaAssociadosNoutro, clients])

  async function confirmar() {
    if (!clienteAlvoObj) return
    await associar.mutateAsync({
      pontoIds: pontos.map((p) => p.id),
      clientId: clienteAlvoObj.id,
      clienteNome: clienteAlvoObj.nome,
      clienteNif: clienteAlvoObj.nif ?? null,
    })
    toast.success(
      pontos.length === 1
        ? `CPE associada a ${clienteAlvoObj.nome}`
        : `${pontos.length} CPEs associadas a ${clienteAlvoObj.nome}`,
    )
    onDone()
  }

  return (
    <Modal title={`Associar ${pontos.length} CPE(s) a um cliente`} onClose={onClose}>
      <div className="space-y-4">
        {associar.isError && <Alert tone="danger">Não foi possível associar. Tente novamente.</Alert>}

        <Input
          autoFocus
          placeholder="Procurar cliente por nome ou NIF…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200/70 dark:border-white/10">
          {clientesFiltrados.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-400">Nenhum cliente encontrado.</p>
          ) : (
            clientesFiltrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClienteAlvo(c.id)}
                className={
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-muted dark:hover:bg-white/5 ' +
                  (clienteAlvo === c.id ? 'bg-accent/10 font-medium text-accent' : 'text-slate-700 dark:text-slate-200')
                }
              >
                <span>{c.nome}</span>
                <span className="font-numeric text-xs text-slate-400">{c.nif ?? '—'}</span>
              </button>
            ))
          )}
        </div>

        {clienteAlvoObj && jaAssociadosNoutro.length > 0 && (
          <Alert tone="warning" title="Reatribuição de CPEs já associados">
            <p className="mb-1">
              {jaAssociadosNoutro.length} dos {pontos.length} CPEs selecionados já estão associados a outro cliente:
            </p>
            <ul className="ml-4 list-disc">
              {resumoConflitos.map(([nome, n]) => (
                <li key={nome}>
                  {n} CPE(s) → <span className="font-medium">{nome}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1">Ao confirmar, passam todos para <span className="font-medium">{clienteAlvoObj.nome}</span>.</p>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!clienteAlvoObj || associar.isPending} onClick={confirmar}>
            {associar.isPending ? 'A associar…' : `Associar a ${clienteAlvoObj?.nome ?? '…'}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
