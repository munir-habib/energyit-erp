import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, FormRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useClients, useSaveClient, type ClientInput } from '@/hooks/useClients'
import { useFieldFeedback } from '@/hooks/useFieldFeedback'
import { temErros, validarContacto, validarNIF, validarNome } from '@/lib/validators'
import { useGrupos } from '@/hooks/useGrupos'
import type { Client } from '@/types/database'

export function ClientFormModal({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const saveClient = useSaveClient()
  const { data: clients } = useClients()
  const { data: grupos } = useGrupos()
  const consultores = useMemo(
    () => [...new Set((clients ?? []).map((c) => c.consultor_responsavel).filter((v): v is string => !!v))].sort(),
    [clients],
  )
  const [values, setValues] = useState<ClientInput>({
    nome: client?.nome ?? '',
    nif: client?.nif ?? '',
    morada: client?.morada ?? '',
    contacto: client?.contacto ?? '',
    cui: client?.cui ?? '',
    segmento_principal: client?.segmento_principal ?? 'BTN',
    consultor_responsavel: client?.consultor_responsavel ?? '',
    grupo_id: client?.grupo_id ?? null,
  })

  function set<K extends keyof ClientInput>(key: K, value: ClientInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const fb = useFieldFeedback()
  const vNome = validarNome(values.nome)
  const vNif = validarNIF(values.nif)
  const vContacto = validarContacto(values.contacto)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    fb.marcarSubmetido()
    if (temErros(vNome, vNif, vContacto)) return
    await saveClient.mutateAsync({ id: client?.id, values })
    onClose()
  }

  return (
    <Modal title={client ? 'Editar cliente' : 'Novo cliente'} onClose={onClose}>
      {saveClient.isError && (
        <div className="mb-4">
          <Alert tone="danger">Não foi possível guardar o cliente. Tente novamente.</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Nome">
          <Input required value={values.nome} onChange={(e) => set('nome', e.target.value)} {...fb('nome', values.nome, vNome)} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="NIF">
            <Input numeric value={values.nif ?? ''} onChange={(e) => set('nif', e.target.value)} {...fb('nif', values.nif, vNif)} />
          </FormRow>
          <FormRow label="Segmento principal">
            <Select value={values.segmento_principal} onChange={(e) => set('segmento_principal', e.target.value as ClientInput['segmento_principal'])}>
              <option value="BTN">BTN</option>
              <option value="BTE">BTE</option>
              <option value="MT">MT</option>
            </Select>
          </FormRow>
        </div>
        <FormRow label="Morada">
          <Input value={values.morada ?? ''} onChange={(e) => set('morada', e.target.value)} />
        </FormRow>
        <FormRow label="Contacto">
          <Input value={values.contacto ?? ''} onChange={(e) => set('contacto', e.target.value)} placeholder="Email ou telefone" {...fb('contacto', values.contacto, vContacto)} />
        </FormRow>
        <FormRow label="CUI (gás)">
          <Input numeric value={values.cui ?? ''} onChange={(e) => set('cui', e.target.value)} />
        </FormRow>
        <FormRow label="Grupo (opcional — agrupa várias Empresas do mesmo Grupo económico)">
          <Select value={values.grupo_id ?? ''} onChange={(e) => set('grupo_id', e.target.value || null)}>
            <option value="">Sem grupo (cliente individual)</option>
            {(grupos ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Consultor responsável (opcional)">
          <Input
            list="consultores-lista"
            value={values.consultor_responsavel ?? ''}
            onChange={(e) => set('consultor_responsavel', e.target.value || null)}
          />
          <datalist id="consultores-lista">
            {consultores.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </FormRow>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveClient.isPending}>
            {saveClient.isPending ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
