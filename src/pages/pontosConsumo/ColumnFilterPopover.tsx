import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

export type ColumnType = 'text' | 'enum' | 'date' | 'number'

export interface TextFilter {
  text: string
}
export interface EnumFilter {
  values: string[]
}
export interface RangeFilter {
  min?: string
  max?: string
}

export type ColumnFilterValue = TextFilter | EnumFilter | RangeFilter

export function isFilterActive(type: ColumnType, value: ColumnFilterValue | undefined): boolean {
  if (!value) return false
  if (type === 'text') return !!(value as TextFilter).text
  if (type === 'enum') return (value as EnumFilter).values.length > 0
  const r = value as RangeFilter
  return !!r.min || !!r.max
}

function useOutsideClick(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

export function ColumnFilterPopover({
  type,
  value,
  onChange,
  onClose,
  enumOptions,
  isDate,
}: {
  type: ColumnType
  value: ColumnFilterValue | undefined
  onChange: (value: ColumnFilterValue | undefined) => void
  onClose: () => void
  enumOptions?: string[]
  isDate?: boolean
}) {
  const ref = useOutsideClick(onClose)

  if (type === 'text') {
    const v = (value as TextFilter | undefined)?.text ?? ''
    return (
      <div ref={ref} className="absolute z-30 mt-1 w-56 rounded-lg border border-slate-200/70 bg-surface-card p-3 shadow-lg dark:border-white/10 dark:bg-surface-dark-card">
        <Input
          autoFocus
          placeholder="Pesquisar…"
          value={v}
          onChange={(e) => onChange(e.target.value ? { text: e.target.value } : undefined)}
        />
      </div>
    )
  }

  if (type === 'enum') {
    const selected = new Set((value as EnumFilter | undefined)?.values ?? [])
    return (
      <div ref={ref} className="absolute z-30 mt-1 w-48 rounded-lg border border-slate-200/70 bg-surface-card p-3 shadow-lg dark:border-white/10 dark:bg-surface-dark-card">
        <div className="space-y-1.5">
          {(enumOptions ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(opt)
                  else next.delete(opt)
                  onChange(next.size > 0 ? { values: [...next] } : undefined)
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    )
  }

  // date | number range
  const r = (value as RangeFilter | undefined) ?? {}
  return (
    <div ref={ref} className="absolute z-30 mt-1 w-56 space-y-2 rounded-lg border border-slate-200/70 bg-surface-card p-3 shadow-lg dark:border-white/10 dark:bg-surface-dark-card">
      <Input
        type={isDate ? 'date' : 'number'}
        placeholder={isDate ? undefined : 'Mín.'}
        value={r.min ?? ''}
        onChange={(e) => {
          const next = { ...r, min: e.target.value || undefined }
          onChange(next.min || next.max ? next : undefined)
        }}
      />
      <Input
        type={isDate ? 'date' : 'number'}
        placeholder={isDate ? undefined : 'Máx.'}
        value={r.max ?? ''}
        onChange={(e) => {
          const next = { ...r, max: e.target.value || undefined }
          onChange(next.min || next.max ? next : undefined)
        }}
      />
      <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange(undefined)}>
        Limpar
      </Button>
    </div>
  )
}
