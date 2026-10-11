import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { useInvoice, useSaveInvoice, type InvoiceInput } from '@/hooks/useInvoices'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input, Select, FormRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { PeriodoInputs } from '@/components/PeriodoInputs'
import type { ConsumoPeriodos, EsquemaHorario, PrecoPeriodos, Segmento } from '@/types/database'

const emptyInvoice = (clientId: string, segmento: Segmento): InvoiceInput => ({
  client_id: clientId,
  segmento,
  esquema_horario: segmento === 'BTN' ? 'TRI_HORARIO' : 'TETRA_HORARIO',
  potencia_contratada_kva: 6.9,
  consumo_periodos: {},
  preco_periodos: {},
  inclui_tar: true,
  fornecedor_atual: '',
  data_fatura: new Date().toISOString().slice(0, 10),
  horas_ponta_diarias: null,
  dias_faturados: 30,
})

export function InvoiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: clients } = useClients()
  const { data: existing } = useInvoice(id)
  const saveInvoice = useSaveInvoice()

  const [values, setValues] = useState<InvoiceInput>(() => emptyInvoice(params.get('cliente') ?? '', 'BTN'))

  useEffect(() => {
    if (existing) {
      const { id: _omit, owner_id: _omit2, created_at: _omit3, updated_at: _omit4, ...rest } = existing
      setValues(rest)
    }
  }, [existing])

  function set<K extends keyof InvoiceInput>(key: K, value: InvoiceInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const newId = await saveInvoice.mutateAsync({ id, values })
    navigate(`/clientes/${values.client_id}`)
    return newId
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        {id ? 'Editar fatura' : 'Nova fatura / consumo atual'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader title="Cliente e segmento" />
          <CardBody className="space-y-4">
            <FormRow label="Cliente">
              <Select
                required
                value={values.client_id}
                onChange={(e) => set('client_id', e.target.value)}
              >
                <option value="" disabled>
                  Selecione um cliente…
                </option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Segmento">
                <Select
                  value={values.segmento}
                  onChange={(e) => {
                    const segmento = e.target.value as Segmento
                    setValues((v) => ({
                      ...v,
                      segmento,
                      esquema_horario: segmento === 'BTN' ? 'TRI_HORARIO' : 'TETRA_HORARIO',
                    }))
                  }}
                >
                  <option value="BTN">BTN</option>
                  <option value="BTE">BTE</option>
                  <option value="MT">MT</option>
                </Select>
              </FormRow>
              {values.segmento === 'BTN' && (
                <FormRow label="Esquema horário">
                  <Select value={values.esquema_horario} onChange={(e) => set('esquema_horario', e.target.value as EsquemaHorario)}>
                    <option value="SIMPLES">Simples</option>
                    <option value="BI_HORARIO">Bi-Horário</option>
                    <option value="TRI_HORARIO">Tri-Horário</option>
                  </Select>
                </FormRow>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Consumo por período (kWh)" subtitle="Consumo faturado no período em análise" />
          <CardBody>
            <PeriodoInputs
              esquema={values.esquema_horario}
              values={values.consumo_periodos as ConsumoPeriodos}
              onChange={(p, v) => set('consumo_periodos', { ...values.consumo_periodos, [p]: v })}
              unit="kWh"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preço atual pago por período (€/kWh)" />
          <CardBody className="space-y-4">
            <PeriodoInputs
              esquema={values.esquema_horario}
              values={values.preco_periodos as PrecoPeriodos}
              onChange={(p, v) => set('preco_periodos', { ...(values.preco_periodos ?? {}), [p]: v })}
              unit="€/kWh"
              step="0.0001"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={values.inclui_tar}
                onChange={(e) => set('inclui_tar', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Preço atual já inclui TAR
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Potência e fornecedor" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Potência contratada (kVA)">
                <Input
                  type="number"
                  step="0.01"
                  numeric
                  value={values.potencia_contratada_kva ?? ''}
                  onChange={(e) => set('potencia_contratada_kva', Number(e.target.value))}
                />
              </FormRow>
              <FormRow label="Data da fatura">
                <Input type="date" value={values.data_fatura ?? ''} onChange={(e) => set('data_fatura', e.target.value)} />
              </FormRow>
            </div>
            <FormRow label="Fornecedor atual">
              <Input value={values.fornecedor_atual ?? ''} onChange={(e) => set('fornecedor_atual', e.target.value)} />
            </FormRow>
            {values.segmento !== 'BTN' && (
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Horas de Ponta diárias">
                  <Input
                    type="number"
                    step="0.1"
                    numeric
                    value={values.horas_ponta_diarias ?? ''}
                    onChange={(e) => set('horas_ponta_diarias', Number(e.target.value))}
                  />
                </FormRow>
                <FormRow label="Dias faturados">
                  <Input
                    type="number"
                    numeric
                    value={values.dias_faturados}
                    onChange={(e) => set('dias_faturados', Number(e.target.value))}
                  />
                </FormRow>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveInvoice.isPending || !values.client_id}>
            {saveInvoice.isPending ? 'A guardar…' : 'Guardar fatura'}
          </Button>
        </div>
      </form>
    </div>
  )
}
