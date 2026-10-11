import { useState } from 'react'
import { useCreateAlert } from '@/hooks/useAlerts'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import type { AlertEntityType, AlertTipo } from '@/types/database'

interface AlertOption {
  tipo: Exclude<AlertTipo, 'DATA_ESPECIFICA'>
  label: string
  computeDataAlvo: (dias: number) => string
}

export function AlertForm({
  entityType,
  entityId,
  options,
  onCreated,
}: {
  entityType: AlertEntityType
  entityId: string
  options: AlertOption[]
  onCreated?: () => void
}) {
  const createAlert = useCreateAlert()
  const [tipo, setTipo] = useState<AlertTipo>(options[0]?.tipo ?? 'DATA_ESPECIFICA')
  const [dias, setDias] = useState(7)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  async function handleSubmit() {
    const opcao = options.find((o) => o.tipo === tipo)
    const dataAlvo = opcao ? opcao.computeDataAlvo(dias) : data
    await createAlert.mutateAsync({
      entity_type: entityType,
      entity_id: entityId,
      tipo,
      dias: opcao ? dias : null,
      data_alvo: dataAlvo,
    })
    onCreated?.()
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select value={tipo} onChange={(e) => setTipo(e.target.value as AlertTipo)} className="max-w-[220px]">
        {options.map((o) => (
          <option key={o.tipo} value={o.tipo}>
            {o.label}
          </option>
        ))}
        <option value="DATA_ESPECIFICA">Numa data específica</option>
      </Select>
      {tipo === 'DATA_ESPECIFICA' ? (
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      ) : (
        <Input type="number" numeric min={0} value={dias} onChange={(e) => setDias(Number(e.target.value))} className="w-20" />
      )}
      <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={createAlert.isPending}>
        {createAlert.isPending ? 'A definir…' : 'Definir alerta'}
      </Button>
    </div>
  )
}
