import { useEffect, useState } from 'react'
import clsx from 'clsx'

/** Editor de data inline — guarda ao sair do campo (blur) ou ao carregar Enter. */
export function InlineDateInput({
  value,
  onSave,
  min,
  className,
}: {
  value: string | null
  onSave: (value: string) => void
  min?: string
  className?: string
}) {
  const [local, setLocal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocal(value ?? '')
  }, [value])

  async function commit() {
    if (!local || local === value) return
    setSaving(true)
    try {
      await onSave(local)
    } finally {
      setSaving(false)
    }
  }

  return (
    <input
      type="date"
      value={local}
      min={min}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={clsx(
        'font-numeric rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-300 focus:border-accent focus:bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent/20 dark:hover:border-white/20 dark:focus:bg-surface-dark-muted',
        saving && 'opacity-50',
        className,
      )}
    />
  )
}
