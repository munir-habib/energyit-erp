import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { PeriodoContrato, PontoConsumo } from '@/types/database'

export function usePontosConsumo() {
  return useQuery({
    queryKey: ['pontos_consumo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pontos_consumo').select('*').order('cpe')
      if (error) throw error
      return data as PontoConsumo[]
    },
  })
}

export function usePontoConsumo(id: string | undefined) {
  return useQuery({
    queryKey: ['pontos_consumo', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('pontos_consumo').select('*').eq('id', id).single()
      if (error) throw error
      return data as PontoConsumo
    },
  })
}

export function usePeriodosContrato(pontoConsumoId: string | undefined) {
  return useQuery({
    queryKey: ['periodos_contrato', pontoConsumoId],
    enabled: !!pontoConsumoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periodos_contrato')
        .select('*')
        .eq('ponto_consumo_id', pontoConsumoId as string)
        .order('data_fim', { ascending: false, nullsFirst: true })
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data as PeriodoContrato[]
    },
  })
}

export type PontoConsumoInsert = Omit<
  PontoConsumo,
  'id' | 'owner_id' | 'created_at' | 'updated_at' | 'num_periodos' | 'data_ativacao' | 'data_fim_contrato'
> & {
  data_inicio: string
  data_fim: string | null
}

export function useCreatePontoConsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: PontoConsumoInsert) => {
      const { data_inicio, data_fim, client_id, cpe, cliente, nif, morada, estado, potencia_contratada, consumo_anual } = values
      const { data: ponto, error: pontoError } = await supabase
        .from('pontos_consumo')
        .insert({ client_id, cpe, cliente, nif, morada, estado, potencia_contratada, consumo_anual })
        .select('id')
        .single()
      if (pontoError) throw pontoError

      const { error: periodoError } = await supabase.from('periodos_contrato').insert({
        ponto_consumo_id: ponto.id,
        data_inicio,
        data_fim,
        estado,
        potencia_contratada,
        consumo_anual,
      })
      if (periodoError) throw periodoError

      return ponto.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pontos_consumo'] }),
  })
}

/**
 * Associa manualmente um ou mais CPEs a um cliente. Reescreve também os campos de
 * texto `cliente`/`nif` do ponto de consumo para o nome/NIF do cliente de destino,
 * para a lista não ficar a mostrar o nome antigo importado.
 */
export function useAssociarPontosConsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      pontoIds,
      clientId,
      clienteNome,
      clienteNif,
    }: {
      pontoIds: string[]
      clientId: string
      clienteNome: string
      clienteNif: string | null
    }) => {
      const { error } = await supabase
        .from('pontos_consumo')
        .update({ client_id: clientId, cliente: clienteNome, nif: clienteNif })
        .in('id', pontoIds)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pontos_consumo'] })
      qc.invalidateQueries({ queryKey: ['simulations'] })
    },
  })
}

/**
 * Edição manual da data de renovação de uma CPE. Substitui sempre o valor atual
 * (importado ou manual) e a cache que alimenta os alertas, com efeito imediato
 * — ao invalidar a query `pontos_consumo`, os badges azul/âmbar/vermelho e o
 * dashboard recalculam já, sem esperar pelo recálculo diário.
 */
export function useDefinirDataRenovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pontoConsumoId, dataFim }: { pontoConsumoId: string; dataFim: string }) => {
      const { data, error } = await supabase.rpc('definir_data_renovacao', {
        p_ponto_consumo_id: pontoConsumoId,
        p_data_fim: dataFim,
      })
      if (error) throw error
      return data as PontoConsumo
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pontos_consumo'] })
      qc.invalidateQueries({ queryKey: ['periodos_contrato', variables.pontoConsumoId] })
    },
  })
}

/**
 * Criação rápida de CPE dentro do fluxo de simulação — só os campos mínimos
 * (código + morada), já associada ao cliente. Sem período de contrato: a data de
 * renovação e o resto preenchem-se depois na ficha da CPE.
 */
export function useCreatePontoConsumoRapido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      clientId,
      clienteNome,
      clienteNif,
      cpe,
      morada,
    }: {
      clientId: string
      clienteNome: string
      clienteNif: string | null
      cpe: string
      morada: string | null
    }) => {
      const { data, error } = await supabase
        .from('pontos_consumo')
        .insert({ client_id: clientId, cliente: clienteNome, nif: clienteNif, cpe, morada, estado: 'Ativo' })
        .select('*')
        .single()
      if (error) throw error
      return data as PontoConsumo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pontos_consumo'] }),
  })
}

export interface RenovarPeriodoInput {
  ponto_consumo_id: string
  nova_data_fim: string
  estado?: PontoConsumo['estado']
  potencia_contratada?: number | null
  consumo_anual?: number | null
}

export function useRenovarPeriodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RenovarPeriodoInput) => {
      const { data, error } = await supabase.rpc('renovar_ponto_consumo', {
        p_ponto_consumo_id: input.ponto_consumo_id,
        p_nova_data_fim: input.nova_data_fim,
        p_estado: input.estado ?? null,
        p_potencia_contratada: input.potencia_contratada ?? null,
        p_consumo_anual: input.consumo_anual ?? null,
      })
      if (error) throw error
      return data as PeriodoContrato
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['pontos_consumo'] })
      qc.invalidateQueries({ queryKey: ['periodos_contrato', variables.ponto_consumo_id] })
    },
  })
}
