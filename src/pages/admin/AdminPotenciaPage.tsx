import { useQueryClient } from '@tanstack/react-query'
import { useCatalogTable } from '@/hooks/useAdminCatalog'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { InlineNumberInput } from '@/components/ui/InlineNumberInput'
import type { PotenciaContratadaTabela, PotenciaContratadaValor } from '@/types/database'

export function AdminPotenciaPage() {
  const qc = useQueryClient()
  const tabelas = useCatalogTable<PotenciaContratadaTabela>('potencia_contratada_tabelas', 'nome')
  const valores = useCatalogTable<PotenciaContratadaValor>('potencia_contratada_valores')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['catalog'] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Potência Contratada</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tabelas de potência (€/dia) usadas pelos produtos fechados BTN. Tabelas partilhadas entre produtos atualizam todos ao mesmo tempo.
        </p>
      </div>

      {(tabelas.data ?? []).map((tabela) => (
        <Card key={tabela.id}>
          <CardHeader title={tabela.nome} subtitle="€/dia por escalão de potência (kVA)" />
          <CardBody className="flex flex-wrap gap-3">
            {(valores.data ?? [])
              .filter((v) => v.tabela_id === tabela.id)
              .sort((a, b) => a.potencia_kva - b.potencia_kva)
              .map((v) => (
                <div key={v.id} className="rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
                  <p className="text-[11px] text-slate-400">{v.potencia_kva} kVA</p>
                  <InlineNumberInput
                    value={v.valor_dia}
                    step="0.00001"
                    onSave={async (val) => {
                      await valores.update.mutateAsync({ id: v.id, values: { valor_dia: val } })
                      invalidate()
                    }}
                  />
                </div>
              ))}
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
