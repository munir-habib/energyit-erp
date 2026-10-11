import { useState } from 'react'
import { useSimulation } from '@/hooks/useSimulations'
import { useInvoice } from '@/hooks/useInvoices'
import { useCreateRealSaving } from '@/hooks/useContracts'
import { PeriodoInputs } from '@/components/PeriodoInputs'
import { Button } from '@/components/ui/Button'
import { Input, FormRow } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { formatEur, formatPct } from '@/lib/format'
import type { Contract, ConsumoPeriodos, EsquemaHorario, Periodo } from '@/types/database'

function esquemaFromPeriodCount(count: number): EsquemaHorario {
  if (count >= 4) return 'TETRA_HORARIO'
  if (count === 3) return 'TRI_HORARIO'
  if (count === 2) return 'BI_HORARIO'
  return 'SIMPLES'
}

export function RealSavingForm({ contract, onDone }: { contract: Contract; onDone: () => void }) {
  const { data: simulation } = useSimulation(contract.simulation_id ?? undefined)
  const { data: invoice } = useInvoice(simulation?.invoice_id ?? undefined)
  const createRealSaving = useCreateRealSaving()

  const [periodoRef, setPeriodoRef] = useState('')
  const [consumoReal, setConsumoReal] = useState<ConsumoPeriodos>({})

  const periodos = Object.keys(contract.precos_congelados.precos_periodo ?? {}) as Periodo[]
  const usaFaturaBase = !!invoice?.preco_periodos

  const custoRealContrato = periodos.reduce(
    (sum, p) => sum + (consumoReal[p] ?? 0) * (contract.precos_congelados.precos_periodo[p] ?? 0),
    0,
  )
  const custoEstimadoAnterior = usaFaturaBase
    ? periodos.reduce((sum, p) => sum + (consumoReal[p] ?? 0) * (invoice!.preco_periodos![p] ?? 0), 0)
    : contract.precos_congelados.poupanca_pct < 100
      ? custoRealContrato / (1 - contract.precos_congelados.poupanca_pct / 100)
      : custoRealContrato

  const poupancaEur = custoEstimadoAnterior - custoRealContrato
  const poupancaPct = custoEstimadoAnterior > 0 ? (poupancaEur / custoEstimadoAnterior) * 100 : 0

  async function handleSubmit() {
    await createRealSaving.mutateAsync({
      contract_id: contract.id,
      periodo_referencia: periodoRef || null,
      consumo_real_periodos: consumoReal,
      custo_real_contrato: custoRealContrato,
      custo_estimado_anterior: custoEstimadoAnterior,
      poupanca_real_eur: poupancaEur,
      poupanca_real_pct: poupancaPct,
    })
    onDone()
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200/70 p-4 dark:border-white/10">
      {!usaFaturaBase && (
        <Alert tone="warning">
          Sem fatura de origem associada — o custo anterior é estimado proporcionalmente à poupança prevista na simulação.
        </Alert>
      )}
      <FormRow label="Período de referência (ex: 2026)">
        <Input value={periodoRef} onChange={(e) => setPeriodoRef(e.target.value)} />
      </FormRow>
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Consumo real faturado (kWh)</p>
        <PeriodoInputs
          esquema={esquemaFromPeriodCount(periodos.length)}
          values={consumoReal}
          onChange={(p, v) => setConsumoReal((c) => ({ ...c, [p]: v }))}
          unit="kWh"
        />
      </div>
      <div className="flex gap-6 text-sm">
        <p>
          Custo real: <span className="font-numeric font-medium">{formatEur(custoRealContrato)}</span>
        </p>
        <p className="text-savings dark:text-savings-dark">
          Poupança real:{' '}
          <span className="font-numeric font-semibold">
            {formatEur(poupancaEur)} ({formatPct(poupancaPct)})
          </span>
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={createRealSaving.isPending}>
          {createRealSaving.isPending ? 'A guardar…' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
