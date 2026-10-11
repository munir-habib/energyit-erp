/** Marca EnergyIT: círculo verde com raio dourado e um halo dourado que pulsa. `light` põe o texto
 * a branco (fundos escuros, ex.: ecrã de login). */
export function EnergyItLogo({ light = false, hideText = false }: { light?: boolean; hideText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex h-[30px] w-[30px] items-center justify-center">
        <span aria-hidden className="logo-halo absolute inset-0 rounded-full bg-gold/60" />
        <span className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gold-soft" aria-hidden>
            <path d="M13 2 4.5 13.5H11L10 22l9-12h-6.5L13 2Z" />
          </svg>
        </span>
      </span>
      {!hideText && (
        <span className={`text-[17px] font-bold tracking-tight ${light ? 'text-white' : 'text-brand dark:text-white'}`}>
          EnergyIT
        </span>
      )}
    </span>
  )
}
