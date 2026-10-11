import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePontosConsumo } from '@/hooks/usePontosConsumo'
import { usePontosConsumoPrefs, useSavePontosConsumoPrefs } from '@/hooks/useTableViewPrefs'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { DiasRenovacaoBadge, EstadoPontoConsumoBadge } from '@/components/ui/Badge'
import { ExportButtons } from '@/components/ExportButtons'
import { exportToExcel, exportToPdf } from '@/lib/export'
import { PontoConsumoFormModal } from '@/pages/pontosConsumo/PontoConsumoFormModal'
import { AssociarClienteModal } from '@/pages/pontosConsumo/AssociarClienteModal'
import { ColumnFilterPopover, isFilterActive, type ColumnFilterValue, type ColumnType, type EnumFilter, type RangeFilter, type TextFilter } from '@/pages/pontosConsumo/ColumnFilterPopover'
import { formatDate } from '@/lib/format'
import { diasAteRenovacao } from '@/lib/pontoConsumo'
import type { PontoConsumo } from '@/types/database'

interface ColumnDef {
  key: string
  label: string
  type: ColumnType
  getValue: (p: PontoConsumo) => string | number | null
  render: (p: PontoConsumo) => React.ReactNode
}

const COLUMNS: ColumnDef[] = [
  { key: 'cpe', label: 'CPE', type: 'text', getValue: (p) => p.cpe, render: (p) => <span className="font-numeric font-medium text-slate-900 dark:text-slate-100">{p.cpe}</span> },
  { key: 'cliente', label: 'Cliente', type: 'text', getValue: (p) => p.cliente, render: (p) => p.cliente },
  { key: 'nif', label: 'NIF', type: 'text', getValue: (p) => p.nif, render: (p) => <span className="font-numeric">{p.nif ?? '—'}</span> },
  { key: 'estado', label: 'Estado', type: 'enum', getValue: (p) => p.estado, render: (p) => <EstadoPontoConsumoBadge estado={p.estado} /> },
  {
    key: 'potencia_contratada',
    label: 'Potência Contratada',
    type: 'number',
    getValue: (p) => p.potencia_contratada,
    render: (p) => <span className="font-numeric">{p.potencia_contratada != null ? `${p.potencia_contratada} kVA` : '—'}</span>,
  },
  { key: 'data_ativacao', label: 'Data de Início', type: 'date', getValue: (p) => p.data_ativacao, render: (p) => formatDate(p.data_ativacao) },
  { key: 'data_fim_contrato', label: 'Data de Fim / Renovação', type: 'date', getValue: (p) => p.data_fim_contrato, render: (p) => formatDate(p.data_fim_contrato) },
  { key: 'dias_restantes', label: 'Dias até Renovação', type: 'number', getValue: (p) => diasAteRenovacao(p), render: (p) => <DiasRenovacaoBadge dias={diasAteRenovacao(p)} /> },
  {
    key: 'consumo_anual',
    label: 'Consumo Anual',
    type: 'number',
    getValue: (p) => p.consumo_anual,
    render: (p) => <span className="font-numeric">{p.consumo_anual != null ? `${p.consumo_anual.toLocaleString('pt-PT')} kWh` : '—'}</span>,
  },
  { key: 'num_periodos', label: 'Nº de Renovações', type: 'number', getValue: (p) => p.num_periodos, render: (p) => <span className="font-numeric">{p.num_periodos}</span> },
]

const PAGE_SIZES = [50, 100, 200]

