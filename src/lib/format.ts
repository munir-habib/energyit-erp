export function formatEur(value: number, digits = 2): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    value,
  )
}

export function formatEurPerKwh(value: number): string {
  return `${value.toLocaleString('pt-PT', { minimumFractionDigits: 4, maximumFractionDigits: 6 })} €/kWh`
}

/** GO (€/MWh) com vírgula decimal pt-PT, como o resto da app: 12.5 → "12,5 €/MWh". null → "—" (ex: simulações antigas sem GO gravado). */
export function formatGo(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} €/MWh`
}

export function formatKwh(value: number): string {
  return `${value.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} kWh`
}

export function formatPct(value: number): string {
  return `${value.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-PT')
}

export function formatMonth(value: string): string {
  return new Date(value).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}
