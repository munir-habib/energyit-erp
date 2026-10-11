/**
 * Construtores de fixtures partilhados pelos testes Vitest — só preenchem os campos obrigatórios dos
 * tipos da BD com valores neutros. Os valores de negócio (preços, TAR, potência) ficam sempre em cada
 * teste, copiados das migrações de seed (0002, 0011, 0017), nunca inventados aqui.
 */
import type {
  CommissionRule,
  PotenciaContratadaValor,
  Product,
  ProductEnergyPrice,
  ProductPriceVariant,
  Simulation,
  SimulationResultLine,
} from '@/types/database'

export function product(
  p: Partial<Product> & { id: string; segmento: Product['segmento']; nome: string; tipo: Product['tipo'] },
): Product {
  return {
    supplier_id: null,
    duracao_meses: null,
    go_valor: null,
    preco_limite: null,
    margem: null,
    indice_id: null,
    prioridade_comissao: null,
    comissao_fixa: null,
    potencia_tabela_id: null,
    preco_estatico_com_tar: false,
    ativo: true,
    created_at: '',
    updated_at: '',
    ...p,
  }
}

export function price(
  product_id: string,
  variant_id: string | null,
  esquema_horario: ProductEnergyPrice['esquema_horario'],
  periodo: ProductEnergyPrice['periodo'],
  preco_base: number,
  abaixo_20_7kva: boolean | null = null,
): ProductEnergyPrice {
  return {
    id: `${product_id}-${variant_id}-${esquema_horario}-${periodo}-${abaixo_20_7kva}`,
    product_id,
    variant_id,
    esquema_horario,
    periodo,
    abaixo_20_7kva,
    preco_base,
    created_at: '',
    updated_at: '',
  }
}

export function variant(id: string, product_id: string, extra: Partial<ProductPriceVariant> = {}): ProductPriceVariant {
  return {
    id,
    product_id,
    duracao_meses: null,
    data_inicio: null,
    data_fim: null,
    grupo_label: null,
    fim_label: null,
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

export function potencia(tabela_id: string, potencia_kva: number, valor_dia: number): PotenciaContratadaValor {
  return { id: `${tabela_id}-${potencia_kva}`, tabela_id, potencia_kva, valor_dia }
}

export function regraComissao(r: Partial<CommissionRule> & Pick<CommissionRule, 'id' | 'multiplicador' | 'valido_desde'>): CommissionRule {
  return { nome: r.id, go_min: null, go_max: null, valido_ate: null, created_at: '', updated_at: '', ...r }
}

/** Linha de resultados gravada — valores numéricos neutros, só para testes de documentos/marcações. */
export function linha(l: Partial<SimulationResultLine> & Pick<SimulationResultLine, 'product_id' | 'produto_nome' | 'tipo'>): SimulationResultLine {
  return {
    variant_id: null,
    variant_label: null,
    precos_periodo: { SIMPLES: 0.15 },
    custo_energia_periodo: 100,
    poupanca_eur_periodo: 20,
    poupanca_eur_mes: 20,
    poupanca_eur_ano: 243.33,
    poupanca_pct: 16.7,
    alerta_go: false,
    prioridade_comissao: null,
    custo_atual_indefinido: false,
    ...l,
  }
}

export function simulacao(s: Partial<Simulation> & Pick<Simulation, 'id' | 'segmento' | 'resultados'>): Simulation {
  return {
    owner_id: 'owner',
    client_id: 'cliente-1',
    invoice_id: null,
    ponto_consumo_id: null,
    esquema_horario: s.segmento === 'BTN' ? 'SIMPLES' : 'TETRA_HORARIO',
    com_tar: true,
    horas_ponta_diarias: null,
    dias_faturados: 30,
    modo_preco_atual: 'PERIODOS',
    inclui_tar_atual: true,
    consumo_periodo: { SIMPLES: 1000 },
    produto_sugerido_id: null,
    produto_escolhido_id: null,
    estado: 'RASCUNHO',
    enviada_em: null,
    ativa: true,
    potencia_contratada_kva: 6.9,
    preco_atual_periodos: { SIMPLES: 0.2 },
    valor_total_periodo: null,
    go_override: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...s,
  }
}
