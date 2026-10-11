import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/** Generic CRUD helpers for the global catalog tables — RLS enforces admin-only writes server-side. */
export function useCatalogTable<T extends { id: string }>(table: string, orderBy?: string) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: [table],
    queryFn: async () => {
      let q = supabase.from(table).select('*')
      if (orderBy) q = q.order(orderBy)
      const { data, error } = await q
      if (error) throw error
      return data as T[]
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<T> }) => {
      const { error } = await supabase.from(table).update(values as Record<string, unknown>).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })

  const insert = useMutation({
    mutationFn: async (values: Partial<T>) => {
      const { data, error } = await supabase.from(table).insert(values as Record<string, unknown>).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })

  return { ...query, update, insert, remove }
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: ['admin_audit_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}
