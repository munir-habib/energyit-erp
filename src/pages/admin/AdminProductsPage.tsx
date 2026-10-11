import { Fragment, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useCatalogTable } from '@/hooks/useAdminCatalog'
import { useCatalog, usePotenciaTabelas, useSuppliers } from '@/hooks/useCatalog'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { InlineNumberInput } from '@/components/ui/InlineNumberInput'
import { Select, Input, FormRow } from '@/components/ui/Field'
import { periodoLabel } from '@/components/PeriodoInputs'
import { useFieldFeedback } from '@/hooks/useFieldFeedback'
import { temErros, validarGo, validarMargem, validarNaoNegativo, validarNome, validarPrecoKwh } from '@/lib/validators'
import { grupoAtivo, grupoExpirado, variantesDoProduto } from '@/lib/pricingEngine'
import type { Product, ProductEnergyPrice, ProductPriceVariant, Supplier, TipoProduto } from '@/types/database'

const TIPO_LABEL: Record<Product['tipo'], string> = {
  ABERTO_FIXO: 'Aberto — Fixo',
  ABERTO_INDEXADO: 'Aberto — Indexado',
  FECHADO: 'Fechado',
}

const SEGMENTO_LABEL: Record<'BTN' | 'BTE' | 'MT', string> = { BTN: 'BTN', BTE: 'BTE', MT: 'MT' }

function grupoTipo(tipo: TipoProduto): 'Aberto' | 'Fechado' {
  return tipo === 'FECHADO' ? 'Fechado' : 'Aberto'
}

type ProductDraft = {
  segmento: 'BTN' | 'BTE' | 'MT'
  supplier_id: string
  nome: string
  tipo: TipoProduto
  duracao_meses: string
  go_valor: string
  preco_limite: string
  margem: string
  indice_id: string
  prioridade_comissao: string
  comissao_fixa: string
  potencia_tabela_id: string
}

const emptyProductDraft: ProductDraft = {
  segmento: 'BTN',
  supplier_id: '',
  nome: '',
  tipo: 'ABERTO_FIXO',
  duracao_meses: '',
  go_valor: '',
  preco_limite: '',
  margem: '',
  indice_id: '',
  prioridade_comissao: '',
  comissao_fixa: '',
  potencia_tabela_id: '',
}

type SupplierDraft = { nome: string; contactos: string; condicoes: string }
const emptySupplierDraft: SupplierDraft = { nome: '', contactos: '', condicoes: '' }

