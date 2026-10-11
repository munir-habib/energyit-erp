import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { PontoConsumoPrefs } from '@/types/database'

export function usePontosConsumoPrefs() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pontos_consumo_prefs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('pontos_consumo_prefs').select('*').maybeSingle()
      if (error) throw error
      return data as PontoConsumoPrefs | null
    },
  })
}

export function useSavePontosConsumoPrefs() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (values: Pick<PontoConsumoPrefs, 'colunas' | 'filtros' | 'ordenacao'>) => {
      if (!user?.id) return
      const { error } = await supabase.from('pontos_consumo_prefs').upsert({ owner_id: user.id, ...values })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pontos_consumo_prefs'] }),
  })
}
