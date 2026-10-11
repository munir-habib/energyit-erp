import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** true quando o sistema operativo tem "reduzir movimento" ativo — usado para desligar animações
 * que não são puramente CSS (ex: as transições dos gráficos Recharts). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
