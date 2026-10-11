// Hand-written types mirroring supabase/migrations/0001_schema.sql.
// Keep in sync with the SQL schema — there is no generated-types step in this project yet.

export type Role = 'admin' | 'consultant'
export type Segmento = 'BTN' | 'BTE' | 'MT' | 'GAS'
export type EsquemaHorario = 'SIMPLES' | 'BI_HORARIO' | 'TRI_HORARIO' | 'TETRA_HORARIO'
export type Periodo = 'SIMPLES' | 'FORA_VAZIO' | 'PONTA' | 'CHEIA' | 'VAZIO' | 'SUPER_VAZIO'
export type TipoProduto = 'ABERTO_FIXO' | 'ABERTO_INDEXADO' | 'FECHADO'
export type EstadoContrato = 'ATIVO' | 'TERMINADO' | 'CANCELADO'
export type EstadoComissao = 'PAGO' | 'NAO_PAGO'
/** BTE e MT já são segmentos próprios (ver Segmento) — este tipo só nomeia a categoria das tabelas TAR BTE/MT, que sempre existiram separadas. */
export type CategoriaBteMt = 'BTE' | 'MT'

export interface Profile {
  id: string
  email: string
  nome: string | null
  role: Role
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  nome: string
  contactos: string | null
  condicoes: string | null
  created_at: string
  updated_at: string
}

export interface PotenciaContratadaTabela {
  id: string
  nome: string
  segmento: 'BTN' | 'BTE' | 'MT'
  created_at: string
}

export interface PotenciaContratadaValor {
  id: string
  tabela_id: string
  potencia_kva: number
  valor_dia: number
}

