import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface RevenueByMonth {
  owner_id: string
  mes: string
  total: number
}

export interface FunnelCount {
  owner_id: string
  etapa: 'SIMULACAO' | 'PROPOSTA_ENVIADA' | 'CONTRATO_ASSINADO'
  total: number
}

export interface RenewalUpcoming {
  id: string
  owner_id: string
  client_id: string
  data_fim: string
  dias_restantes: number
}

export interface CommissionBySupplier {
  owner_id: string
  fornecedor: string
  total: number
}

export interface CommissionStatus {
  owner_id: string
  estado: 'PAGO' | 'NAO_PAGO'
  total: number
  n: number
}

function useView<T>(view: string, orderBy?: string) {
  return useQuery({
    queryKey: [view],
    queryFn: async () => {
      let q = supabase.from(view).select('*')
      if (orderBy) q = q.order(orderBy)
      const { data, error } = await q
      if (error) throw error
      return data as T[]
    },
  })
}

export function useRevenueByMonth() {
  return useView<RevenueByMonth>('v_revenue_by_month', 'mes')
}

export function useFunnelCounts() {
  return useView<FunnelCount>('v_funnel_counts')
}

export function useRenewalsUpcoming() {
  return useView<RenewalUpcoming>('v_renewals_upcoming', 'data_fim')
}

export function useCommissionsBySupplier() {
  return useView<CommissionBySupplier>('v_commissions_by_supplier')
}

export function useCommissionsStatus() {
  return useView<CommissionStatus>('v_commissions_status')
}

export function useSavingsTotal() {
  return useQuery({
    queryKey: ['v_savings_total'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_savings_total').select('*').maybeSingle()
      if (error) throw error
      return (data as { owner_id: string; total: number } | null)?.total ?? 0
    },
  })
}

/** KPIs de catálogo/operacionais para o admin — nunca dados de negócio agregados de outros consultores. */
export function useAdminCatalogKpis() {
  return useQuery({
    queryKey: ['admin_catalog_kpis'],
    queryFn: async () => {
      const [{ count: produtosAtivos }, { data: indices }, { count: contas }] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('market_indices').select('data_atualizacao'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])
      const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000
      const indicesDesatualizados = (indices ?? []).filter((i) => new Date(i.data_atualizacao).getTime() < seteDiasAtras).length
      return {
        produtosAtivos: produtosAtivos ?? 0,
        indicesDesatualizados,
        contas: contas ?? 0,
      }
    },
  })
}
