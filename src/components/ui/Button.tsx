import type { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[0_4px_12px_rgb(22_84_58/0.25)] hover:bg-brand-dark',
  secondary:
    'border border-slate-200 bg-surface-muted text-slate-900 hover:bg-brand hover:text-white dark:bg-surface-dark-muted dark:text-slate-100',
  ghost: 'bg-transparent text-slate-600 hover:bg-surface-muted dark:text-slate-300 dark:hover:bg-white/5',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-[transform,background-color,color] duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  )
}
