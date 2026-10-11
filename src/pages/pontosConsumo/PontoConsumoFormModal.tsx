import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, FormRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useCreatePontoConsumo, type PontoConsumoInsert } from '@/hooks/usePontosConsumo'
import { useFieldFeedback } from '@/hooks/useFieldFeedback'
import { temErros, validarConsumoAnual, validarCPE, validarNIF, validarNome, validarPotencia } from '@/lib/validators'

export function PontoConsumoFormModal({ onClose }: { onClose: () => void }) {
  const createPonto = useCreatePontoConsumo()
  const [values, setValues] = useState<PontoConsumoInsert>({
    client_id: null,
    cpe: '',
    cliente: '',
    nif: '',
    morada: '',
    estado: 'Ativo',
    potencia_contratada: null,
    consumo_anual: null,
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: null,
  })

  function set<K extends keyof PontoConsumoInsert>(key: K, value: PontoConsumoInsert[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const fb = useFieldFeedback()
  const vCpe = validarCPE(values.cpe, { obrigatorio: true })
  const vNif = validarNIF(values.nif)
  const vCliente = validarNome(values.cliente)
  // Potência é opcional aqui (sem segmento no formulário) — só valida quando preenchida.
  const vPotencia = values.potencia_contratada == null ? {} : validarPotencia(values.potencia_contratada)
  const vConsumo = validarConsumoAnual(values.consumo_anual, values.potencia_contratada)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    fb.marcarSubmetido()
    if (temErros(vCpe, vNif, vCliente, vPotencia, vConsumo)) return
    await createPonto.mutateAsync(values)
    onClose()
  }

  return (
    <Modal title="Novo Ponto de Consumo" onClose={onClose}>
      {createPonto.isError && (
        <div className="mb-4">
          <Alert tone="danger">Não foi possível criar o ponto de consumo. Tente novamente.</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="CPE">
            <Input required numeric value={values.cpe} onChange={(e) => set('cpe', e.target.value)} placeholder="PT0002…" {...fb('cpe', values.cpe, vCpe)} />
          </FormRow>
          <FormRow label="NIF">
            <Input numeric value={values.nif ?? ''} onChange={(e) => set('nif', e.target.value)} {...fb('nif', values.nif, vNif)} />
          </FormRow>
        </div>
        <FormRow label="Cliente">
          <Input required value={values.cliente} onChange={(e) => set('cliente', e.target.value)} {...fb('cliente', values.cliente, vCliente)} />
        </FormRow>
        <FormRow label="Morada (opcional)">
          <Input value={values.morada ?? ''} onChange={(e) => set('morada', e.target.value || null)} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Potência contratada (kVA)">
            <Input
              numeric
              type="number"
              step="0.01"
              value={values.potencia_contratada ?? ''}
              onChange={(e) => set('potencia_contratada', e.target.value ? Number(e.target.value) : null)}
              {...fb('potencia', values.potencia_contratada, vPotencia)}
            />
          </FormRow>
          <FormRow label="Consumo anual (kWh)">
            <Input
              numeric
              type="number"
              step="1"
              value={values.consumo_anual ?? ''}
              onChange={(e) => set('consumo_anual', e.target.value ? Number(e.target.value) : null)}
              {...fb('consumo', values.consumo_anual, vConsumo)}
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Data de início">
            <Input required type="date" value={values.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} />
          </FormRow>
          <FormRow label="Data de fim">
            <Input type="date" value={values.data_fim ?? ''} onChange={(e) => set('data_fim', e.target.value || null)} />
          </FormRow>
          <FormRow label="Estado">
            <Select value={values.estado} onChange={(e) => set('estado', e.target.value as PontoConsumoInsert['estado'])}>
              <option value="Ativo">Ativo</option>
              <option value="Desativo">Desativo</option>
            </Select>
          </FormRow>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createPonto.isPending}>
            {createPonto.isPending ? 'A criar…' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
