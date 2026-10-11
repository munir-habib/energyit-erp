import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Invoice } from '@/types/database'

export function useInvoices(clientId?: string) {
  return useQuery({
    queryKey: ['invoices', clientId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('invoices').select('*').order('data_fatura', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return data as Invoice[]
    },
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (error) throw error
      return data as Invoice
    },
  })
}

export type InvoiceInput = Omit<Invoice, 'id' | 'owner_id' | 'created_at' | 'updated_at'>

export function useSaveInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: InvoiceInput }) => {
      if (id) {
        const { error } = await supabase.from('invoices').update(values).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('invoices').insert(values).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}