export function PontosConsumoListPage() {
  const navigate = useNavigate()
  const { data: pontos, isLoading } = usePontosConsumo()
  const { data: prefs } = usePontosConsumoPrefs()
  const savePrefs = useSavePontosConsumoPrefs()

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Record<string, ColumnFilterValue>>({})
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null)
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [associarOpen, setAssociarOpen] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const prefsLoaded = useRef(false)
  useEffect(() => {
    if (prefsLoaded.current || !prefs) return
    prefsLoaded.current = true
    if (prefs.colunas) setHiddenColumns(new Set(COLUMNS.map((c) => c.key).filter((k) => !prefs.colunas!.includes(k))))
    if (prefs.filtros) setFilters(prefs.filtros as Record<string, ColumnFilterValue>)
    if (prefs.ordenacao) setSort(prefs.ordenacao)
  }, [prefs])

  useEffect(() => {
    if (!prefsLoaded.current) return
    const timeout = setTimeout(() => {
      savePrefs.mutate({
        colunas: COLUMNS.map((c) => c.key).filter((k) => !hiddenColumns.has(k)),
        filtros: filters,
        ordenacao: sort,
      })
    }, 600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenColumns, filters, sort])

  const visibleColumns = COLUMNS.filter((c) => !hiddenColumns.has(c.key))

  const enumOptionsByColumn = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const col of COLUMNS) {
      if (col.type !== 'enum') continue
      map[col.key] = [...new Set((pontos ?? []).map((p) => String(col.getValue(p) ?? '')).filter(Boolean))]
    }
    return map
  }, [pontos])

  const filtered = useMemo(() => {
    let rows = pontos ?? []

    for (const col of COLUMNS) {
      const f = filters[col.key]
      if (!isFilterActive(col.type, f)) continue
      rows = rows.filter((p) => {
        const v = col.getValue(p)
        if (col.type === 'text') {
          const needle = (f as TextFilter).text.toLowerCase()
          return String(v ?? '').toLowerCase().includes(needle)
        }
        if (col.type === 'enum') {
          return (f as EnumFilter).values.includes(String(v ?? ''))
        }
        const r = f as RangeFilter
        if (v === null || v === undefined) return false
        if (col.type === 'date') {
          if (r.min && String(v) < r.min) return false
          if (r.max && String(v) > r.max) return false
          return true
        }
        const num = Number(v)
        if (r.min && num < Number(r.min)) return false
        if (r.max && num > Number(r.max)) return false
        return true
      })
    }

    if (search.trim()) {
      const needle = search.trim().toLowerCase()
      rows = rows.filter((p) => COLUMNS.some((col) => String(col.getValue(p) ?? '').toLowerCase().includes(needle)))
    }

    if (sort) {
      const col = COLUMNS.find((c) => c.key === sort.key)
      if (col) {
        rows = [...rows].sort((a, b) => {
          const va = col.getValue(a)
          const vb = col.getValue(b)
          if (va === null || va === undefined) return 1
          if (vb === null || vb === undefined) return -1
          const cmp = va < vb ? -1 : va > vb ? 1 : 0
          return sort.direction === 'asc' ? cmp : -cmp
        })
      }
    }

    return rows
  }, [pontos, filters, search, sort])

  useEffect(() => setPage(0), [filters, search, sort, pageSize])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const selecionadosLinhas = filtered.filter((p) => selecionados.has(p.id))
  const todosFiltradosSelecionados = filtered.length > 0 && filtered.every((p) => selecionados.has(p.id))

  function toggleSelecionarTodosFiltrados() {
    setSelecionados((prev) => {
      if (todosFiltradosSelecionados) {
        const next = new Set(prev)
        for (const p of filtered) next.delete(p.id)
        return next
      }
      const next = new Set(prev)
      for (const p of filtered) next.add(p.id)
      return next
    })
  }

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, direction: 'asc' }
      if (s.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Pontos de Consumo</h1>
        <div className="flex items-center gap-2">
          <ExportButtons
            filename="Pontos-de-Consumo"
            csv
            pdf={false}
            headers={visibleColumns.map((c) => c.label)}
            rows={filtered.map((p) => visibleColumns.map((c) => c.getValue(p) ?? ''))}
          />
          <Button onClick={() => setFormOpen(true)}>+ Novo Ponto de Consumo</Button>
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm dark:bg-accent/10">
          <span className="text-slate-700 dark:text-slate-200">{selecionados.size} selecionado(s)</span>
          <Button type="button" size="sm" onClick={() => setAssociarOpen(true)}>
            Associar a cliente
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              void exportToExcel(
                'Pontos-de-Consumo-Selecionados',
                visibleColumns.map((c) => c.label),
                selecionadosLinhas.map((p) => visibleColumns.map((c) => c.getValue(p) ?? '')),
              )
            }
          >
            Exportar selecionados — Excel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              void exportToPdf(
                'Pontos-de-Consumo-Selecionados',
                visibleColumns.map((c) => c.label),
                selecionadosLinhas.map((p) => visibleColumns.map((c) => c.getValue(p) ?? '')),
              )
            }
          >
            Exportar selecionados — PDF
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Pesquisar em todas as colunas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="relative">
          <Button type="button" variant="secondary" size="sm" onClick={() => setColumnsMenuOpen((v) => !v)}>
            Colunas
          </Button>
          {columnsMenuOpen && (
            <div className="absolute z-30 mt-1 w-56 space-y-1.5 rounded-lg border border-slate-200/70 bg-surface-card p-3 shadow-lg dark:border-white/10 dark:bg-surface-dark-card">
              {COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(c.key)}
                    onChange={(e) =>
                      setHiddenColumns((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.delete(c.key)
                        else next.add(c.key)
                        return next
                      })
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos os filtrados"
                    checked={todosFiltradosSelecionados}
                    onChange={toggleSelecionarTodosFiltrados}
                  />
                </th>
                {visibleColumns.map((col) => (
                  <th key={col.key} className="relative px-4 py-3 font-medium">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200"
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        {sort?.key === col.key && <span>{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                      </button>
                      <button
                        type="button"
                        aria-label={`Filtrar ${col.label}`}
                        className={isFilterActive(col.type, filters[col.key]) ? 'text-accent' : 'text-slate-300 hover:text-slate-500 dark:text-slate-600'}
                        onClick={() => setOpenFilterCol((k) => (k === col.key ? null : col.key))}
                      >
                        ▾
                      </button>
                    </div>
                    {openFilterCol === col.key && (
                      <ColumnFilterPopover
                        type={col.type}
                        value={filters[col.key]}
                        isDate={col.type === 'date'}
                        enumOptions={enumOptionsByColumn[col.key]}
                        onChange={(v) =>
                          setFilters((prev) => {
                            const next = { ...prev }
                            if (v) next[col.key] = v
                            else delete next[col.key]
                            return next
                          })
                        }
                        onClose={() => setOpenFilterCol(null)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-5 py-6 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}
              {!isLoading && paged.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-5 py-6 text-center text-slate-400">
                    Nenhum ponto de consumo encontrado.
                  </td>
                </tr>
              )}
              {paged.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/50 dark:hover:bg-white/5">
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${p.cpe}`}
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSelecionado(p.id)}
                    />
                  </td>
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="cursor-pointer px-4 py-3" onClick={() => navigate(`/pontos-consumo/${p.id}`)}>
                      {col.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-4 py-3 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
          <span>
            {filtered.length} ponto(s) de consumo {filtered.length !== (pontos?.length ?? 0) && `(de ${pontos?.length ?? 0} no total)`}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              Por página:
              <select
                className="rounded-lg border border-slate-300 bg-surface-card px-2 py-1 text-sm dark:border-white/10 dark:bg-surface-dark-muted"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Seguinte
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {formOpen && <PontoConsumoFormModal onClose={() => setFormOpen(false)} />}
      {associarOpen && (
        <AssociarClienteModal
          pontos={(pontos ?? []).filter((p) => selecionados.has(p.id))}
          onClose={() => setAssociarOpen(false)}
          onDone={() => {
            setAssociarOpen(false)
            setSelecionados(new Set())
          }}
        />
      )}
    </div>
  )
}
