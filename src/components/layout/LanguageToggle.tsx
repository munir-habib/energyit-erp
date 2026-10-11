import clsx from 'clsx'
import { useLanguage, type Language } from '@/context/LanguageContext'

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
]

/** Seletor PT | EN — troca a interface de imediato e persiste a escolha (ver LanguageContext). */
export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div
      role="group"
      aria-label={t.topbar.toggleLanguage}
      className="glass-btn flex h-9 items-center overflow-hidden rounded-full p-0.5 text-xs font-semibold"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLanguage(o.value)}
          aria-pressed={language === o.value}
          className={clsx(
            'h-full rounded-full px-2.5 transition-colors',
            language === o.value ? 'bg-brand text-white' : 'text-slate-600 hover:text-brand dark:text-slate-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
