import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Simulation } from '@/types/database'

export function useSimulations(clientId?: string) {
  return useQuery({
    queryKey: ['simulations', clientId ?? 'all'],
    queryFn: async () => {
      let query = supabase.from('simulations').select('*').order('created_at', { ascending: false })
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return data as Simulation[]
    },
  })
}

export function useSimulation(id: string | undefined) {
  return useQuery({
    queryKey: ['simulations', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('simulations').select('*').eq('id', id).single()
      if (error) throw error
      return data as Simulation
    },
  })
}

/** A simulação ativa de uma CPE, se existir — usada para avisar antes de a tornar a nova ativa. Uma CPE pode ter várias simulações (histórico), mas o índice único parcial garante no máximo 1 ativa. */
export function useSimulationByPontoConsumo(pontoConsumoId: string | null | undefined) {
  return useQuery({
    queryKey: ['simulations', 'by-cpe-ativa', pontoConsumoId],
    enabled: !!pontoConsumoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulations')
        .select('*')
        .eq('ponto_consumo_id', pontoConsumoId as string)
        .eq('ativa', true)
        .maybeSingle()
      if (error) throw error
      return (data as Simulation | null) ?? null
    },
  })
}

export type SimulationInsert = Omit<Simulation, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'estado' | 'enviada_em' | 'ativa'> &
  Partial<Pick<Simulation, 'estado' | 'enviada_em' | 'ativa'>>

/**
 * A coluna produtos_excluidos vem da migração 0022 — enquanto não estiver aplicada no projeto, o
 * PostgREST rejeita qualquer escrita que a inclua (PGRST204 / 42703). Nesse caso grava-se sem ela, para
 * o filtro de produtos nunca impedir gravar a simulação (só não fica persistido até a migração correr).
 */
function colunaProdutosExcluidosEmFalta(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === 'PGRST204' || error.code === '42703') && (error.message ?? '').includes('produtos_excluidos')
}

function semProdutosExcluidos<T extends { produtos_excluidos?: unknown }>(values: T): Omit<T, 'produtos_excluidos'> {
  const { produtos_excluidos: _ignorado, ...resto } = values
  return resto
}

/** Desativa (nunca apaga) a simulação ativa atual de uma CPE — passo comum a "gravar uma nova ativa" e "marcar outra como ativa", garante que nunca ficam 2 ativas ao mesmo tempo mesmo antes do índice único parcial intervir. */
async function desativarSimulacaoAtivaDaCpe(pontoConsumoId: string) {
  const { error } = await supabase.from('simulations').update({ ativa: false }).eq('ponto_consumo_id', pontoConsumoId).eq('ativa', true)
  if (error) throw error
}

export function useCreateSimulation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: SimulationInsert) => {
      // Só desativa a simulação ativa atual da CPE quando esta nova linha é que vai ficar ativa — ao
      // duplicar (ativa: false explícito), a original fica intocada e a cópia entra só no histórico.
      const tornandoAtiva = values.ativa !== false
      if (values.ponto_consumo_id && tornandoAtiva) {
        await desativarSimulacaoAtivaDaCpe(values.ponto_consumo_id)
      }
      let res = await supabase.from('simulations').insert(values).select('id').single()
      if (colunaProdutosExcluidosEmFalta(res.error)) {
        res = await supabase.from('simulations').insert(semProdutosExcluidos(values)).select('id').single()
      }
      if (res.error) throw res.error
      return res.data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['simulations'] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

export function useUpdateSimulation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<SimulationInsert> }) => {
      let { error } = await supabase.from('simulations').update(values).eq('id', id)
      if (colunaProdutosExcluidosEmFalta(error)) {
        ;({ error } = await supabase.from('simulations').update(semProdutosExcluidos(values)).eq('id', id))
      }
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }),
  })
}

/** Marca outra simulação da CPE como ativa — desativa a atual e ativa a escolhida (nunca ficam 2 ativas, ver desativarSimulacaoAtivaDaCpe). Usada no histórico de simulações da CPE (ficha do cliente). */
export function useMarcarSimulacaoAtiva() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pontoConsumoId }: { id: string; pontoConsumoId: string }) => {
      await desativarSimulacaoAtivaDaCpe(pontoConsumoId)
      const { error } = await supabase.from('simulations').update({ ativa: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }),
  })
}

export function useDeleteSimulation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Alertas de simulação não têm FK (entity_id polimórfico) — limpar à mão.
      await supabase.from('alerts').delete().eq('entity_type', 'SIMULATION').eq('entity_id', id)
      const { error } = await supabase.from('simulations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['simulations'] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
