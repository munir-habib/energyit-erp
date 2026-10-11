import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { AlertEntityType, AlertRecord } from '@/types/database'

export type AlertInsert = Omit<AlertRecord, 'id' | 'owner_id' | 'created_at' | 'lido_em'>

export function useAlertsForEntity(entityType: AlertEntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['alerts', entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as AlertRecord[]
    },
  })
}

/** Alertas por acionar do utilizador atual (RLS já restringe a owner_id = auth.uid()). */
export function useDueAlerts() {
  return useQuery({
    queryKey: ['alerts', 'due'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .is('lido_em', null)
        .lte('data_alvo', today)
        .order('data_alvo')
      if (error) throw error
      return data as AlertRecord[]
    },
    refetchInterval: 5 * 60_000,
  })
}

export function useCreateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: AlertInsert) => {
      const { error } = await supabase.from('alerts').insert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

export function useDismissAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alerts').update({ lido_em: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