export function AdminProductsPage() {
  const qc = useQueryClient()
  const products = useCatalogTable<Product>('products', 'nome')
  const energyPrices = useCatalogTable<ProductEnergyPrice>('product_energy_prices')
  const suppliersTable = useCatalogTable<Supplier>('suppliers', 'nome')
  const { data: suppliers } = useSuppliers()
  const { data: catalog } = useCatalog()
  const { data: potenciaTabelas } = usePotenciaTabelas()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [novoProdutoAberto, setNovoProdutoAberto] = useState(false)
  const [produtoDraft, setProdutoDraft] = useState<ProductDraft>(emptyProductDraft)
  const fb = useFieldFeedback()
  // Só valida os campos visíveis para o tipo escolhido (os escondidos são descartados no insert).
  const vProduto = {
    nome: validarNome(produtoDraft.nome),
    go: produtoDraft.tipo !== 'FECHADO' ? validarGo(produtoDraft.go_valor) : {},
    precoLimite: produtoDraft.tipo !== 'FECHADO' ? validarPrecoKwh(produtoDraft.preco_limite) : {},
    margem: produtoDraft.tipo === 'ABERTO_INDEXADO' ? validarMargem(produtoDraft.margem) : {},
    comissaoFixa: produtoDraft.tipo === 'FECHADO' ? validarNaoNegativo(produtoDraft.comissao_fixa) : {},
    prioridade: produtoDraft.tipo === 'FECHADO' ? validarNaoNegativo(produtoDraft.prioridade_comissao, { inteiro: true }) : {},
  }
  const [novaComercializadoraAberta, setNovaComercializadoraAberta] = useState(false)
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>(emptySupplierDraft)

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['catalog'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['suppliers'] })
  }

  async function saveProduct(id: string, values: Partial<Product>) {
    await products.update.mutateAsync({ id, values })
    invalidateAll()
  }

  async function savePrice(id: string, preco_base: number) {
    await energyPrices.update.mutateAsync({ id, values: { preco_base } })
    invalidateAll()
  }

  async function handleCriarProduto(e: FormEvent) {
    e.preventDefault()
    fb.marcarSubmetido()
    if (temErros(...Object.values(vProduto))) return
    const d = produtoDraft
    await products.insert.mutateAsync({
      segmento: d.segmento,
      supplier_id: d.supplier_id || null,
      nome: d.nome,
      tipo: d.tipo,
      duracao_meses: d.duracao_meses === '' ? null : (Number(d.duracao_meses) as 12 | 18 | 24),
      go_valor: d.tipo === 'FECHADO' || d.go_valor === '' ? null : Number(d.go_valor),
      preco_limite: d.preco_limite === '' ? null : Number(d.preco_limite),
      margem: d.tipo === 'ABERTO_INDEXADO' && d.margem !== '' ? Number(d.margem) : null,
      indice_id: d.tipo === 'ABERTO_INDEXADO' && d.indice_id !== '' ? d.indice_id : null,
      prioridade_comissao: d.tipo === 'FECHADO' && d.prioridade_comissao !== '' ? Number(d.prioridade_comissao) : null,
      comissao_fixa: d.tipo === 'FECHADO' && d.comissao_fixa !== '' ? Number(d.comissao_fixa) : null,
      potencia_tabela_id: d.segmento === 'BTN' && d.potencia_tabela_id !== '' ? d.potencia_tabela_id : null,
      preco_estatico_com_tar: d.tipo === 'FECHADO',
      ativo: true,
    } as Partial<Product>)
    invalidateAll()
    setProdutoDraft(emptyProductDraft)
    setNovoProdutoAberto(false)
  }

  async function handleCriarComercializadora(e: FormEvent) {
    e.preventDefault()
    await suppliersTable.insert.mutateAsync({
      nome: supplierDraft.nome,
      contactos: supplierDraft.contactos || null,
      condicoes: supplierDraft.condicoes || null,
    } as Partial<Supplier>)
    invalidateAll()
    setSupplierDraft(emptySupplierDraft)
    setNovaComercializadoraAberta(false)
  }

  const supplierNome = useMemo(() => {
    const map = new Map((suppliers ?? []).map((s) => [s.id, s.nome]))
    return (id: string | null) => (id ? (map.get(id) ?? 'Fornecedor removido') : 'Sem fornecedor')
  }, [suppliers])

  const filtrados = (products.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return p.nome.toLowerCase().includes(q) || supplierNome(p.supplier_id).toLowerCase().includes(q)
  })

  // Segmento -> Comercializadora -> Tipo (Aberto/Fechado) -> Produtos
  const agrupado = useMemo(() => {
    const bySegmento = new Map<'BTN' | 'BTE' | 'MT', Map<string, Map<'Aberto' | 'Fechado', Product[]>>>()
    for (const p of filtrados) {
      if (p.segmento === 'GAS') continue
      const segmento = p.segmento
      if (!bySegmento.has(segmento)) bySegmento.set(segmento, new Map())
      const byComercializadora = bySegmento.get(segmento)!
      const comercializadora = supplierNome(p.supplier_id)
      if (!byComercializadora.has(comercializadora)) byComercializadora.set(comercializadora, new Map())
      const byTipo = byComercializadora.get(comercializadora)!
      const tipo = grupoTipo(p.tipo)
      if (!byTipo.has(tipo)) byTipo.set(tipo, [])
      byTipo.get(tipo)!.push(p)
    }
    return [...bySegmento.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtrados, supplierNome])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Produtos & Preços</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            O GO e os preços aqui definidos aplicam-se de imediato a todas as contas de consultores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setNovaComercializadoraAberta((v) => !v)}>
            + Nova comercializadora
          </Button>
          <Button onClick={() => setNovoProdutoAberto((v) => !v)}>+ Novo produto</Button>
        </div>
      </div>

      {novaComercializadoraAberta && (
        <Card>
          <CardHeader title="Nova comercializadora" />
          <CardBody>
            <form onSubmit={handleCriarComercializadora} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <FormRow label="Nome">
                <Input required value={supplierDraft.nome} onChange={(e) => setSupplierDraft((d) => ({ ...d, nome: e.target.value }))} />
              </FormRow>
              <FormRow label="Contactos">
                <Input value={supplierDraft.contactos} onChange={(e) => setSupplierDraft((d) => ({ ...d, contactos: e.target.value }))} />
              </FormRow>
              <FormRow label="Condições">
                <Input value={supplierDraft.condicoes} onChange={(e) => setSupplierDraft((d) => ({ ...d, condicoes: e.target.value }))} />
              </FormRow>
              <div className="flex items-end">
                <Button type="submit" disabled={suppliersTable.insert.isPending}>
                  Criar
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {novoProdutoAberto && (
        <Card>
          <CardHeader title="Novo produto" subtitle="Depois de criado, preencha os preços por período na tabela abaixo (expandir 'Preços')." />
          <CardBody>
            <form onSubmit={handleCriarProduto} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <FormRow label="Segmento">
                <Select value={produtoDraft.segmento} onChange={(e) => setProdutoDraft((d) => ({ ...d, segmento: e.target.value as 'BTN' | 'BTE' | 'MT' }))}>
                  <option value="BTN">BTN</option>
                  <option value="BTE">BTE</option>
                  <option value="MT">MT</option>
                </Select>
              </FormRow>
              <FormRow label="Comercializadora">
                <Select required value={produtoDraft.supplier_id} onChange={(e) => setProdutoDraft((d) => ({ ...d, supplier_id: e.target.value }))}>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {(suppliers ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Nome do produto">
                <Input required value={produtoDraft.nome} onChange={(e) => setProdutoDraft((d) => ({ ...d, nome: e.target.value }))} {...fb('nome', produtoDraft.nome, vProduto.nome)} />
              </FormRow>
              <FormRow label="Tipo">
                <Select value={produtoDraft.tipo} onChange={(e) => setProdutoDraft((d) => ({ ...d, tipo: e.target.value as TipoProduto }))}>
                  <option value="ABERTO_FIXO">Aberto — Fixo</option>
                  <option value="ABERTO_INDEXADO">Aberto — Indexado</option>
                  <option value="FECHADO">Fechado</option>
                </Select>
              </FormRow>
              <FormRow label="Duração (meses, opcional)">
                <Select value={produtoDraft.duracao_meses} onChange={(e) => setProdutoDraft((d) => ({ ...d, duracao_meses: e.target.value }))}>
                  <option value="">—</option>
                  <option value="12">12</option>
                  <option value="18">18</option>
                  <option value="24">24</option>
                </Select>
              </FormRow>

              {produtoDraft.tipo !== 'FECHADO' && (
                <>
                  <FormRow label="GO (€/MWh)">
                    <Input type="number" step="0.1" numeric value={produtoDraft.go_valor} onChange={(e) => setProdutoDraft((d) => ({ ...d, go_valor: e.target.value }))} {...fb('go', produtoDraft.go_valor, vProduto.go)} />
                  </FormRow>
                  <FormRow label="Preço-limite (€/kWh)">
                    <Input type="number" step="0.0001" numeric value={produtoDraft.preco_limite} onChange={(e) => setProdutoDraft((d) => ({ ...d, preco_limite: e.target.value }))} {...fb('precoLimite', produtoDraft.preco_limite, vProduto.precoLimite)} />
                  </FormRow>
                </>
              )}

              {produtoDraft.tipo === 'ABERTO_INDEXADO' && (
                <>
                  <FormRow label="Índice de mercado">
                    <Select value={produtoDraft.indice_id} onChange={(e) => setProdutoDraft((d) => ({ ...d, indice_id: e.target.value }))}>
                      <option value="">—</option>
                      {(catalog?.marketIndices ?? []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </Select>
                  </FormRow>
                  <FormRow label="Margem">
                    <Input type="number" step="0.0001" numeric value={produtoDraft.margem} onChange={(e) => setProdutoDraft((d) => ({ ...d, margem: e.target.value }))} {...fb('margem', produtoDraft.margem, vProduto.margem)} />
                  </FormRow>
                </>
              )}

              {produtoDraft.tipo === 'FECHADO' && (
                <>
                  <FormRow label="Comissão fixa (€)">
                    <Input type="number" step="0.01" numeric value={produtoDraft.comissao_fixa} onChange={(e) => setProdutoDraft((d) => ({ ...d, comissao_fixa: e.target.value }))} {...fb('comissaoFixa', produtoDraft.comissao_fixa, vProduto.comissaoFixa)} />
                  </FormRow>
                  <FormRow label="Prioridade de comissão">
                    <Input type="number" step="1" numeric value={produtoDraft.prioridade_comissao} onChange={(e) => setProdutoDraft((d) => ({ ...d, prioridade_comissao: e.target.value }))} {...fb('prioridade', produtoDraft.prioridade_comissao, vProduto.prioridade)} />
                  </FormRow>
                </>
              )}

              {produtoDraft.segmento === 'BTN' && (
                <FormRow label={produtoDraft.tipo === 'FECHADO' ? 'Tabela de Potência' : 'Tabela de Potência (exceção — vazio usa a TAR transversal)'}>
                  <Select value={produtoDraft.potencia_tabela_id} onChange={(e) => setProdutoDraft((d) => ({ ...d, potencia_tabela_id: e.target.value }))}>
                    <option value="">—</option>
                    {(potenciaTabelas ?? [])
                      .filter((t) => t.segmento === produtoDraft.segmento)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </Select>
                </FormRow>
              )}

              <div className="flex items-end">
                <Button type="submit" disabled={products.insert.isPending || !produtoDraft.supplier_id}>
                  Criar produto
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Input
        placeholder="Pesquisar por comercializadora ou produto…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {agrupado.map(([segmento, byComercializadora]) => (
        <div key={segmento} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{SEGMENTO_LABEL[segmento]}</h2>
          {[...byComercializadora.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([comercializadora, byTipo]) => (
              <Card key={comercializadora}>
                <div className="border-b border-slate-200/70 px-5 py-3 dark:border-white/5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{comercializadora}</h3>
                </div>
                {(['Aberto', 'Fechado'] as const).map((tipoGrupo) => {
                  const lista = byTipo.get(tipoGrupo)
                  if (!lista || lista.length === 0) return null
                  return (
                    <div key={tipoGrupo} className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                          <tr>
                            <th className="px-4 py-3 font-medium">
                              Produtos {tipoGrupo === 'Aberto' ? 'Abertos' : 'Fechados'}
                            </th>
                            <th className="px-4 py-3 font-medium">GO (€/MWh)</th>
                            <th className="px-4 py-3 font-medium">Preço-limite (€/kWh)</th>
                            <th className="px-4 py-3 font-medium">Comissão fixa (€)</th>
                            <th className="px-4 py-3 font-medium">Prioridade</th>
                            <th className="px-4 py-3 font-medium">Ativo</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                          {lista.map((p) => (
                            <Fragment key={p.id}>
                              <tr className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {p.nome}
                                    {p.duracao_meses && <span className="text-xs text-slate-400">({p.duracao_meses}m)</span>}
                                    <Badge tone={p.tipo === 'FECHADO' ? 'neutral' : 'accent'}>{TIPO_LABEL[p.tipo]}</Badge>
                                    <Badge tone="neutral">{SEGMENTO_LABEL[p.segmento as 'BTN' | 'BTE' | 'MT']}</Badge>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  {p.tipo !== 'FECHADO' ? (
                                    <InlineNumberInput value={p.go_valor} onSave={(v) => saveProduct(p.id, { go_valor: v })} step="0.1" />
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <InlineNumberInput value={p.preco_limite} onSave={(v) => saveProduct(p.id, { preco_limite: v })} step="0.0001" />
                                </td>
                                <td className="px-4 py-2.5">
                                  {p.tipo === 'FECHADO' ? (
                                    <InlineNumberInput value={p.comissao_fixa} onSave={(v) => saveProduct(p.id, { comissao_fixa: v })} step="0.01" />
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {p.tipo === 'FECHADO' ? (
                                    <InlineNumberInput value={p.prioridade_comissao} onSave={(v) => saveProduct(p.id, { prioridade_comissao: v })} step="1" />
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={p.ativo}
                                    onChange={(e) => saveProduct(p.id, { ativo: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    className="text-xs font-medium text-accent hover:underline"
                                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                                  >
                                    {expanded === p.id ? 'Fechar' : 'Preços'}
                                  </button>
                                </td>
                              </tr>
                              {expanded === p.id && (
                                <tr>
                                  <td colSpan={7} className="bg-surface-muted/50 px-4 py-4 dark:bg-surface-dark-muted/40">
                                    <ProductPricesEditor
                                      product={p}
                                      prices={(energyPrices.data ?? []).filter((row) => row.product_id === p.id)}
                                      variants={variantesDoProduto(catalog?.variants ?? [], p.id)}
                                      onSavePrice={savePrice}
                                    />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </Card>
            ))}
        </div>
      ))}

      {agrupado.length === 0 && <p className="text-sm text-slate-400">Nenhum produto encontrado.</p>}
    </div>
  )
}

/** Etiqueta de uma variante para o admin — igual à mostrada ao consultor, mais o estado do grupo (EZU). */
function labelVarianteAdmin(v: ProductPriceVariant, todasDoProduto: ProductPriceVariant[]): string {
  if (v.data_inicio) {
    const grupo = todasDoProduto.filter((x) => x.data_inicio === v.data_inicio)
    const expirado = grupoExpirado(grupo) ? ' — Expirado' : grupoAtivo(todasDoProduto).some((a) => a.id === v.id) ? ' — Ativo' : ''
    return `${v.grupo_label} → ${v.fim_label}${expirado}`
  }
  return `${v.duracao_meses} meses`
}

function ProductPricesEditor({
  product,
  prices,
  variants,
  onSavePrice,
}: {
  product: Product
  prices: ProductEnergyPrice[]
  variants: ProductPriceVariant[]
  onSavePrice: (id: string, preco_base: number) => void
}) {
  const grupos: { variant: ProductPriceVariant | null; label: string; rows: ProductEnergyPrice[] }[] =
    variants.length > 0
      ? variants.map((v) => ({ variant: v, label: labelVarianteAdmin(v, variants), rows: prices.filter((p) => p.variant_id === v.id) }))
      : [{ variant: null, label: '', rows: prices }]

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {product.tipo === 'ABERTO_INDEXADO' ? 'Spread por período (€/kWh)' : 'Preço base por esquema/período (€/kWh)'}
        </p>
        {grupos.map((g, i) => (
          <div key={g.variant?.id ?? i}>
            {g.variant && <p className="mb-1.5 text-[11px] font-semibold text-accent">{g.label}</p>}
            <div className="flex flex-wrap gap-3">
              {g.rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200/70 bg-surface-card px-3 py-2 dark:border-white/10 dark:bg-surface-dark-card">
                  <p className="text-[11px] text-slate-400">
                    {row.esquema_horario} · {periodoLabel(row.periodo)}
                    {row.abaixo_20_7kva != null && (row.abaixo_20_7kva ? ' · ≤20,7kVA' : ' · >20,7kVA')}
                  </p>
                  <InlineNumberInput value={row.preco_base} onSave={(v) => onSavePrice(row.id, v)} step="0.0001" />
                </div>
              ))}
              {g.rows.length === 0 && <p className="text-sm text-slate-400">Sem preços configurados.</p>}
            </div>
          </div>
        ))}
      </div>

      {product.tipo === 'ABERTO_INDEXADO' && (
        <p className="text-xs text-slate-400">
          A fórmula do preço final e do GO deste produto edita-se na{' '}
          <Link to="/admin/pricing-grid" className="font-medium text-accent hover:underline">
            Grelha de Pricing
          </Link>
          .
        </p>
      )}

      <p className="text-xs text-slate-400">
        TAR é sempre transversal — editar em <Link to="/admin/tar" className="font-medium text-accent hover:underline">TAR</Link>.
        {product.segmento === 'BTN' && (
          <>
            {' '}
            Potência {product.tipo === 'FECHADO' ? 'própria deste produto' : 'transversal'} — editar em{' '}
            <Link to="/admin/potencia" className="font-medium text-accent hover:underline">
              Potência Contratada
            </Link>
            .
          </>
        )}
      </p>
    </div>
  )
}
