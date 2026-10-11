import { useQueryClient } from '@tanstack/react-query'
import { useCatalogTable } from '@/hooks/useAdminCatalog'
import { Card, CardBody } from '@/components/ui/Card'
import { InlineNumberInput } from '@/components/ui/InlineNumberInput'
import { Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { indiceDesatualizado } from '@/lib/pricingEngine'
import { formatDate } from '@/lib/format'
import type { MarketIndex } from '@/types/database'

export function AdminMarketIndicesPage() {
  const qc = useQueryClient()
  const indices = useCatalogTable<MarketIndex>('market_indices', 'nome')

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['catalog'] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Índices de Mercado</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Os produtos indexados recalculam automaticamente ao atualizar o índice.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(indices.data ?? []).map((idx) => {
          const desatualizado = indiceDesatualizado(idx)
          return (
            <Card key={idx.id}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{idx.nome}</h3>
                  {desatualizado && <span className="text-xs font-medium text-pending">Desatualizado</span>}
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-400">Valor ({idx.unidade})</p>
                  <InlineNumberInput
                    value={idx.valor}
                    step="0.01"
                    onSave={async (v) => {
                      await indices.update.mutateAsync({
                        id: idx.id,
                        values: { valor: v, data_atualizacao: new Date().toISOString().slice(0, 10) },
                      })
                      invalidate()
                    }}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-400">Data de atualização</p>
                  <Input
                    type="date"
                    value={idx.data_atualizacao}
                    onChange={async (e) => {
                      await indices.update.mutateAsync({ id: idx.id, values: { data_atualizacao: e.target.value } })
                      invalidate()
                    }}
                  />
                </div>
                {desatualizado && (
                  <Alert tone="warning">Última atualização em {formatDate(idx.data_atualizacao)} — considere confirmar o valor atual.</Alert>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
