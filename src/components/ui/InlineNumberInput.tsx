import { useEffect, useState } from 'react'
import clsx from 'clsx'

export function InlineNumberInput({
  value,
  onSave,
  step = 'any',
  className,
  suffix,
}: {
  value: number | null
  onSave: (value: number) => void
  step?: string
  className?: string
  suffix?: string
}) {
  const [local, setLocal] = useState(value?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocal(value?.toString() ?? '')
  }, [value])

  async function commit() {
    const parsed = Number(local)
    if (Number.isNaN(parsed) || parsed === value) return
    setSaving(true)
    try {
      await onSave(parsed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step={step}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={clsx(
          'font-numeric w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-300 focus:border-accent focus:bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent/20 dark:hover:border-white/20 dark:focus:bg-surface-dark-muted',
          saving && 'opacity-50',
          className,
        )}
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  )
}
