import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, FormRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useSaveGrupo, type GrupoInput } from '@/hooks/useGrupos'
import type { Grupo } from '@/types/database'

export function GrupoFormModal({ grupo, onClose }: { grupo: Grupo | null; onClose: () => void }) {
  const saveGrupo = useSaveGrupo()
  const [values, setValues] = useState<GrupoInput>({ nome: grupo?.nome ?? '' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await saveGrupo.mutateAsync({ id: grupo?.id, values })
    onClose()
  }

  return (
    <Modal title={grupo ? 'Editar grupo' : 'Novo grupo'} onClose={onClose}>
      {saveGrupo.isError && (
        <div className="mb-4">
          <Alert tone="danger">Não foi possível guardar o grupo. Tente novamente.</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Nome do grupo">
          <Input required autoFocus value={values.nome} onChange={(e) => setValues({ nome: e.target.value })} />
        </FormRow>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveGrupo.isPending}>
            {saveGrupo.isPending ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