export interface Product {
  id: string
  segmento: Segmento
  supplier_id: string | null
  nome: string
  tipo: TipoProduto
  duracao_meses: 12 | 18 | 24 | null
  go_valor: number | null
  preco_limite: number | null
  margem: number | null
  indice_id: string | null
  prioridade_comissao: number | null
  comissao_fixa: number | null
  potencia_tabela_id: string | null
  preco_estatico_com_tar: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export type TipoFormula = 'PRECO' | 'GO'

export interface PricingFormula {
  id: string
  product_id: string
  tipo: TipoFormula
  formula: string
  descricao: string | null
  created_at: string
  updated_at: string
}

/**
 * Variante de preço de um produto — cobre os dois casos do catálogo:
 *  - "Prazo" sem datas (Flex/BOOST/MAX 12|24 meses; GO SuperNova 12|18|24 meses): só duracao_meses.
 *  - "Período de validade" com datas (GO EZU): data_inicio agrupa variantes no mesmo "grupo de
 *    início" (ex: "Set/Out26"); cada uma tem a sua data_fim. grupo_label/fim_label guardam o texto
 *    exato já validado pelo utilizador — nunca derivados de data_inicio/data_fim.
 */
export interface ProductPriceVariant {
  id: string
  product_id: string
  duracao_meses: number | null
  data_inicio: string | null
  data_fim: string | null
  grupo_label: string | null
  fim_label: string | null
  created_at: string
  updated_at: string
}

export interface ProductEnergyPrice {
  id: string
  product_id: string
  /** null = produto sem variantes (ex: Z/ZC/Deluxe+). Não-null = preço específico dessa variante. */
  variant_id: string | null
  esquema_horario: EsquemaHorario
  periodo: Periodo
  /** Só relevante para BTN Tri-Horário de produtos com preço por escalão de potência (Flex/BOOST/MAX). null = sem distinção de escalão. */
  abaixo_20_7kva: boolean | null
  preco_base: number
  created_at: string
  updated_at: string
}

export interface TarEnergiaBtn {
  id: string
  esquema_horario: 'SIMPLES' | 'BI_HORARIO' | 'TRI_HORARIO'
  periodo: Periodo
  abaixo_20_7kva: boolean
  valor: number
  updated_at: string
}

export interface TarPotenciaBtn {
  id: string
  potencia_kva: number
  valor_dia: number
  updated_at: string
}

export interface TarEnergiaBteMt {
  id: string
  categoria: CategoriaBteMt
  periodo: 'PONTA' | 'CHEIA' | 'VAZIO' | 'SUPER_VAZIO'
  valor: number
  updated_at: string
}

export interface TarPotenciaBteMt {
  id: string
  categoria: CategoriaBteMt
  coef_php: number
  coef_pc: number
  updated_at: string
}

export interface MarketIndex {
  id: string
  nome: string
  valor: number
  unidade: string
  data_atualizacao: string
  updated_at: string
}

export interface CommissionRule {
  id: string
  nome: string
  go_min: number | null
  go_max: number | null
  multiplicador: number
  valido_desde: string
  valido_ate: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  owner_id: string
  nome: string
  nif: string | null
  morada: string | null
  contacto: string | null
  cpe: string | null
  cui: string | null
  segmento_principal: Segmento
  /** Etiqueta organizacional livre, gerida pela própria conta — não afeta permissões nem RLS. */
  consultor_responsavel: string | null
  /** Grupo a que esta Empresa pertence — null para a maioria (cliente individual). Um cliente pertence a, no máximo, 1 Grupo. Ver Grupo/migração 0024_grupos.sql. */
  grupo_id: string | null
  created_at: string
  updated_at: string
}

/** Agrupa várias Empresas (clients) para efeitos de documento consolidado — ver migração 0024_grupos.sql. */
export interface Grupo {
  id: string
  owner_id: string
  nome: string
  created_at: string
  updated_at: string
}

export type ConsumoPeriodos = Partial<Record<Periodo, number>>
export type PrecoPeriodos = Partial<Record<Periodo, number>>

export interface Invoice {
  id: string
  owner_id: string
  client_id: string
  segmento: Segmento
  esquema_horario: EsquemaHorario
  potencia_contratada_kva: number | null
  consumo_periodos: ConsumoPeriodos
  preco_periodos: PrecoPeriodos | null
  inclui_tar: boolean
  fornecedor_atual: string | null
  data_fatura: string | null
  horas_ponta_diarias: number | null
  dias_faturados: number
  created_at: string
  updated_at: string
}

export interface ComponentePeriodo {
  /** preço de energia sem TAR (base + GO quando aplicável) */
  semTar: number
  /** TAR de energia oficial/transversal para este período */
  tar: number
}

export interface PrecoMedioPonderado {
  semTar: number
  comTar: number
}

export interface SimulationResultLine {
  product_id: string
  produto_nome: string
  tipo: TipoProduto
  /** Variante (período/prazo) usada — null quando o produto não tem variantes. Nunca recalculado depois de guardado. */
  variant_id: string | null
  /** Texto humano da variante usada (ex: "Set/Out26 → Jun27", "24 meses") — guardado tal como mostrado ao consultor, para o histórico não depender de a variante ainda existir no catálogo. */
  variant_label: string | null
  precos_periodo: PrecoPeriodos
  /** Custo de energia do período (nunca inclui potência) — única base da poupança. */
  custo_energia_periodo: number
  poupanca_eur_periodo: number
  poupanca_eur_mes: number
  poupanca_eur_ano: number
  poupanca_pct: number
  alerta_go: boolean
  prioridade_comissao: number | null
  /** true quando o custo atual do cliente não foi inserido — poupanca_* não são comparáveis nesse caso. */
  custo_atual_indefinido: boolean
  /** Decomposição Sem TAR / TAR por período. */
  componentes_periodo?: Partial<Record<Periodo, ComponentePeriodo>>
  /** Encargo de Potência Contratada, em €/dia — só informativo, nunca entra na poupança. */
  potencia_eur_dia?: number
  /** Preço médio ponderado pelo consumo de cada período — null/ausente quando o esquema só tem 1 período. */
  preco_medio_ponderado?: PrecoMedioPonderado | null

