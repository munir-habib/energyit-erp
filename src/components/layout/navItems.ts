import type { pt } from '@/i18n/pt'

type Dictionary = typeof pt

export interface NavItemDef {
  to: string
  label: string
  icon: string
  end?: boolean
}

/** Itens de navegação partilhados entre a Sidebar (desktop) e o MobileNav — uma só fonte, sem divergências. */
export function businessNav(t: Dictionary): NavItemDef[] {
  return [
    { to: '/', label: t.nav.dashboard, icon: '▦', end: true },
    { to: '/clientes', label: t.nav.clients, icon: '\u{1F465}' },
    { to: '/grupos', label: t.nav.groups, icon: '\u{1F517}' },
    { to: '/faturas', label: t.nav.invoices, icon: '\u{1F4C4}' },
    { to: '/simulacoes', label: t.nav.simulations, icon: '\u{1F9EE}' },
    { to: '/contratos', label: t.nav.contracts, icon: '\u{1F4DD}' },
    { to: '/pontos-consumo', label: t.nav.consumptionPoints, icon: '\u{1F3E2}' },
    { to: '/comissoes', label: t.nav.commissions, icon: '\u{1F4B6}' },
    { to: '/importar', label: t.nav.import, icon: '\u{1F4E5}' },
  ]
}

export function adminNav(t: Dictionary): NavItemDef[] {
  return [
    { to: '/admin/pricing-grid', label: t.nav.adminPricingGrid, icon: '\u{1F522}' },
    { to: '/admin/produtos', label: t.nav.adminProducts, icon: '\u{1F4E6}' },
    { to: '/admin/tar', label: t.nav.adminTar, icon: '\u{1F50C}' },
    { to: '/admin/potencia', label: t.nav.adminPower, icon: '⚡' },
    { to: '/admin/comissoes', label: t.nav.adminCommissionRules, icon: '⚖️' },
    { to: '/admin/indices', label: t.nav.adminMarketIndices, icon: '\u{1F4C8}' },
    { to: '/admin/contas', label: t.nav.adminAccounts, icon: '\u{1F464}' },
    { to: '/admin/auditoria', label: t.nav.adminAudit, icon: '\u{1F4CB}' },
  ]
}

/** Itens sempre visíveis na pílula do topo (desktop). O resto da navegação fica no menu "Mais". */
const TOP_PATHS = ['/', '/clientes', '/faturas', '/simulacoes', '/contratos', '/comissoes']

export function topNav(t: Dictionary): NavItemDef[] {
  return businessNav(t).filter((i) => TOP_PATHS.includes(i.to))
}

export function moreNav(t: Dictionary): NavItemDef[] {
  return businessNav(t).filter((i) => !TOP_PATHS.includes(i.to))
}
