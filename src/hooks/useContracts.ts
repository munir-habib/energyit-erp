import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Contract, RealSaving } from '@/types/database'

export function useContracts(clientId?: string) {
  return useQuery({
    queryKey: ['contracts', clientId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('contracts').select('*').order('data_inicio', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return data as Contract[]
    },
  })
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ['contracts', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', id).single()
      if (error) throw error
      return data as Contract
    },
  })
}

export type ContractInsert = Omit<Contract, 'id' | 'owner_id' | 'created_at' | 'updated_at'>

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: ContractInsert) => {
      const { data, error } = await supabase.from('contracts').insert(values).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useUpdateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ContractInsert> }) => {
      const { error } = await supabase.from('contracts').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

export function useRealSavings(contractId?: string) {
  return useQuery({
    queryKey: ['real_savings', contractId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('real_savings').select('*').order('created_at', { ascending: false })
      if (contractId) query = query.eq('contract_id', contractId)
      const { data, error } = await query
      if (error) throw error
      return data as RealSaving[]
    },
  })
}

export type RealSavingInsert = Omit<RealSaving, 'id' | 'owner_id' | 'created_at'>

export function useCreateRealSaving() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: RealSavingInsert) => {
      const { error } = await supabase.from('real_savings').insert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['real_savings'] }),
  })
}