  /** GO desta linha (€/MWh) — independente de todas as outras linhas da simulação. null em produtos Fechados (nunca têm GO). Ausente em simulações antigas — ver normalizarResultados em simulationLines.ts. */
  go_override?: number | null
  /** true = GO fixado nesta linha ("Fixar GO") — o consultor decidiu este valor como definitivo; o Documento Interno usa sempre go_override tal como está gravado, fixado ou não. Ausente em simulações antigas — trata-se como false. */
  go_fixado?: boolean
  /** Marcação "candidata" (⭐) — sem limite por simulação/CPE; entra no Documento Interno. Ausente em simulações antigas — ver normalizarResultados. */
  candidata?: boolean
  /** Marcação "escolhida" (✓) — no máximo 1 true por simulação/CPE (nunca 2, ver marcarEscolhida em simulationLines.ts); é a linha que vai para o Documento do Cliente. Ausente em simulações antigas — ver normalizarResultados (deriva de produto_escolhido_id). */
  escolhida?: boolean
}

export type EstadoSimulation = 'RASCUNHO' | 'ENVIADA' | 'CONVERTIDA' | 'PERDIDA'
export type ModoPrecoAtual = 'PERIODOS' | 'TOTAL'

export interface Simulation {
  id: string
  owner_id: string
  /** null quando a simulação começou "à solta" — obrigatório associar/criar um cliente antes de fechar contrato. */
  client_id: string | null
  invoice_id: string | null
  /** CPE (ponto de consumo) a que esta simulação diz respeito — opcional; usado para identificar a simulação no documento de aprovação interna. */
  ponto_consumo_id: string | null
  segmento: Segmento
  esquema_horario: EsquemaHorario
  /** Toggle de apresentação da tabela de resultados (Com/Sem TAR no preço médio do produto) — nunca recalcula a poupança. */
  com_tar: boolean
  horas_ponta_diarias: number | null
  /** Dias faturados do período em análise — nunca um ano completo. */
  dias_faturados: number
  /** Como o preço atual foi introduzido nesta simulação (Modo A/B do pedido) — guarda qual dos dois campos abaixo (preco_atual_periodos / valor_total_periodo) usar. */
  modo_preco_atual: ModoPrecoAtual
  /** Se o preço atual introduzido já incluía TAR — quando false, o Custo_Atual usado na poupança soma a TAR oficial do período (ver calcularCustoAtualPeriodo); o valor tal como inserido nunca muda com isto. */
  inclui_tar_atual: boolean
  /** kWh do período faturado — nunca anualizado. */
  consumo_periodo: ConsumoPeriodos
  resultados: SimulationResultLine[]
  produto_sugerido_id: string | null
  produto_escolhido_id: string | null
  estado: EstadoSimulation
  enviada_em: string | null
  /** true = esta é a simulação em uso para a CPE (ficha do cliente, documentos) — só 1 por CPE de cada vez (índice único parcial simulations_ponto_consumo_ativa_idx). false = histórico/rascunho (ex: criada por "Duplicar simulação"), nunca usada nos documentos até ser marcada como ativa. */
  ativa: boolean
  /** Potência contratada (kVA) tal como inserida no formulário — não afeta os resultados já guardados, só serve para reabrir a simulação em modo de edição (ver "Duplicar simulação"). */
  potencia_contratada_kva: number | null
  /** Preço atual por período (€/kWh), tal como inserido — só quando modo_preco_atual='PERIODOS'. Guardado em bruto (sem ajuste de TAR) para reabrir em modo de edição e para o detalhe por período do Documento do Cliente. */
  preco_atual_periodos: PrecoPeriodos | null
  /** Valor total da fatura (€) tal como inserido — só quando modo_preco_atual='TOTAL'. */
  valor_total_periodo: number | null
  /** GO de teste usado nesta simulação (€/MWh) — só reabertura em modo de edição e exibição no Documento Interno (ver "GO utilizado"); null em simulações anteriores a este campo. */
  go_override: number | null
  /**
   * Produtos excluídos da comparação no filtro 3.8 (ids) — para reabrir/duplicar com a mesma seleção.
   * Opcional: coluna criada pela migração 0022; ausente (undefined) enquanto não estiver aplicada, e
   * null em simulações anteriores a ela.
   */
  produtos_excluidos?: string[] | null
  created_at: string
  updated_at: string
}

export interface FrozenPricing {
  produto_nome: string
  precos_periodo: PrecoPeriodos
  custo_energia_periodo: number
  poupanca_eur_ano: number
  poupanca_pct: number
  consumo_periodo: ConsumoPeriodos
  dias_faturados: number
  // Linha exata (Produto + Variante) da simulação de onde estes preços vieram — ver contractLine.ts.
  // Opcionais: contratos criados antes deste campo não os têm (precos_congelados é jsonb, sem migração).
  tipo?: TipoProduto
  variant_id?: string | null
  variant_label?: string | null
  /** GO (€/MWh) fixado/negociado nessa linha — base da comissão. null em Fechados ou quando a linha não tinha GO. */
  go_override?: number | null
  go_fixado?: boolean
}

export interface Contract {
  id: string
  owner_id: string
  client_id: string
  simulation_id: string | null
  product_id: string | null
  precos_congelados: FrozenPricing
  potencia_contratada_kva: number | null
  data_inicio: string
  data_fim: string | null
  estado: EstadoContrato
  created_at: string
  updated_at: string
}

export interface RealSaving {
  id: string
  owner_id: string
  contract_id: string
  periodo_referencia: string | null
  consumo_real_periodos: ConsumoPeriodos
  custo_real_contrato: number
  custo_estimado_anterior: number
  poupanca_real_eur: number
  poupanca_real_pct: number
  created_at: string
}

export interface Commission {
  id: string
  owner_id: string
  contract_id: string
  consumo_anual_kwh: number | null
  go_aplicado: number | null
  multiplicador_aplicado: number | null
  regra_id: string | null
  valor: number
  estado: EstadoComissao
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

export type AlertEntityType = 'SIMULATION' | 'CONTRACT'
export type AlertTipo = 'DIAS_APOS_ENVIO' | 'DATA_ESPECIFICA' | 'DIAS_ANTES_RENOVACAO'

export interface AlertRecord {
  id: string
  owner_id: string
  entity_type: AlertEntityType
  entity_id: string
  tipo: AlertTipo
  dias: number | null
  data_alvo: string
  lido_em: string | null
  created_at: string
}

export type DocumentEntityType = 'client' | 'contract' | 'simulation'

export interface DocumentRecord {
  id: string
  owner_id: string
  entity_type: DocumentEntityType
  entity_id: string
  storage_path: string
  filename: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export type EstadoPontoConsumo = 'Ativo' | 'Desativo'

export interface PontoConsumo {
  id: string
  owner_id: string
  client_id: string | null
  cpe: string
  cliente: string
  nif: string | null
  morada: string | null
  estado: EstadoPontoConsumo
  potencia_contratada: number | null
  consumo_anual: number | null
  data_ativacao: string | null
  data_fim_contrato: string | null
  num_periodos: number
  created_at: string
  updated_at: string
}

export interface PeriodoContrato {
  id: string
  ponto_consumo_id: string
  owner_id: string
  data_inicio: string
  data_fim: string | null
  estado: EstadoPontoConsumo
  potencia_contratada: number | null
  consumo_anual: number | null
  criado_em: string
}

export interface PontoConsumoPrefs {
  owner_id: string
  colunas: string[] | null
  filtros: Record<string, unknown> | null
  ordenacao: { key: string; direction: 'asc' | 'desc' } | null
  updated_at: string
}

export interface AuditLogEntry {
  id: string
  owner_id?: string
  actor_id?: string | null
  tabela: string
  registo_id: string | null
  acao: string
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string
}
