import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useClients } from '@/hooks/useClients'
import { useSimulations } from '@/hooks/useSimulations'
import { useContracts } from '@/hooks/useContracts'
import { usePontosConsumo } from '@/hooks/usePontosConsumo'
import { diasAteRenovacao } from '@/lib/pontoConsumo'
import { DiasRenovacaoBadge } from '@/components/ui/Badge'
import type { PontoConsumo } from '@/types/database'
import {
  useAdminCatalogKpis,
  useCommissionsBySupplier,
  useCommissionsStatus,
  useFunnelCounts,
  useRenewalsUpcoming,
  useRevenueByMonth,
  useSavingsTotal,
} from '@/hooks/useDashboardMetrics'
import { Card, CardBody, CardHeader, HighlightCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate, formatEur, formatMonth } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { chartPalette } from '@/lib/chartColors'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

function StatCard({ label, value, tone, featured }: { label: string; value: string; tone?: 'savings' | 'pending' | 'gold'; featured?: boolean }) {
  const Wrapper = featured ? HighlightCard : Card
  return (
    <Wrapper>
      <CardBody>
        <p className="text-xs text-slate-400">{label}</p>
        <p
          className={`font-numeric mt-1 text-2xl font-semibold ${
            tone === 'savings' ? 'text-savings dark:text-savings-dark' : tone === 'gold' ? 'commission-value' : tone === 'pending' ? 'text-pending' : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {value}
        </p>
      </CardBody>
    </Wrapper>
  )
}

const FUNNEL_ORDER = ['SIMULACAO', 'PROPOSTA_ENVIADA', 'CONTRATO_ASSINADO'] as const

export function DashboardPage() {
  const { profile, isAdmin } = useAuth()
  const { theme } = useTheme()
  const { t } = useLanguage()
  const palette = chartPalette(theme)
  const reducedMotion = usePrefersReducedMotion()

  const { data: clients } = useClients()
  const { data: simulations } = useSimulations()
  const { data: contracts } = useContracts()
  const { data: pontosConsumo } = usePontosConsumo()
  const { data: revenueByMonth } = useRevenueByMonth()
  const { data: funnelCounts } = useFunnelCounts()
  const { data: renewals } = useRenewalsUpcoming()
  const { data: commissionsBySupplier } = useCommissionsBySupplier()
  const { data: commissionsStatus } = useCommissionsStatus()
  const { data: savingsTotal } = useSavingsTotal()
  const { data: adminKpis } = useAdminCatalogKpis()

  const contratosAtivos =
    (contracts ?? []).filter((c) => c.estado === 'ATIVO').length +
    (pontosConsumo ?? []).filter((p) => p.estado === 'Ativo').length
  const pendente = (commissionsStatus ?? []).find((s) => s.estado === 'NAO_PAGO')?.total ?? 0
  const pago = (commissionsStatus ?? []).find((s) => s.estado === 'PAGO')?.total ?? 0
  const recentes = (simulations ?? []).slice(0, 5)

  const clientesUnicos = useMemo(() => {
    const chaves = new Set((pontosConsumo ?? []).map((p) => (p.nif ? `nif:${p.nif}` : `nome:${p.cliente.toLowerCase()}`)))
    return (clients?.length ?? 0) + chaves.size
  }, [clients, pontosConsumo])

  const alertasGoAtivos = useMemo(
    () => (simulations ?? []).filter((s) => s.resultados.some((r) => r.alerta_go)).length,
    [simulations],
  )

  const revenueSeries = useMemo(
    () => (revenueByMonth ?? []).map((r) => ({ mes: formatMonth(r.mes), total: r.total })),
    [revenueByMonth],
  )

  const funnelSeries = useMemo(() => {
    const byEtapa = new Map((funnelCounts ?? []).map((f) => [f.etapa, f.total]))
    return FUNNEL_ORDER.map((etapa) => ({ etapa: t.dashboard.funnel[etapa], total: byEtapa.get(etapa as never) ?? 0 }))
  }, [funnelCounts, t])

  const supplierSeries = useMemo(() => {
    const sorted = [...(commissionsBySupplier ?? [])].sort((a, b) => b.total - a.total)
    const top = sorted.slice(0, 3)
    const outros = sorted.slice(3).reduce((s, r) => s + r.total, 0)
    return outros > 0 ? [...top, { fornecedor: t.dashboard.otherSuppliers, total: outros }] : top
  }, [commissionsBySupplier, t])

  const pontosConsumoRenovacoes = useMemo(
    () =>
      (pontosConsumo ?? [])
        .map((p) => ({ p, dias: diasAteRenovacao(p) }))
        .filter((r): r is { p: PontoConsumo; dias: number } => r.dias !== null && r.dias >= 0 && r.dias <= 90)
        .sort((a, b) => a.dias - b.dias),
    [pontosConsumo],
  )

  const renewalBuckets = useMemo(() => {
    const contratoRows = renewals ?? []
    const pontosDias = pontosConsumoRenovacoes.map((r) => r.dias)
    return {
      d30: contratoRows.filter((r) => r.dias_restantes <= 30).length + pontosDias.filter((d) => d <= 30).length,
      d60: contratoRows.filter((r) => r.dias_restantes <= 60).length + pontosDias.filter((d) => d <= 60).length,
      d90: contratoRows.filter((r) => r.dias_restantes <= 90).length + pontosDias.filter((d) => d <= 90).length,
    }
  }, [renewals, pontosConsumoRenovacoes])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t.dashboard.greeting(profile?.nome ?? t.dashboard.consultantFallback)}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.dashboard.subtitle}</p>
        </div>
        <Link to="/simulacoes/nova">
          <Button>{t.dashboard.newSimulation}</Button>
        </Link>
      </div>

      {isAdmin && adminKpis && (
        <Card>
          <CardHeader
            title={t.dashboard.adminPanelTitle}
            subtitle={t.dashboard.adminPanelSubtitle}
          />
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">{t.dashboard.activeProducts}</p>
              <p className="font-numeric text-xl font-semibold text-slate-900 dark:text-slate-100">{adminKpis.produtosAtivos}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t.dashboard.outdatedIndices}</p>
              <p className="font-numeric text-xl font-semibold text-pending">{adminKpis.indicesDesatualizados}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t.dashboard.registeredAccounts}</p>
              <p className="font-numeric text-xl font-semibold text-slate-900 dark:text-slate-100">{adminKpis.contas}</p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.dashboard.stat.clients} value={String(clientesUnicos)} />
        <StatCard label={t.dashboard.stat.activeContracts} value={String(contratosAtivos)} />
        <StatCard label={t.dashboard.stat.consumptionPoints} value={String(pontosConsumo?.length ?? 0)} />
        <StatCard label={t.dashboard.stat.pendingCommissions} value={formatEur(pendente)} tone="gold" />
        <StatCard label={t.dashboard.stat.paidCommissions} value={formatEur(pago)} tone="gold" />
        <StatCard label={t.dashboard.stat.totalSavingsDelivered} value={formatEur(savingsTotal ?? 0)} tone="savings" featured />
        <StatCard label={t.dashboard.stat.activeGoAlerts} value={String(alertasGoAtivos)} tone={alertasGoAtivos > 0 ? 'pending' : undefined} />
        <StatCard label={t.dashboard.stat.renewals30} value={String(renewalBuckets.d30)} />
        <StatCard label={t.dashboard.stat.renewals90} value={String(renewalBuckets.d90)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.dashboard.revenueChartTitle} subtitle={t.dashboard.revenueChartSubtitle} />
          <CardBody className="h-64">
            {revenueSeries.length === 0 ? (
              <p className="text-sm text-slate-400">{t.dashboard.noCommissionsYet}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="mes" stroke={palette.axis} tick={{ fill: palette.inkMuted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: palette.axis }} />
                  <YAxis stroke={palette.axis} tick={{ fill: palette.inkMuted, fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    formatter={(value) => formatEur(Number(value))}
                    contentStyle={{ background: palette.surface, border: `1px solid ${palette.grid}`, borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="total" name={t.dashboard.commissionsSeriesName} stroke={palette.sequential} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.funnelChartTitle} />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelSeries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.categorical[0]} />
                    <stop offset="100%" stopColor={palette.categorical[2]} />
                  </linearGradient>
                  <linearGradient id="barGradCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.categorical[1]} />
                    <stop offset="35%" stopColor={palette.categorical[0]} />
                    <stop offset="100%" stopColor={palette.categorical[2]} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={palette.grid} vertical={false} />
                <XAxis dataKey="etapa" stroke={palette.axis} tick={{ fill: palette.inkMuted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: palette.axis }} />
                <YAxis stroke={palette.axis} tick={{ fill: palette.inkMuted, fontSize: 12 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <Tooltip contentStyle={{ background: palette.surface, border: `1px solid ${palette.grid}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" name={t.dashboard.funnelSeriesName} fill="url(#barGrad)" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={!reducedMotion} animationDuration={900} animationEasing="ease-out">
                  {funnelSeries.map((d, i) => (
                    <Cell key={d.etapa} fill={i === funnelSeries.length - 1 ? 'url(#barGradCurrent)' : 'url(#barGrad)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.supplierChartTitle} />
          <CardBody className="h-64">
            {supplierSeries.length === 0 ? (
              <p className="text-sm text-slate-400">{t.dashboard.noCommissionsYet}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierSeries} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={palette.grid} horizontal={false} />
                  <XAxis type="number" stroke={palette.axis} tick={{ fill: palette.inkMuted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: palette.axis }} />
                  <YAxis
                    type="category"
                    dataKey="fornecedor"
                    stroke={palette.axis}
                    tick={{ fill: palette.inkSecondary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(value) => formatEur(Number(value))}
                    contentStyle={{ background: palette.surface, border: `1px solid ${palette.grid}`, borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="total" name={t.dashboard.supplierSeriesName} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={!reducedMotion} animationDuration={650} animationEasing="ease-out">
                    {supplierSeries.map((entry, i) => (
                      <Cell key={entry.fornecedor} fill={palette.categorical[i % palette.categorical.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.renewalsUpcomingTitle} subtitle={t.dashboard.renewalsUpcomingSubtitle} />
          <CardBody className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface-muted px-3 py-2 dark:bg-surface-dark-muted">
                <p className="font-numeric text-lg font-semibold text-slate-900 dark:text-slate-100">{renewalBuckets.d30}</p>
                <p className="text-[11px] text-slate-400">{t.dashboard.days30}</p>
              </div>
              <div className="rounded-lg bg-surface-muted px-3 py-2 dark:bg-surface-dark-muted">
                <p className="font-numeric text-lg font-semibold text-slate-900 dark:text-slate-100">{renewalBuckets.d60}</p>
                <p className="text-[11px] text-slate-400">{t.dashboard.days60}</p>
              </div>
              <div className="rounded-lg bg-surface-muted px-3 py-2 dark:bg-surface-dark-muted">
                <p className="font-numeric text-lg font-semibold text-slate-900 dark:text-slate-100">{renewalBuckets.d90}</p>
                <p className="text-[11px] text-slate-400">{t.dashboard.days90}</p>
              </div>
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {(renewals ?? []).map((r) => (
                <Link
                  key={r.id}
                  to={`/contratos/${r.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted dark:hover:bg-white/5"
                >
                  <span className="text-slate-600 dark:text-slate-300">{formatDate(r.data_fim)}</span>
                  <span className="text-xs text-slate-400">{t.dashboard.inDays(r.dias_restantes)}</span>
                </Link>
              ))}
              {(renewals ?? []).length === 0 && <p className="text-sm text-slate-400">{t.dashboard.noRenewalsSoon}</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.dashboard.cpRenewalsTitle} subtitle={t.dashboard.cpRenewalsSubtitle} />
          <CardBody className="max-h-48 space-y-1 overflow-y-auto">
            {pontosConsumoRenovacoes.map(({ p, dias }) => (
              <Link
                key={p.id}
                to={`/pontos-consumo/${p.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted dark:hover:bg-white/5"
              >
                <span className="font-numeric text-slate-600 dark:text-slate-300">{p.cpe}</span>
                <DiasRenovacaoBadge dias={dias} />
              </Link>
            ))}
            {pontosConsumoRenovacoes.length === 0 && <p className="text-sm text-slate-400">{t.dashboard.noRenewalsSoon}</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t.dashboard.recentSimulationsTitle} />
        <CardBody className="p-0">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {recentes.map((sim) => (
                <tr key={sim.id}>
                  <td className="px-5 py-3">{formatDate(sim.created_at)}</td>
                  <td className="px-5 py-3">{sim.segmento}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/simulacoes/${sim.id}`} className="text-xs font-medium text-accent hover:underline">
                      {t.dashboard.view}
                    </Link>
                  </td>
                </tr>
              ))}
              {recentes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-slate-400">
                    {t.dashboard.noSimulationsYet}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}
