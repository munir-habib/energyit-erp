import { useQueryClient } from '@tanstack/react-query'
import { useCatalogTable } from '@/hooks/useAdminCatalog'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { InlineNumberInput } from '@/components/ui/InlineNumberInput'
import { periodoLabel } from '@/components/PeriodoInputs'
import type { TarEnergiaBteMt, TarEnergiaBtn, TarPotenciaBteMt, TarPotenciaBtn } from '@/types/database'

export function AdminTarPage() {
  const qc = useQueryClient()
  const tarEnergiaBtn = useCatalogTable<TarEnergiaBtn>('tar_energia_btn')
  const tarPotenciaBtn = useCatalogTable<TarPotenciaBtn>('tar_potencia_btn', 'potencia_kva')
  const tarEnergiaBteMt = useCatalogTable<TarEnergiaBteMt>('tar_energia_bte_mt')
  const tarPotenciaBteMt = useCatalogTable<TarPotenciaBteMt>('tar_potencia_bte_mt')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['catalog'] })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">TAR — Tarifa de Acesso às Redes</h1>

      <Card>
        <CardHeader title="TAR — Componente Energia (BTN)" subtitle="€/kWh" />
        <CardBody className="flex flex-wrap gap-3">
          {(tarEnergiaBtn.data ?? []).map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
              <p className="text-[11px] text-slate-400">
                {row.esquema_horario} · {periodoLabel(row.periodo)}
                {row.abaixo_20_7kva && ' · ≤20,7 kVA'}
              </p>
              <InlineNumberInput
                value={row.valor}
                step="0.0001"
                onSave={async (v) => {
                  await tarEnergiaBtn.update.mutateAsync({ id: row.id, values: { valor: v } })
                  invalidate()
                }}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="TAR — Componente Potência Contratada (BTN)" subtitle="€/dia" />
        <CardBody className="flex flex-wrap gap-3">
          {(tarPotenciaBtn.data ?? []).map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
              <p className="text-[11px] text-slate-400">{row.potencia_kva} kVA</p>
              <InlineNumberInput
                value={row.valor_dia}
                step="0.0001"
                onSave={async (v) => {
                  await tarPotenciaBtn.update.mutateAsync({ id: row.id, values: { valor_dia: v } })
                  invalidate()
                }}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="TAR — Componente Energia (BTE & MT)" subtitle="€/kWh" />
        <CardBody className="flex flex-wrap gap-3">
          {(tarEnergiaBteMt.data ?? []).map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
              <p className="text-[11px] text-slate-400">
                {row.categoria} · {periodoLabel(row.periodo)}
              </p>
              <InlineNumberInput
                value={row.valor}
                step="0.0001"
                onSave={async (v) => {
                  await tarEnergiaBteMt.update.mutateAsync({ id: row.id, values: { valor: v } })
                  invalidate()
                }}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="TAR — Componente Potência (BTE & MT)" subtitle="Coeficientes €/kW/dia" />
        <CardBody className="flex flex-wrap gap-6">
          {(tarPotenciaBteMt.data ?? []).map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
              <p className="mb-1 text-[11px] text-slate-400">{row.categoria}</p>
              <div className="flex gap-4">
                <div>
                  <p className="text-[11px] text-slate-400">PHP</p>
                  <InlineNumberInput
                    value={row.coef_php}
                    step="0.0001"
                    onSave={async (v) => {
                      await tarPotenciaBteMt.update.mutateAsync({ id: row.id, values: { coef_php: v } })
                      invalidate()
                    }}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">PC</p>
                  <InlineNumberInput
                    value={row.coef_pc}
                    step="0.0001"
                    onSave={async (v) => {
                      await tarPotenciaBteMt.update.mutateAsync({ id: row.id, values: { coef_pc: v } })
                      invalidate()
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
