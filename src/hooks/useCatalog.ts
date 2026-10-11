import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { computeGoGrid, type PricingCatalog } from '@/lib/pricingEngine'

/** Tabelas do catálogo — qualquer alteração aqui invalida a cache do TanStack Query em todas as sessões abertas, sem refresh manual. */
const CATALOG_TABLES = [
  'products',
  'pricing_formulas',
  'product_energy_prices',
  'product_price_variants',
  'tar_energia_btn',
  'tar_potencia_btn',
  'tar_energia_bte_mt',
  'tar_potencia_bte_mt',
  'potencia_contratada_valores',
  'market_indices',
  'suppliers',
  'commission_rules',
]

async function fetchCatalog(): Promise<PricingCatalog> {
  const [
    products,
    energyPrices,
    formulas,
    variants,
    tarEnergiaBtn,
    tarPotenciaBtn,
    tarEnergiaBteMt,
    tarPotenciaBteMt,
    potenciaValores,
    marketIndices,
  ] = await Promise.all([
    supabase.from('products').select('*').then((r) => r.data ?? []),
    supabase.from('product_energy_prices').select('*').then((r) => r.data ?? []),
    supabase.from('pricing_formulas').select('*').then((r) => r.data ?? []),
    supabase.from('product_price_variants').select('*').then((r) => r.data ?? []),
    supabase.from('tar_energia_btn').select('*').then((r) => r.data ?? []),
    supabase.from('tar_potencia_btn').select('*').then((r) => r.data ?? []),
    supabase.from('tar_energia_bte_mt').select('*').then((r) => r.data ?? []),
    supabase.from('tar_potencia_bte_mt').select('*').then((r) => r.data ?? []),
    supabase.from('potencia_contratada_valores').select('*').then((r) => r.data ?? []),
    supabase.from('market_indices').select('*').then((r) => r.data ?? []),
  ])

  return {
    products,
    energyPrices,
    formulas,
    variants,
    tarEnergiaBtn,
    tarPotenciaBtn,
    tarEnergiaBteMt,
    tarPotenciaBteMt,
    potenciaValores,
    marketIndices,
    goGrid: computeGoGrid(products, formulas, marketIndices),
  } as PricingCatalog
}

export function useCatalog() {
  return useQuery({ queryKey: ['catalog'], queryFn: fetchCatalog, staleTime: 60_000 })
}

/**
 * Mantém o catálogo (e as tabelas admin que o editam) sincronizados em tempo
 * real: um admin grava a grelha de pricing e qualquer sessão aberta —
 * incluindo simulações a meio — recalcula sem refresh manual. Monta-se uma
 * vez para toda a app autenticada (ver AppShell).
 */
export function useCatalogRealtime() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase.channel('catalog-realtime')
    for (const table of CATALOG_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        qc.invalidateQueries({ queryKey: ['catalog'] })
        qc.invalidateQueries({ queryKey: [table] })
      })
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

export function usePotenciaTabelas() {
  return useQuery({
    queryKey: ['potencia_contratada_tabelas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('potencia_contratada_tabelas').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useProduct(id: string | null | undefined) {
  return useQuery({
    queryKey: ['products', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

export function useCommissionRules() {
  return useQuery({
    queryKey: ['commission_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('commission_rules').select('*').order('valido_desde', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
