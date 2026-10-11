import { useUpdateSimulation } from '@/hooks/useSimulations'
import { useToast } from '@/context/ToastContext'
import { gerarDocumentoAprovacaoInterna, gerarPropostaPdf, type TarTables } from '@/lib/pdf'
import type { Client, PontoConsumo, Simulation } from '@/types/database'

interface GerarArgs {
  client: Client
  simulation: Simulation
  pontoConsumo: PontoConsumo | null
  comercializadoraNome: (productId: string) => string
}

/**
 * Geração dos documentos a partir de UMA simulação (ecrã de resultado e "Guardar e gerar proposta").
 * Erros são sempre mostrados em toast (nunca engolidos). Gerar com sucesso o Documento do Cliente
 * passa uma simulação ainda em RASCUNHO para ENVIADA — só depois do sucesso, nunca antes.
 */
export function useGerarDocumentosSimulacao() {
  const updateSimulation = useUpdateSimulation()
  const toast = useToast()

  /** Devolve true se o PDF foi gerado. */
  async function gerarDocumentoCliente({ tarTables, ...args }: GerarArgs & { tarTables: TarTables }): Promise<boolean> {
    const { client, simulation, pontoConsumo, comercializadoraNome } = args
    try {
      await gerarPropostaPdf({
        client,
        simulacoes: [{ simulation, pontoConsumo }],
        comercializadoraNome,
        consultor: { nome: client.consultor_responsavel, contacto: null },
        tarTables,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o documento para o cliente.')
      return false
    }

    if (simulation.estado !== 'RASCUNHO') {
      toast.success('Documento para o cliente gerado.')
      return true
    }
    try {
      await updateSimulation.mutateAsync({
        id: simulation.id,
        values: { estado: 'ENVIADA', enviada_em: new Date().toISOString() },
      })
      // O sistema de toasts ainda não suporta botões de ação (sem "Anular" no toast) — o ecrã de
      // resultado mostra "Voltar a rascunho" enquanto a simulação estiver ENVIADA.
      toast.success('Documento para o cliente gerado — simulação marcada como Enviada.')
    } catch {
      toast.error('Documento gerado, mas não foi possível marcar a simulação como Enviada.')
    }
    return true
  }

  async function gerarDocumentoInterno({ client, simulation, pontoConsumo, comercializadoraNome }: GerarArgs): Promise<boolean> {
    try {
      await gerarDocumentoAprovacaoInterna({ client, simulacoes: [{ simulation, pontoConsumo }], comercializadoraNome })
      toast.success('Documento interno gerado.')
      return true
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o documento interno.')
      return false
    }
  }

  return { gerarDocumentoCliente, gerarDocumentoInterno }
}
