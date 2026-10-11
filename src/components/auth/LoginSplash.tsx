import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const STORAGE_KEY = 'energyit-intro-seen'

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* sessionStorage indisponível (janela privada, bloqueio): a animação volta a correr, sem problema */
  }
}

/**
 * Animação de abertura (~3s): círculo com raio a saltar, VIKSA, GROUP e barra dourada a encher.
 * Corre uma vez por sessão do browser, por cima do ecrã que estiver a carregar (login, ou dashboard
 * se já houver sessão), e desvanece (400ms) no fim. Um clique salta-a.
 */
export function LoginSplash() {
  const reducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(() => !alreadySeen())
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    markSeen()
    const showMs = reducedMotion ? 250 : 3300
    const t1 = setTimeout(() => setLeaving(true), showMs)
    const t2 = setTimeout(() => setVisible(false), showMs + 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [visible, reducedMotion])

  if (!visible) return null

  return (
    <div
      role="presentation"
      onClick={() => {
        setLeaving(true)
        setTimeout(() => setVisible(false), 400)
      }}
      className={clsx(
        'fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-5 transition-opacity duration-[400ms]',
        leaving ? 'opacity-0' : 'opacity-100',
      )}
      style={{ background: 'linear-gradient(135deg, #0F2A1D 0%, #16543A 45%, #2E6B4A 75%, #C9A24B 130%)' }}
    >
      <div className={clsx('relative flex h-20 w-20 items-center justify-center', !reducedMotion && 'splash-logo')}>
        <span aria-hidden className="logo-halo absolute inset-0 rounded-full bg-gold/50" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="#16543A" aria-hidden>
            <path d="M13 2 4.5 13.5H11L10 22l9-12h-6.5L13 2Z" />
          </svg>
        </span>
      </div>
      <p className={clsx('text-2xl font-bold tracking-[0.3em] text-gold-soft', !reducedMotion && 'splash-viksa')}>VIKSA</p>
      <p className={clsx('-mt-3 text-sm font-semibold tracking-[0.6em] text-white', !reducedMotion && 'splash-group')}>GROUP</p>
      <div className="h-[3px] w-[120px] overflow-hidden rounded-full bg-white/20">
        <div
          className={clsx('h-full w-full rounded-full', !reducedMotion && 'splash-progress')}
          style={{ background: 'linear-gradient(90deg, #C9A24B, #E8C97A)' }}
        />
      </div>
    </div>
  )
}
