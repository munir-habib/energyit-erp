import { useState, type InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Field'
import { useLanguage } from '@/context/LanguageContext'

/** Campo de password com botão para mostrar/ocultar o que está a ser escrito. */
export function PasswordInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const { t } = useLanguage()
  const label = visible ? t.login.hidePassword : t.login.showPassword
  return (
    <div className="relative">
      <Input {...rest} type={visible ? 'text' : 'password'} className={`pr-10 ${className ?? ''}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:text-brand dark:text-slate-400"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  )
}
