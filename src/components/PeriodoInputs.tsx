import { periodoLabel, periodosDoEsquema } from '@/lib/pricingEngine'
import { Input, Label } from '@/components/ui/Field'
import type { EsquemaHorario, Periodo } from '@/types/database'
import type { ValidationResult } from '@/lib/validators'

export { periodoLabel }

export function PeriodoInputs({
  esquema,
  values,
  onChange,
  unit,
  step = 'any',
  validate,
  statusPeriodo,
}: {
  esquema: EsquemaHorario
  values: Partial<Record<Periodo, number>>
  onChange: (periodo: Periodo, value: number) => void
  unit: string
  step?: string
  /** Validação em tempo real por período (opcional), p.ex. `validarConsumoPeriodo`. Só corre em períodos preenchidos. */
  validate?: (value: number, periodo: Periodo) => ValidationResult
  /** Estado imposto por período (ex: confiança da leitura da fatura) — quando devolve algo, ganha ao `validate`. */
  statusPeriodo?: (periodo: Periodo) => ValidationResult | undefined
}) {
  const periodos = periodosDoEsquema(esquema)
  return (
    <div className={`grid grid-cols-2 gap-3 ${periodos.length > 2 ? 'sm:grid-cols-4' : ''}`}>
      {periodos.map((p) => (
        <div key={p}>
          <Label htmlFor={`periodo-${p}`}>
            {periodoLabel(p)} <span className="text-slate-400">({unit})</span>
          </Label>
          <Input
            id={`periodo-${p}`}
            type="number"
            step={step}
            numeric
            value={values[p] ?? ''}
            onChange={(e) => onChange(p, Number(e.target.value))}
            {...(statusPeriodo?.(p) ?? (validate && values[p] !== undefined ? validate(values[p]!, p) : {}))}
          />
        </div>
      ))}
    </div>
  )
}
