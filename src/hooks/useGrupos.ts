import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Grupo } from '@/types/database'

export function useGrupos() {
  return useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grupos').select('*').order('nome')
      if (error) throw error
      return data as Grupo[]
    },
  })
}

export function useGrupo(id: string | undefined) {
  return useQuery({
    queryKey: ['grupos', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('grupos').select('*').eq('id', id).single()
      if (error) throw error
      return data as Grupo
    },
  })
}

export type GrupoInput = Pick<Grupo, 'nome'>

export function useSaveGrupo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: GrupoInput }) => {
      if (id) {
        const { error } = await supabase.from('grupos').update(values).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('grupos').insert(values).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos'] }),
  })
}

export function useDeleteGrupo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // A FK de clients.grupo_id é "on delete set null" — apagar um Grupo nunca apaga as Empresas
      // que lhe pertenciam, só as desassocia (ficam como clientes individuais outra vez).
      const { error } = await supabase.from('grupos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grupos'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
