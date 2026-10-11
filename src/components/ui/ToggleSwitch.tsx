import clsx from 'clsx'

/** Interruptor on/off independente — estado sempre óbvio (preenchido = ligado, contorno = desligado). */
export function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        checked
          ? 'border-accent bg-accent text-white'
          : 'border-slate-300 bg-transparent text-slate-500 dark:border-white/15 dark:text-slate-400',
      )}
    >
      <span
        className={clsx(
          'relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors',
          checked ? 'bg-white/40' : 'bg-slate-300 dark:bg-white/15',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-3' : 'translate-x-0.5',
            !checked && 'bg-slate-500 dark:bg-slate-300',
          )}
        />
      </span>
      {label}
    </button>
  )
}
