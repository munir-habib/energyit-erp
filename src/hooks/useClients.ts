import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Client } from '@/types/database'

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('nome')
      if (error) throw error
      return data as Client[]
    },
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
      if (error) throw error
      return data as Client
    },
  })
}

// `cpe` foi removido do formulário de cliente — a associação de CPEs faz-se sempre
// à parte (simulação a partir do cliente, associação manual na lista, ou importação).
export type ClientInput = Omit<Client, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'cpe'>

export function useSaveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ClientInput }) => {
      if (id) {
        const { error } = await supabase.from('clients').update(values).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('clients').insert(values).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
