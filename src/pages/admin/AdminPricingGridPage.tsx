import { useMemo, useState } from 'react'
import { evaluate } from 'mathjs'
import { useQueryClient } from '@tanstack/react-query'
import { useCatalog, useSuppliers } from '@/hooks/useCatalog'
import { useCatalogTable } from '@/hooks/useAdminCatalog'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { InlineNumberInput } from '@/components/ui/InlineNumberInput'
import { buildProductSlugs, goScopeFromGrid, indiceScopeFromCatalog } from '@/lib/formulaGrid'
import { formatGo } from '@/lib/format'
import type { PricingFormula, Product } from '@/types/database'

const PREVIEW_POTENCIA_KVA = 20.7

export function AdminPricingGridPage() {
  const qc = useQueryClient()
  const { data: catalog, isLoading } = useCatalog()
  const { data: suppliers } = useSuppliers()
  const products = useCatalogTable<Product>('products', 'nome')
  const formulas = useCatalogTable<PricingFormula>('pricing_formulas')

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['catalog'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['pricing_formulas'] })
  }

  const supplierNome = useMemo(() => {
    const map = new Map((suppliers ?? []).map((s) => [s.id, s.nome]))
    return (id: string | null) => (id ? (map.get(id) ?? 'Fornecedor removido') : 'Sem fornecedor')
  }, [suppliers])

  const slugs = useMemo(() => buildProductSlugs(catalog?.products ?? []), [catalog?.products])

  const grouped = useMemo(() => {
    const list = [...(catalog?.products ?? [])].sort((a, b) => a.nome.localeCompare(b.nome))
    const groups = new Map<string, Product[]>()
    for (const p of list) {
      const key = supplierNome(p.supplier_id)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [catalog?.products, supplierNome])

  if (isLoading || !catalog) return <p className="text-sm text-slate-400">A carregar…</p>

  async function upsertFormula(product: Product, tipo: 'PRECO' | 'GO', formulaText: string) {
    const existing = catalog!.formulas.find((f) => f.product_id === product.id && f.tipo === tipo)
    if (existing) {
      await formulas.update.mutateAsync({ id: existing.id, values: { formula: formulaText } })
    } else {
      await formulas.insert.mutateAsync({ product_id: product.id, tipo, formula: formulaText, descricao: null } as Partial<PricingFormula>)
    }
    invalidateAll()
  }

  async function removeFormula(product: Product, tipo: 'PRECO' | 'GO') {
    const existing = catalog!.formulas.find((f) => f.product_id === product.id && f.tipo === tipo)
    if (existing) await formulas.remove.mutateAsync(existing.id)
    invalidateAll()
  }

  async function saveGoFixo(product: Product, value: number) {
    await products.update.mutateAsync({ id: product.id, values: { go_valor: value } })
    invalidateAll()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Grelha de Pricing</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Editor estilo Excel para o preço final e o GO de cada produto. Qualquer alteração aqui reflete-se de imediato em
          todas as simulações e propostas de todos os consultores — sem publicar nem aprovar.
        </p>
      </div>

      <VariablesHelp catalog={catalog} slugs={slugs} />

      {grouped.map(([fornecedor, prods]) => (
        <Card key={fornecedor}>
          <div className="border-b border-slate-200/70 px-5 py-3 dark:border-white/5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fornecedor}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Preço final</th>
                  <th className="px-4 py-3 font-medium">GO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {prods.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    catalog={catalog}
                    onSavePrecoFormula={(f) => upsertFormula(p, 'PRECO', f)}
                    onSaveGoFormula={(f) => upsertFormula(p, 'GO', f)}
                    onRemoveGoFormula={() => removeFormula(p, 'GO')}
                    onSaveGoFixo={(v) => saveGoFixo(p, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}

function VariablesHelp({
  catalog,
  slugs,
}: {
  catalog: NonNullable<ReturnType<typeof useCatalog>['data']>
  slugs: Map<string, string>
}) {
  return (
    <Card className="px-5 py-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Variáveis disponíveis nas fórmulas</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span><code className="font-numeric">Indice</code>, <code className="font-numeric">Spread</code>, <code className="font-numeric">Margem</code>, <code className="font-numeric">GO</code>, <code className="font-numeric">PotenciaContratada</code> — relativas ao próprio produto</span>
        {catalog.marketIndices.map((idx) => (
          <span key={idx.id}><code className="font-numeric">Indice_{idx.nome.replace(/[^A-Za-z0-9]+/g, '_')}</code> = {idx.valor}</span>
        ))}
        {catalog.products.map((p) => (
          <span key={p.id}><code className="font-numeric">GO_{slugs.get(p.id)}</code> → GO de "{p.nome}"</span>
        ))}
      </div>
    </Card>
  )
}

function ProductRow({
  product,
  catalog,
  onSavePrecoFormula,
  onSaveGoFormula,
  onRemoveGoFormula,
  onSaveGoFixo,
}: {
  product: Product
  catalog: NonNullable<ReturnType<typeof useCatalog>['data']>
  onSavePrecoFormula: (formula: string) => void
  onSaveGoFormula: (formula: string) => void
  onRemoveGoFormula: () => void
  onSaveGoFixo: (value: number) => void
}) {
  const precoFormula = catalog.formulas.find((f) => f.product_id === product.id && f.tipo === 'PRECO')
  const goFormula = catalog.formulas.find((f) => f.product_id === product.id && f.tipo === 'GO')
  const goCell = catalog.goGrid.get(product.id)

  const [goModoFormula, setGoModoFormula] = useState(!!goFormula)
  const [goDraft, setGoDraft] = useState(goFormula?.formula ?? '')
  const [precoDraft, setPrecoDraft] = useState(precoFormula?.formula ?? '')

  const sampleSpread = catalog.energyPrices.find((r) => r.product_id === product.id)?.preco_base ?? 0
  const indice = catalog.marketIndices.find((i) => i.id === product.indice_id)?.valor ?? 0

  const precoPreview = useMemo(() => {
    if (product.tipo !== 'ABERTO_INDEXADO') return null
    try {
      const value = evaluate(precoDraft || '0', {
        Indice: indice,
        Spread: sampleSpread,
        Margem: product.margem ?? 0,
        GO: goCell?.value ?? product.go_valor ?? 0,
        PotenciaContratada: PREVIEW_POTENCIA_KVA,
        ...indiceScopeFromCatalog(catalog.marketIndices),
        ...goScopeFromGrid(catalog.products, catalog.goGrid),
      })
      return typeof value === 'number' && !Number.isNaN(value) ? value : null
    } catch {
      return 'erro' as const
    }
  }, [precoDraft, product, indice, sampleSpread, goCell, catalog])

  const goPreview = useMemo(() => {
    if (!goModoFormula) return null
    try {
      const value = evaluate(goDraft || '0', {
        Margem: product.margem ?? 0,
        PotenciaContratada: PREVIEW_POTENCIA_KVA,
        ...indiceScopeFromCatalog(catalog.marketIndices),
        ...goScopeFromGrid(catalog.products, catalog.goGrid),
      })
      return typeof value === 'number' && !Number.isNaN(value) ? value : null
    } catch {
      return 'erro' as const
    }
  }, [goDraft, goModoFormula, product, catalog])

  return (
    <tr className="align-top hover:bg-surface-muted/50 dark:hover:bg-white/5">
      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
        {product.nome}
        <div className="mt-1">
          <Badge tone={product.tipo === 'FECHADO' ? 'neutral' : 'accent'}>{product.tipo}</Badge>
        </div>
      </td>

      <td className="px-4 py-3">
        {product.tipo === 'ABERTO_INDEXADO' ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                value={precoDraft}
                onChange={(e) => setPrecoDraft(e.target.value)}
                placeholder="ex: Indice + Spread + Margem"
                className="font-numeric w-64 rounded-lg border border-slate-300 bg-surface-card px-2 py-1 text-sm dark:border-white/10 dark:bg-surface-dark-muted"
              />
              <button
                className="rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                onClick={() => onSavePrecoFormula(precoDraft)}
                disabled={precoDraft === (precoFormula?.formula ?? '')}
              >
                Guardar
              </button>
            </div>
            {precoPreview === 'erro' ? (
              <p className="text-xs text-danger">Fórmula inválida</p>
            ) : (
              <p className="font-numeric text-xs text-slate-400">
                Pré-visualização (período de referência): {precoPreview != null ? precoPreview.toFixed(4) : '—'} €/kWh
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Preço fixo por período — editar em Produtos</p>
        )}
      </td>

      <td className="px-4 py-3">
        {product.tipo === 'FECHADO' ? (
          <span className="text-slate-400">—</span>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                className="text-[11px] font-medium text-accent hover:underline"
                onClick={() => {
                  if (goModoFormula) {
                    onRemoveGoFormula()
                    setGoModoFormula(false)
                  } else {
                    setGoModoFormula(true)
                  }
                }}
              >
                {goModoFormula ? 'usar valor fixo' : 'usar fórmula'}
              </button>
            </div>
            {goModoFormula ? (
              <>
                <div className="flex gap-2">
                  <input
                    value={goDraft}
                    onChange={(e) => setGoDraft(e.target.value)}
                    placeholder="ex: GO_produto_x * 1.1"
                    className="font-numeric w-56 rounded-lg border border-slate-300 bg-surface-card px-2 py-1 text-sm dark:border-white/10 dark:bg-surface-dark-muted"
                  />
                  <button
                    className="rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                    onClick={() => onSaveGoFormula(goDraft)}
                    disabled={goDraft === (goFormula?.formula ?? '')}
                  >
                    Guardar
                  </button>
                </div>
                {goPreview === 'erro' || goCell?.error ? (
                  <p className="text-xs text-danger">{goCell?.error ?? 'Fórmula inválida'}</p>
                ) : (
                  <p className="font-numeric text-xs text-slate-400">= {formatGo(goPreview)}</p>
                )}
              </>
            ) : (
              <InlineNumberInput value={product.go_valor} onSave={onSaveGoFixo} step="0.1" />
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
