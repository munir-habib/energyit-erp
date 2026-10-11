import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Commission } from '@/types/database'

export function useCommissions() {
  return useQuery({
    queryKey: ['commissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('commissions').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as Commission[]
    },
  })
}

export function useCommissionForContract(contractId: string | undefined) {
  return useQuery({
    queryKey: ['commissions', 'contract', contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase.from('commissions').select('*').eq('contract_id', contractId).maybeSingle()
      if (error) throw error
      return data as Commission | null
    },
  })
}

export type CommissionInsert = Omit<Commission, 'id' | 'owner_id' | 'created_at' | 'updated_at'>

export function useCreateCommission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: CommissionInsert) => {
      const { error } = await supabase.from('commissions').insert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  })
}

export function useSetCommissionPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'PAGO' | 'NAO_PAGO' }) => {
      const { error } = await supabase
        .from('commissions')
        .update({ estado, data_pagamento: estado === 'PAGO' ? new Date().toISOString().slice(0, 10) : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  })
}
