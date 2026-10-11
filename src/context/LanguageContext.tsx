import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { pt } from '@/i18n/pt'
import { en } from '@/i18n/en'

export type Language = 'pt' | 'en'
type Dictionary = typeof pt

const DICTIONARIES: Record<Language, Dictionary> = { pt, en }

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  /** Dicionário de strings da interface no idioma atual — nunca traduz termos técnicos (CPE, TAR, GO)
   * nem dados inseridos pelo consultor (nomes de clientes, notas), só o texto da própria aplicação. */
  t: Dictionary
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)
const STORAGE_KEY = 'energyit-language'

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'pt' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'pt'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, t: DICTIONARIES[language] }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
