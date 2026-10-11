import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, FormRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useRenovarPeriodo } from '@/hooks/usePontosConsumo'
import { formatDate } from '@/lib/format'
import type { PontoConsumo } from '@/types/database'

export function RenovacaoModal({ ponto, onClose }: { ponto: PontoConsumo; onClose: () => void }) {
  const renovar = useRenovarPeriodo()
  const [novaDataFim, setNovaDataFim] = useState('')
  const [estado, setEstado] = useState(ponto.estado)
  const [potencia, setPotencia] = useState(ponto.potencia_contratada ?? '')
  const [consumo, setConsumo] = useState(ponto.consumo_anual ?? '')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await renovar.mutateAsync({
      ponto_consumo_id: ponto.id,
      nova_data_fim: novaDataFim,
      estado,
      potencia_contratada: potencia === '' ? null : Number(potencia),
      consumo_anual: consumo === '' ? null : Number(consumo),
    })
    onClose()
  }

  if (!ponto.data_fim_contrato) {
    return (
      <Modal title="Nova Renovação" onClose={onClose}>
        <Alert tone="warning">
          Este ponto de consumo não tem uma data de fim definida no período atual — não é possível encadear uma
          renovação. Defina primeiro a data de fim do período em curso.
        </Alert>
        <div className="flex justify-end pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Nova Renovação" onClose={onClose}>
      {renovar.isError && (
        <div className="mb-4">
          <Alert tone="danger">Não foi possível registar a renovação. Tente novamente.</Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          O novo período começa em <strong>{formatDate(ponto.data_fim_contrato)}</strong> (a data de fim atual do
          período em curso).
        </p>
        <FormRow label="Nova data de fim (renovação)">
          <Input required type="date" min={ponto.data_fim_contrato} value={novaDataFim} onChange={(e) => setNovaDataFim(e.target.value)} />
        </FormRow>
        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Potência contratada (kVA)">
            <Input
              numeric
              type="number"
              step="0.01"
              value={potencia}
              onChange={(e) => setPotencia(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </FormRow>
          <FormRow label="Consumo anual (kWh)">
            <Input
              numeric
              type="number"
              step="1"
              value={consumo}
              onChange={(e) => setConsumo(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </FormRow>
          <FormRow label="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value as PontoConsumo['estado'])}>
              <option value="Ativo">Ativo</option>
              <option value="Desativo">Desativo</option>
            </Select>
          </FormRow>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={renovar.isPending}>
            {renovar.isPending ? 'A registar…' : 'Registar renovação'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
