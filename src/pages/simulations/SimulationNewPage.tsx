import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { useClients, useSaveClient } from '@/hooks/useClients'
import { useCatalog, useCommissionRules, useSuppliers } from '@/hooks/useCatalog'
import { useCreateSimulation, useSimulation, useSimulationByPontoConsumo, useUpdateSimulation } from '@/hooks/useSimulations'
import { useCreatePontoConsumoRapido, usePontosConsumo } from '@/hooks/usePontosConsumo'
import { useToast } from '@/context/ToastContext'
import { useGerarDocumentosSimulacao } from '@/hooks/useGerarDocumentosSimulacao'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Select, FormRow, Input, Label } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { PeriodoInputs } from '@/components/PeriodoInputs'
import { FieldMessage } from '@/components/ui/Field'
import { useFieldFeedback } from '@/hooks/useFieldFeedback'
import { validarConsumoForaDoNormal, validarConsumoPeriodo, validarCPE, validarDiasFaturados, validarNome, validarPotencia } from '@/lib/validators'
import { RecommendationBanner } from '@/components/RecommendationBanner'
import { InvoiceUploadCard } from '@/components/InvoiceUploadCard'
import { Badge } from '@/components/ui/Badge'
import { useUploadDocument } from '@/hooks/useDocuments'
import { planoDePreenchimento, type CampoFatura, type PlanoPreenchimento } from '@/lib/invoiceToForm'
import type { ResultadoExtracao } from '@/lib/invoiceExtraction'
import type { ValidationResult } from '@/lib/validators'
import {
  calcularCustoAtualPeriodo,
  consumoAnualTotal,
  indiceDesatualizado,
  linhasPorVariante,
  ordenarPorPoupanca,
  periodosDoEsquema,
  precificarProduto,
  estimarComissao,
  sugerirMelhorProduto,
  variantePadrao,
  variantesComparaveis,
  type ComissaoEstimada,
  type ModoPrecoAtual,
  type ProductPricingResult,
  type SimulationInput,
} from '@/lib/pricingEngine'
import { chaveLinha } from '@/lib/simulationLines'
import { aplicarGoPorLinha, dadosDaSimulacao, estadoFormularioDaSimulacao, linhasParaGravar, marcacoesDasLinhas } from '@/lib/simulationForm'
import { formatEur } from '@/lib/format'
import type { ConsumoPeriodos, EsquemaHorario, PrecoPeriodos, ProductPriceVariant, Segmento, Simulation } from '@/types/database'
import { fromPricingResults, ResultsTable, type Marcacoes } from '@/pages/simulations/ResultsTable'

/** Texto humano de uma variante — guardado tal como mostrado ao consultor (ver SimulationResultLine.variant_label). */
function labelDaVariante(v: ProductPriceVariant): string {
  return v.data_inicio ? `${v.grupo_label} → ${v.fim_label}` : `${v.duracao_meses} meses`
}

const SEGMENTOS: Segmento[] = ['BTN', 'BTE', 'MT']

/**
 * "/simulacoes/nova" é a mesma rota quer se esteja a criar ou a editar (só muda a query "?editar="),
 * por isso o router não desmonta o formulário ao navegar entre "editar=A" e "editar=B", ou entre
 * editar e criar — o `key` força um remount nesses casos, para nunca deixar dados hidratados de uma
 * simulação a "vazar" para outra ou para uma criação nova.
 */
export function SimulationNewPage() {
  const [params] = useSearchParams()
  return <SimulationNewForm key={params.get('editar') ?? 'nova'} />
}

function SimulationNewForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: clients } = useClients()
  const saveClient = useSaveClient()
  const { data: catalog, isLoading: catalogLoading } = useCatalog()
  const { data: suppliers } = useSuppliers()
  const { data: commissionRules } = useCommissionRules()
  const createSimulation = useCreateSimulation()
  const updateSimulation = useUpdateSimulation()

  // ---- Modo edição — ?editar=<id> reabre uma simulação (ex: duplicada por "Duplicar simulação") com
  // os valores originais no formulário, em vez de criar uma nova. Gravar atualiza essa mesma linha,
  // sem tocar em ativa/estado (fica sempre RASCUNHO/inativa até ser marcada como ativa no histórico).
  const editarId = params.get('editar')
  const { data: simulacaoParaEditar } = useSimulation(editarId ?? undefined)
  // Guarda o id já hidratado (não um simples boolean) — navegar de "editar=A" direto para "editar=B"
  // não desmonta a página (mesma rota, só muda a query), por isso um boolean nunca voltaria a hidratar.
  const [hidratadoParaId, setHidratadoParaId] = useState<string | null>(null)

  const comercializadoraNome = useMemo(() => {
    const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.nome]))
    const productSupplierId = new Map((catalog?.products ?? []).map((p) => [p.id, p.supplier_id]))
    return (productId: string) => {
      const supplierId = productSupplierId.get(productId)
      return supplierId ? (supplierById.get(supplierId) ?? 'Fornecedor removido') : 'Sem fornecedor'
    }
  }, [suppliers, catalog?.products])

  // ---- 3.2 Segmento — primeiro passo, filtra tudo o resto -------------------------------------
  const [segmentoEscolhido, setSegmento] = useState<Segmento | null>(null)

  // ---- 3.3 Cliente ------------------------------------------------------------------------------
  const [clientId, setClientId] = useState(params.get('cliente') ?? '')
  const [pontoConsumoId, setPontoConsumoId] = useState(params.get('cpe') ?? '')
  const { data: pontosConsumo } = usePontosConsumo()
  const criarCpeRapido = useCreatePontoConsumoRapido()
  const toast = useToast()
  const pontosDoCliente = useMemo(
    () => (clientId ? (pontosConsumo ?? []).filter((p) => p.client_id === clientId) : []),
    [pontosConsumo, clientId],
  )
  const clienteSelecionado = useMemo(() => (clients ?? []).find((c) => c.id === clientId) ?? null, [clients, clientId])
  const { gerarDocumentoCliente } = useGerarDocumentosSimulacao()
  const [gerandoProposta, setGerandoProposta] = useState(false)

  // Com um cliente já conhecido (ex: ?cliente= a partir da ficha/CPE), o segmento parte do segmento
  // principal desse cliente — o formulário aparece logo, sem clique extra (derivado, sem efeito). O
  // seletor continua visível: uma escolha explícita (ou a hidratação do modo edição) prevalece sempre.
  const segmento: Segmento | null = segmentoEscolhido ?? (editarId ? null : (clienteSelecionado?.segmento_principal ?? null))

  // Cliente com exatamente 1 CPE → pré-selecionada, sem passo extra (derivado, sem efeito).
  const pontoConsumoIdEfetivo =
    pontoConsumoId || (pontosDoCliente.length === 1 ? (pontosDoCliente[0]?.id ?? '') : '')

  // Simulação já existente para a CPE escolhida — 1 simulação por CPE, gravar substitui.
  const { data: simExistenteDaCpe } = useSimulationByPontoConsumo(pontoConsumoIdEfetivo || null)

  const [criandoCpe, setCriandoCpe] = useState(false)
  const [novaCpeCodigo, setNovaCpeCodigo] = useState('')
  const [novaCpeMorada, setNovaCpeMorada] = useState('')

  async function handleCriarCpe() {
    if (!novaCpeCodigo.trim() || !clienteSelecionado) return
    const novo = await criarCpeRapido.mutateAsync({
      clientId: clienteSelecionado.id,
      clienteNome: clienteSelecionado.nome,
      clienteNif: clienteSelecionado.nif ?? null,
      cpe: novaCpeCodigo.trim(),
      morada: novaCpeMorada.trim() || null,
    })
    setPontoConsumoId(novo.id)
    setCriandoCpe(false)
    setNovaCpeCodigo('')
    setNovaCpeMorada('')
    toast.success(`CPE ${novo.cpe} criada e associada a ${clienteSelecionado.nome}`)
  }

  const [criandoCliente, setCriandoCliente] = useState(false)
  const [nomeNovoCliente, setNomeNovoCliente] = useState('')
  const consultores = useMemo(
    () => [...new Set((clients ?? []).map((c) => c.consultor_responsavel).filter((v): v is string => !!v))].sort(),
    [clients],
  )
  const [consultorNovoCliente, setConsultorNovoCliente] = useState('')

  async function handleCriarCliente() {
    if (!nomeNovoCliente.trim() || !segmento) return
    const id = await saveClient.mutateAsync({
      values: {
        nome: nomeNovoCliente.trim(),
        nif: null,
        morada: null,
        contacto: null,
        cui: null,
        grupo_id: null,
        segmento_principal: segmento,
        consultor_responsavel: consultorNovoCliente || null,
      },
    })
    setClientId(id)
    setCriandoCliente(false)
    setNomeNovoCliente('')
  }

  // ---- 3.4 Consumo do período faturado -----------------------------------------------------------
  const [esquemaBtn, setEsquemaBtn] = useState<EsquemaHorario>('TRI_HORARIO')
  const esquema = segmento === 'BTN' ? esquemaBtn : 'TETRA_HORARIO'
  const [diasFaturados, setDiasFaturados] = useState(30)
  const fb = useFieldFeedback() // feedback visual de validação em tempo real (só visual — não altera o cálculo)
  const [potencia, setPotencia] = useState(6.9)
  const [potenciaPersonalizada, setPotenciaPersonalizada] = useState(false)
  const [horasPonta, setHorasPonta] = useState<number | null>(null)
  const [consumoPeriodo, setConsumoPeriodo] = useState<ConsumoPeriodos>({})

  const potenciaOpcoes = useMemo(
    () => [...(catalog?.tarPotenciaBtn ?? [])].sort((a, b) => a.potencia_kva - b.potencia_kva),
    [catalog?.tarPotenciaBtn],
  )

  // ---- 3.5 Preço atual do cliente -----------------------------------------------------------------
  const [modoPrecoAtual, setModoPrecoAtual] = useState<ModoPrecoAtual>('PERIODOS')
  const [precoAtualPeriodos, setPrecoAtualPeriodos] = useState<PrecoPeriodos>({})
  const [valorTotalPeriodo, setValorTotalPeriodo] = useState<number>(0)
  const [incluiTarAtual, setIncluiTarAtual] = useState(true)

  // ---- GO, candidata, escolhida — agora por LINHA (Produto+Variante), nunca a nível da simulação
  // inteira: cada linha tem o seu próprio GO, independente de todas as outras (ver
  // docs/redesign-linhas-comparacao.md). Chave de cada mapa/set é chaveLinha(productId, variantId).
  const [goPorLinha, setGoPorLinha] = useState<Record<string, number>>({})
  const [goFixadoPorLinha, setGoFixadoPorLinha] = useState<Record<string, boolean>>({})
  const [candidatas, setCandidatas] = useState<Set<string>>(new Set())
  const [escolhidaKey, setEscolhidaKey] = useState<string | null>(null)
  // Produtos com "Ver mais prazos/períodos" aberto — mostram todas as variantes comparáveis como
  // linhas extra na tabela, em vez de só a variante por omissão.
  const [produtosExpandidos, setProdutosExpandidos] = useState<Set<string>>(new Set())

  // ---- 3.8 Filtro de produtos (opcional) --------------------------------------------------------
  const [produtosExcluidos, setProdutosExcluidos] = useState<Set<string>>(new Set())

  // Toggle "Preço médio com TAR" da tabela de resultados — gravado com a simulação (com_tar) para os
  // documentos apresentarem os preços tal como o consultor os viu (ver ResultsTable).
  const [tarOn, setTarOn] = useState(true)

  // ---- Leitura automática da fatura (InvoiceUploadCard) -------------------------------------------
  // Os campos preenchidos a partir da fatura ficam marcados (verde = confiança alta, âmbar = média)
  // até o consultor os rever — editar o campo ou marcá-lo como revisto. Enquanto houver campos por
  // rever, os resultados não são calculados: só "Confirmar dados e calcular" os liberta, e a partir
  // daí os campos passam a "confirmados pelo consultor" (sem marcação automática). O preenchimento
  // manual continua exatamente como antes para quem ignorar o quadro.
  const uploadDocument = useUploadDocument()
  const [fatura, setFatura] = useState<{ resultado: ResultadoExtracao; ficheiro: File; plano: PlanoPreenchimento } | null>(null)
  const [revistos, setRevistos] = useState<Set<CampoFatura>>(new Set())
  const [faturaConfirmada, setFaturaConfirmada] = useState(true)
  const camposFatura = fatura?.plano.campos ?? []
  const faturaPorRever = camposFatura.length > 0 && !faturaConfirmada
  const pendentesFatura = faturaPorRever ? camposFatura.filter((c) => !revistos.has(c.campo)) : []

  function marcarRevisto(campo: CampoFatura) {
    setRevistos((prev) => (prev.has(campo) ? prev : new Set(prev).add(campo)))
  }

  /** Estado visual de um campo lido da fatura e ainda por rever — undefined = feedback normal do campo. */
  function statusFatura(campo: CampoFatura): ValidationResult | undefined {
    if (!faturaPorRever || revistos.has(campo)) return undefined
    const c = camposFatura.find((x) => x.campo === campo)
    if (!c) return undefined
    return c.confianca === 'ALTA'
      ? { status: 'valid', message: 'Lido da fatura' }
      : { status: 'warning', message: 'Lido da fatura — confirme com atenção' }
  }

  const varianteLabelPorId = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of catalog?.variants ?? []) map.set(v.id, labelDaVariante(v))
    return map
  }, [catalog?.variants])

  // Hidrata o formulário a partir da simulação a editar, uma única vez quando os dados chegam. As
  // marcações por linha (GO/fixação/candidata/escolhida) vêm de normalizarResultados — que já
  // reconstrói os valores certos mesmo para simulações antigas (1 GO/1 escolha a nível da simulação
  // inteira, ver simulationLines.ts). Produtos com uma linha de variante não-omissão gravada ficam
  // logo expandidos, para a linha guardada continuar visível (nunca "desaparece" ao reabrir).
  useEffect(() => {
    // Espera também pelo catálogo — é preciso para saber que variantes são as por omissão (só os
    // produtos com uma linha gravada noutra variante ficam expandidos, ver estadoFormularioDaSimulacao).
    if (!editarId || !simulacaoParaEditar || !catalog || hidratadoParaId === editarId) return
    const e = estadoFormularioDaSimulacao(simulacaoParaEditar, (productId) => variantePadrao(catalog.variants, productId))
    setSegmento(e.segmento)
    setClientId(e.clientId)
    setPontoConsumoId(e.pontoConsumoId)
    if (e.esquemaBtn) setEsquemaBtn(e.esquemaBtn)
    setDiasFaturados(e.diasFaturados)
    setPotencia(e.potencia)
    setPotenciaPersonalizada(true)
    setHorasPonta(e.horasPonta)
    setConsumoPeriodo(e.consumoPeriodo)
    setModoPrecoAtual(e.modoPrecoAtual)
    setPrecoAtualPeriodos(e.precoAtualPeriodos)
    setValorTotalPeriodo(e.valorTotalPeriodo)
    setIncluiTarAtual(e.incluiTarAtual)
    setTarOn(e.tarOn)
    setGoPorLinha(e.goPorLinha)
    setGoFixadoPorLinha(e.goFixadoPorLinha)
    setCandidatas(e.candidatas)
    setEscolhidaKey(e.escolhidaKey)
    setProdutosExpandidos(e.produtosExpandidos)
    setProdutosExcluidos(e.produtosExcluidos)
    setHidratadoParaId(editarId)
  }, [editarId, simulacaoParaEditar, catalog, hidratadoParaId])

  const indicesDesatualizados = useMemo(
    () => (catalog?.marketIndices ?? []).filter((i) => indiceDesatualizado(i)),
    [catalog],
  )

  const consumoTotal = useMemo(
    () => (Object.values(consumoPeriodo) as number[]).reduce((s, v) => s + (v ?? 0), 0),
    [consumoPeriodo],
  )

  // Custo_Atual tal como o consultor o escreveu — SEM ajuste de TAR, nunca muda com a checkbox. É o
  // valor do indicador de verificação (3.6): serve só para confirmar que não houve erro de digitação
  // contra o papel da fatura, por isso tem de ser literalmente Σ (consumo × preço inserido).
  const custoAtualBruto = useMemo(
    () => calcularCustoAtualPeriodo({ modo: modoPrecoAtual, consumoPeriodo, precoAtualPeriodos, valorTotalPeriodo }),
    [modoPrecoAtual, consumoPeriodo, precoAtualPeriodos, valorTotalPeriodo],
  )

  // Custo_Atual ajustado — usado só para a comparação/poupança (compararProdutos), nunca no indicador
  // de verificação. Modo A: quando o preço atual inserido ainda não inclui TAR, soma a TAR oficial do
  // período (mesma tabela dos produtos) antes de multiplicar pelo consumo — ver calcularCustoAtualPeriodo.
  const custoAtualAjustado = useMemo(
    () =>
      calcularCustoAtualPeriodo({
        modo: modoPrecoAtual,
        consumoPeriodo,
        precoAtualPeriodos,
        valorTotalPeriodo,
        ajusteTarAtual: segmento
          ? {
              incluiTarAtual,
              segmento,
              esquemaHorario: esquema,
              potenciaContratadaKva: potencia,
              tarEnergiaBtn: catalog?.tarEnergiaBtn ?? [],
              tarEnergiaBteMt: catalog?.tarEnergiaBteMt ?? [],
            }
          : undefined,
      }),
    [modoPrecoAtual, consumoPeriodo, precoAtualPeriodos, valorTotalPeriodo, incluiTarAtual, segmento, esquema, potencia, catalog],
  )

  const temPrecoAtual =
    modoPrecoAtual === 'TOTAL' ? valorTotalPeriodo > 0 : Object.values(precoAtualPeriodos).some((v) => (v ?? 0) > 0)
  const podeCalcular = !!catalog && !!segmento && potencia > 0 && consumoTotal > 0
  const periodos = useMemo(() => periodosDoEsquema(esquema), [esquema])

  const produtosDoSegmento = useMemo(
    () => (catalog?.products ?? []).filter((p) => p.ativo && p.segmento === segmento),
    [catalog?.products, segmento],
  )

  // Produtos com mais do que 1 variante comparável (prazo/período) — mostram "Ver mais prazos/períodos".
  const produtosComMaisVariantes = useMemo(() => {
    const set = new Set<string>()
    if (!catalog) return set
    for (const p of produtosDoSegmento) if (variantesComparaveis(catalog.variants, p.id).length > 1) set.add(p.id)
    return set
  }, [catalog, produtosDoSegmento])

  const inputBase: SimulationInput | null = useMemo(() => {
    if (!segmento) return null
    return {
      segmento,
      esquemaHorario: esquema,
      potenciaContratadaKva: potencia,
      diasFaturados,
      consumoPeriodo,
      comTar: true,
      horasPontaDiarias: horasPonta,
      custoAtualPeriodo: custoAtualAjustado,
    }
  }, [segmento, esquema, potencia, diasFaturados, consumoPeriodo, horasPonta, custoAtualAjustado])

  // Uma linha por produto (variante por omissão) — ou várias, para os produtos com "Ver mais" aberto.
  // O GO ainda não entra aqui: cada linha nasce com o GO por omissão do produto (ver linhasComGo).
  const linhasBase = useMemo(() => {
    if (!podeCalcular || !catalog || !inputBase) return null
    const linhas: ProductPricingResult[] = []
    for (const p of produtosDoSegmento) {
      if (produtosExcluidos.has(p.id)) continue
      if (produtosExpandidos.has(p.id)) linhas.push(...linhasPorVariante(p, catalog, inputBase))
      else {
        const r = precificarProduto(p, catalog, inputBase)
        if (r) linhas.push(r)
      }
    }
    return linhas
  }, [podeCalcular, catalog, inputBase, produtosDoSegmento, produtosExcluidos, produtosExpandidos])

  // Aplica o GO ajustado manualmente por linha (goPorLinha), recalculando só as linhas com um GO
  // próprio — cada linha é 100% independente das outras, nunca há um GO "global" a afetar todas.
  const linhasComGo = useMemo(
    () => (linhasBase && catalog && inputBase ? aplicarGoPorLinha(linhasBase, catalog, inputBase, goPorLinha) : null),
    [linhasBase, catalog, inputBase, goPorLinha],
  )

  const resultados = useMemo(() => (linhasComGo ? ordenarPorPoupanca(linhasComGo) : null), [linhasComGo])

  // GO de cada linha: o ajustado manualmente, ou o GO por omissão do produto (grelha/valor estático,
  // definido pelo Admin) enquanto a linha ainda não foi ajustada — null em Fechados.
  const marcacoesPorLinha = useMemo(
    () =>
      resultados && catalog
        ? marcacoesDasLinhas(resultados, catalog, { goPorLinha, goFixadoPorLinha, candidatas, escolhidaKey })
        : new Map<string, Marcacoes>(),
    [resultados, catalog, goPorLinha, goFixadoPorLinha, candidatas, escolhidaKey],
  )

  // A comissão é sempre sobre o consumo ANUAL (mesma base que ContractDetailPage) — nunca sobre os kWh
  // do período faturado tal como estão na fatura.
  const consumoAnual = useMemo(() => consumoAnualTotal(consumoPeriodo, diasFaturados), [consumoPeriodo, diasFaturados])

  const comissoesPorLinha = useMemo(() => {
    const map = new Map<string, ComissaoEstimada>()
    if (!resultados) return map
    const dataFecho = new Date().toISOString().slice(0, 10)
    for (const r of resultados) {
      const key = chaveLinha(r.product.id, r.variantId)
      const goResolvido = r.product.tipo === 'FECHADO' ? undefined : (marcacoesPorLinha.get(key)?.goOverride ?? undefined)
      map.set(key, estimarComissao(r.product, commissionRules ?? [], consumoAnual, dataFecho, goResolvido ?? undefined))
    }
    return map
  }, [resultados, commissionRules, consumoAnual, marcacoesPorLinha])

  const linhasNormalizadas = useMemo(
    () =>
      resultados
        ? fromPricingResults(
            resultados,
            comercializadoraNome,
            (lineKey) => comissoesPorLinha.get(lineKey) ?? null,
            (variantId) => varianteLabelPorId.get(variantId) ?? null,
            (lineKey) => marcacoesPorLinha.get(lineKey),
          )
        : [],
    [resultados, comercializadoraNome, comissoesPorLinha, varianteLabelPorId, marcacoesPorLinha],
  )

  function toggleVerMaisVariantes(productId: string) {
    setProdutosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }
  function changeGoLinha(lineKey: string, value: number) {
    setGoPorLinha((prev) => ({ ...prev, [lineKey]: value }))
  }
  function fixarGoLinha(lineKey: string) {
    setGoFixadoPorLinha((prev) => ({ ...prev, [lineKey]: true }))
  }
  function toggleCandidataLinha(lineKey: string) {
    setCandidatas((prev) => {
      const next = new Set(prev)
      if (next.has(lineKey)) next.delete(lineKey)
      else next.add(lineKey)
      return next
    })
  }
  function toggleEscolhidaLinha(lineKey: string) {
    setEscolhidaKey((prev) => (prev === lineKey ? null : lineKey))
  }

  /**
   * Aplica ao formulário o que foi lido da fatura (ver invoiceToForm.ts). O segmento é passado
   * explicitamente e fixado — nunca muda sozinho por causa da fatura (só pelo botão "Mudar para…").
   */
  function aplicarFatura(resultado: ResultadoExtracao, ficheiro: File, seg: Segmento) {
    const plano = planoDePreenchimento(resultado, {
      segmento: seg,
      emEdicao: !!editarId,
      clientIdAtual: clientId,
      cpeAtual: (pontosConsumo ?? []).find((p) => p.id === pontoConsumoIdEfetivo)?.cpe ?? null,
      pontosConsumo: pontosConsumo ?? [],
    })
    setSegmento(seg)
    if (plano.esquemaBtn) setEsquemaBtn(plano.esquemaBtn)
    if (plano.potencia !== undefined) {
      setPotencia(plano.potencia)
      // Potência fora da lista de escalões → modo "Personalizado", sem arredondar.
      if (seg === 'BTN' && !potenciaOpcoes.some((o) => o.potencia_kva === plano.potencia)) setPotenciaPersonalizada(true)
    }
    if (plano.dias !== undefined) setDiasFaturados(plano.dias)
    if (plano.consumoPeriodo) setConsumoPeriodo(plano.consumoPeriodo)
    if (plano.precoAtualPeriodos) {
      setModoPrecoAtual('PERIODOS')
      setPrecoAtualPeriodos(plano.precoAtualPeriodos)
    }
    if (plano.incluiTarAtual !== undefined) setIncluiTarAtual(plano.incluiTarAtual)
    if (plano.cpe.acao === 'SELECIONAR') {
      if (plano.cpe.clientId) setClientId(plano.cpe.clientId)
      setPontoConsumoId(plano.cpe.pontoConsumoId)
      setCriandoCpe(false)
    } else if (plano.cpe.acao === 'CRIAR') {
      setCriandoCpe(true)
      setNovaCpeCodigo(plano.cpe.codigo)
    }
    setFatura({ resultado, ficheiro, plano })
    setRevistos(new Set())
    setFaturaConfirmada(plano.campos.length === 0)
  }

  async function handleGuardar(opcoes?: { gerarProposta?: boolean }) {
    if (!resultados || !segmento || faturaPorRever) return
    if (clientId && !pontoConsumoIdEfetivo) return // CPE obrigatória quando há cliente

    // O aviso de substituição só faz sentido a criar uma simulação nova — a editar um rascunho (ex:
    // duplicado) não se está a tornar ativa nenhuma, só a atualizar os dados desse mesmo rascunho.
    if (!editarId && pontoConsumoIdEfetivo && simExistenteDaCpe) {
      const l = simExistenteDaCpe.resultados.find(
        (x) => x.product_id === (simExistenteDaCpe.produto_escolhido_id ?? simExistenteDaCpe.produto_sugerido_id),
      )
      const resumo = l ? `${l.produto_nome}, poupança ${l.poupanca_pct.toFixed(1)}%` : 'sem produto definido'
      if (
        !confirm(
          `Esta CPE já tem uma simulação ativa (${resumo}). Continuar torna esta a nova simulação ativa — a anterior fica guardada no histórico.`,
        )
      )
        return
    }

    const linhas = linhasParaGravar(resultados, marcacoesPorLinha, (variantId) => varianteLabelPorId.get(variantId) ?? null)
    const sugestao = sugerirMelhorProduto(resultados)
    // A escolhida (✓) é estado explícito por linha (escolhidaKey) — produto_escolhido_id (cache só de
    // leitura, usado por ContractNewPage/SimulationsListPage) deriva diretamente da linha marcada.
    const dados = dadosDaSimulacao(
      {
        segmento,
        clientId,
        pontoConsumoId,
        esquemaBtn,
        diasFaturados,
        potencia,
        horasPonta,
        consumoPeriodo,
        modoPrecoAtual,
        precoAtualPeriodos,
        valorTotalPeriodo,
        incluiTarAtual,
        // Estado real do toggle "Preço médio com TAR" no momento de gravar — não hardcoded.
        tarOn,
        goPorLinha,
        goFixadoPorLinha,
        candidatas,
        escolhidaKey,
        produtosExpandidos,
        produtosExcluidos,
      },
      esquema,
      pontoConsumoIdEfetivo,
      linhas,
      sugestao?.product.id ?? null,
    )

    let idGravado: string
    if (editarId) {
      // Só atualiza os dados do rascunho — nunca ativa/estado, ver comentário acima.
      await updateSimulation.mutateAsync({ id: editarId, values: dados })
      idGravado = editarId
    } else {
      idGravado = await createSimulation.mutateAsync(dados)
    }

    // Ficheiro da fatura lida → guardado junto da simulação (documentos, entity_type 'simulation'),
    // como referência para mais tarde (ex: Poupança Real). Uma falha aqui não desfaz a simulação.
    if (fatura) {
      try {
        await uploadDocument.mutateAsync({ entityType: 'simulation', entityId: idGravado, file: fatura.ficheiro })
      } catch (e) {
        console.error(e)
        toast.error('Simulação gravada, mas não foi possível guardar o ficheiro da fatura.')
      }
    }

    // "Guardar e gerar proposta" — gera logo o Documento do Cliente com os dados acabados de gravar
    // (mesmo gerador do ecrã de resultado). Falhas no PDF aparecem em toast; a simulação fica gravada
    // na mesma e o consultor segue para o resultado.
    if (opcoes?.gerarProposta && clienteSelecionado) {
      setGerandoProposta(true)
      const agora = new Date().toISOString()
      const simulacaoGravada: Simulation = {
        ...dados,
        id: idGravado,
        owner_id: simulacaoParaEditar?.owner_id ?? '',
        estado: editarId ? (simulacaoParaEditar?.estado ?? 'RASCUNHO') : 'RASCUNHO',
        enviada_em: editarId ? (simulacaoParaEditar?.enviada_em ?? null) : null,
        ativa: editarId ? (simulacaoParaEditar?.ativa ?? false) : true,
        created_at: simulacaoParaEditar?.created_at ?? agora,
        updated_at: agora,
      }
      try {
        await gerarDocumentoCliente({
          client: clienteSelecionado,
          simulation: simulacaoGravada,
          pontoConsumo: (pontosConsumo ?? []).find((p) => p.id === pontoConsumoIdEfetivo) ?? null,
          comercializadoraNome,
          tarTables: { tarEnergiaBtn: catalog?.tarEnergiaBtn ?? [], tarEnergiaBteMt: catalog?.tarEnergiaBteMt ?? [] },
        })
      } finally {
        setGerandoProposta(false)
      }
    }
    navigate(`/simulacoes/${idGravado}`)
  }

  // "Guardar e gerar proposta" só faz sentido com tudo o que o Documento do Cliente exige.
  const faltaParaProposta: string[] = []
  if (!clientId) faltaParaProposta.push('associar cliente')
  if (clientId && !pontoConsumoIdEfetivo) faltaParaProposta.push('escolher CPE')
  if (!linhasNormalizadas.some((r) => r.escolhida)) faltaParaProposta.push('marcar uma linha como escolhida')
  const aGuardar = createSimulation.isPending || updateSimulation.isPending || gerandoProposta

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        {editarId ? 'Editar simulação' : 'Nova simulação'}
      </h1>

      {indicesDesatualizados.length > 0 && (
        <Alert tone="warning" title="Índice de mercado desatualizado">
          {indicesDesatualizados.map((i) => i.nome).join(', ')} não {indicesDesatualizados.length > 1 ? 'são atualizados' : 'é atualizado'} há mais de 7 dias — os produtos indexados podem estar a usar um valor antigo.
        </Alert>
      )}

      {/* 3.2 — Segmento: primeiro passo, três opções sempre exclusivas */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200/70 bg-surface-card p-1.5 dark:border-white/10 dark:bg-surface-dark-card">
        {SEGMENTOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSegmento(s)}
            className={clsx(
              'rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
              segmento === s
                ? 'bg-accent text-white'
                : 'text-slate-500 hover:bg-surface-muted dark:text-slate-400 dark:hover:bg-white/5',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {segmento && (
        <>
          {/* 3.3 — Cliente: fixo e só de leitura a editar uma simulação já existente — mudar de CPE
              continua a exigir duplicar, nunca uma reatribuição direta do campo. */}
          {editarId ? (
            <Card>
              <CardBody>
                <p className="text-xs text-slate-400">Cliente e CPE — fixos ao editar (duplique para mudar de CPE)</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {clienteSelecionado?.nome ?? 'Sem cliente associado'}
                  {pontoConsumoIdEfetivo && (
                    <> &nbsp;·&nbsp; CPE {pontosDoCliente.find((p) => p.id === pontoConsumoIdEfetivo)?.cpe ?? '—'}</>
                  )}
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormRow label="Cliente (opcional — pode associar depois)">
                  <Select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value)
                      setPontoConsumoId('')
                    }}
                  >
                    <option value="">Sem cliente associado</option>
                    {(clients ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                {clientId && (
                  <div className="sm:col-span-2">
                    <Label>Ponto de Consumo / CPE (obrigatório com cliente)</Label>
                    {criandoCpe ? (
                      <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3 dark:bg-accent/10">
                        <Input
                          placeholder="Código da CPE (ex: PT0002…)"
                          value={novaCpeCodigo}
                          onChange={(e) => {
                            setNovaCpeCodigo(e.target.value)
                            marcarRevisto('cpe')
                          }}
                          {...fb('novaCpe', novaCpeCodigo, validarCPE(novaCpeCodigo))}
                          {...statusFatura('cpe')}
                        />
                        <Input
                          placeholder="Morada (opcional)"
                          value={novaCpeMorada}
                          onChange={(e) => setNovaCpeMorada(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!novaCpeCodigo.trim() || criarCpeRapido.isPending}
                            onClick={() => void handleCriarCpe()}
                          >
                            {criarCpeRapido.isPending ? 'A criar…' : 'Criar CPE'}
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setCriandoCpe(false)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {pontosDoCliente.length > 0 && (
                          <Select
                            value={pontoConsumoIdEfetivo}
                            onChange={(e) => {
                              setPontoConsumoId(e.target.value)
                              marcarRevisto('cpe')
                            }}
                            className="max-w-md"
                            {...statusFatura('cpe')}
                          >
                            {pontosDoCliente.length !== 1 && <option value="">Escolher CPE…</option>}
                            {pontosDoCliente.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.cpe}
                                {p.morada ? ` — ${p.morada}` : ''}
                              </option>
                            ))}
                          </Select>
                        )}
                        {pontosDoCliente.length === 0 && (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            Este cliente ainda não tem CPEs.
                          </span>
                        )}
                        <Button type="button" size="sm" variant="secondary" onClick={() => setCriandoCpe(true)}>
                          + Nova CPE
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <Label>Ou criar novo cliente</Label>
                  {criandoCliente ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Nome do cliente"
                        value={nomeNovoCliente}
                        onChange={(e) => setNomeNovoCliente(e.target.value)}
                        {...fb('nomeNovoCliente', nomeNovoCliente, validarNome(nomeNovoCliente))}
                      />
                      {consultores.length > 1 && (
                        <Select value={consultorNovoCliente} onChange={(e) => setConsultorNovoCliente(e.target.value)}>
                          <option value="">Consultor responsável (opcional)</option>
                          {consultores.map((nome) => (
                            <option key={nome} value={nome}>
                              {nome}
                            </option>
                          ))}
                        </Select>
                      )}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={!nomeNovoCliente.trim() || saveClient.isPending} onClick={() => void handleCriarCliente()}>
                          {saveClient.isPending ? 'A criar…' : 'Criar'}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setCriandoCliente(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" onClick={() => setCriandoCliente(true)}>
                      + Novo cliente
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Leitura automática da fatura — opcional: quem preferir continua a preencher tudo à mão. */}
          <InvoiceUploadCard
            onExtraido={(r, f) => aplicarFatura(r, f, segmento)}
            camposPreenchidos={camposFatura.length}
            dadosConfirmados={!!fatura && camposFatura.length > 0 && faturaConfirmada}
          />
          {fatura && (fatura.plano.notas.length > 0 || fatura.plano.segmentoDiferente) && (
            <Alert tone="warning" title="Sobre a fatura lida">
              <ul className="list-disc space-y-1 pl-4">
                {fatura.plano.segmentoDiferente && (
                  <li>
                    A fatura parece ser {fatura.plano.segmentoDiferente}, mas o segmento escolhido é {segmento}.{' '}
                    <button
                      type="button"
                      className="font-medium text-accent hover:underline"
                      onClick={() => aplicarFatura(fatura.resultado, fatura.ficheiro, fatura.plano.segmentoDiferente!)}
                    >
                      Mudar para {fatura.plano.segmentoDiferente}
                    </button>
                  </li>
                )}
                {fatura.plano.notas.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* 3.4 — Consumo do período faturado */}
          <Card>
            <CardHeader title="Consumo do período faturado" subtitle="Dados do período da fatura — nunca anualizados" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-4">
                {segmento === 'BTN' && (
                  <FormRow label="Esquema horário">
                    <Select
                      value={esquemaBtn}
                      onChange={(e) => {
                        setEsquemaBtn(e.target.value as EsquemaHorario)
                        marcarRevisto('esquema')
                      }}
                      {...statusFatura('esquema')}
                    >
                      <option value="SIMPLES">Simples</option>
                      <option value="BI_HORARIO">Bi-Horário</option>
                      <option value="TRI_HORARIO">Tri-Horário</option>
                    </Select>
                  </FormRow>
                )}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Potência contratada (kVA)</span>
                    {segmento === 'BTN' && (
                      <div className="flex overflow-hidden rounded-md border border-slate-300 text-[11px] dark:border-white/15">
                        <button
                          type="button"
                          onClick={() => setPotenciaPersonalizada(false)}
                          className={clsx('px-2 py-0.5', !potenciaPersonalizada ? 'bg-accent text-white' : 'text-slate-500 dark:text-slate-400')}
                        >
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setPotenciaPersonalizada(true)}
                          className={clsx('px-2 py-0.5', potenciaPersonalizada ? 'bg-accent text-white' : 'text-slate-500 dark:text-slate-400')}
                        >
                          Personalizado
                        </button>
                      </div>
                    )}
                  </div>
                  {segmento !== 'BTN' || potenciaPersonalizada ? (
                    <Input
                      type="number"
                      step="0.01"
                      numeric
                      value={potencia}
                      onChange={(e) => {
                        setPotencia(Number(e.target.value))
                        marcarRevisto('potencia')
                      }}
                      {...fb('potencia', potencia, validarPotencia(potencia, segmento))}
                      {...statusFatura('potencia')}
                    />
                  ) : (
                    <Select
                      value={potencia}
                      onChange={(e) => {
                        setPotencia(Number(e.target.value))
                        marcarRevisto('potencia')
                      }}
                      {...statusFatura('potencia')}
                    >
                      {potenciaOpcoes.map((p) => (
                        <option key={p.id} value={p.potencia_kva}>
                          {p.potencia_kva} kVA
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                <FormRow label="Dias faturados">
                  <Input
                    type="number"
                    step="1"
                    numeric
                    value={diasFaturados}
                    onChange={(e) => {
                      setDiasFaturados(Number(e.target.value) || 1)
                      marcarRevisto('dias')
                    }}
                    {...fb('dias', diasFaturados, validarDiasFaturados(diasFaturados))}
                    {...statusFatura('dias')}
                  />
                </FormRow>
                {/* "Horas Ponta/dia" deixou de ser pedido ao consultor — devia usar sempre um valor
                    automático conforme o ciclo (Diário/Semanal), mas essa regra ainda não está
                    definida no sistema. Até estar, fica sempre null → o motor trata como 0 (ver
                    pricingEngine.ts), o que zera o encargo de Potência em Horas de Ponta (só se
                    aplica a BTE/MT, coef_php). Só ajustável, no futuro, numa configuração avançada do
                    Admin — nunca aqui. */}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Consumo do período (kWh)</p>
                <PeriodoInputs
                  esquema={esquema}
                  values={consumoPeriodo}
                  onChange={(p, v) => {
                    setConsumoPeriodo((c) => ({ ...c, [p]: v }))
                    marcarRevisto(`consumo:${p}`)
                  }}
                  unit="kWh"
                  validate={validarConsumoPeriodo}
                  statusPeriodo={(p) => statusFatura(`consumo:${p}`)}
                />
                <FieldMessage {...validarConsumoForaDoNormal({ consumoTotalKwh: consumoTotal, diasFaturados, segmento, potenciaKva: potencia })} />
              </div>
            </CardBody>
          </Card>

          {/* 3.5 — Preço atual do cliente */}
          <Card>
            <CardHeader title="Preço atual pago pelo cliente" subtitle="Para calcular a poupança face ao que paga hoje" />
            <CardBody className="space-y-4">
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs dark:border-white/15">
                <button
                  type="button"
                  onClick={() => setModoPrecoAtual('PERIODOS')}
                  className={clsx('px-3 py-1.5 font-medium', modoPrecoAtual === 'PERIODOS' ? 'bg-accent text-white' : 'text-slate-500 dark:text-slate-400')}
                >
                  €/kWh por período
                </button>
                <button
                  type="button"
                  onClick={() => setModoPrecoAtual('TOTAL')}
                  className={clsx('px-3 py-1.5 font-medium', modoPrecoAtual === 'TOTAL' ? 'bg-accent text-white' : 'text-slate-500 dark:text-slate-400')}
                >
                  Valor total da fatura
                </button>
              </div>

              {modoPrecoAtual === 'PERIODOS' ? (
                <PeriodoInputs
                  esquema={esquema}
                  values={precoAtualPeriodos}
                  onChange={(p, v) => {
                    setPrecoAtualPeriodos((c) => ({ ...c, [p]: v }))
                    marcarRevisto(`preco:${p}`)
                  }}
                  unit="€/kWh"
                  step="0.0001"
                  statusPeriodo={(p) => statusFatura(`preco:${p}`)}
                />
              ) : (
                <FormRow label="Valor total (€) da fatura no período">
                  <Input type="number" step="0.01" numeric value={valorTotalPeriodo || ''} onChange={(e) => setValorTotalPeriodo(Number(e.target.value))} />
                </FormRow>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={incluiTarAtual}
                  onChange={(e) => {
                    setIncluiTarAtual(e.target.checked)
                    marcarRevisto('tar')
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Este valor já inclui TAR
                {statusFatura('tar') && (
                  <Badge tone={statusFatura('tar')!.status === 'valid' ? 'savings' : 'pending'}>{statusFatura('tar')!.message}</Badge>
                )}
              </label>

              {/* 3.6 — Indicador de verificação: sempre o valor tal como escrito, nunca ajustado por
                  TAR — serve só para o consultor confirmar contra o papel da fatura, não para a poupança. */}
              {consumoTotal > 0 && temPrecoAtual && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 dark:bg-accent/10">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Custo total calculado do período — confirme contra a fatura em papel
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatEur(custoAtualBruto)}</p>
                  {modoPrecoAtual === 'PERIODOS' && !incluiTarAtual && Math.abs(custoAtualAjustado - custoAtualBruto) > 0.005 && (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Custo ajustado para comparação (com TAR estimada): {formatEur(custoAtualAjustado)}
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* 3.8 — Filtro de produtos, opcional */}
          <details className="rounded-card border border-slate-200/70 bg-surface-muted/40 px-5 py-3 text-sm dark:border-white/5 dark:bg-surface-dark-muted/30">
            <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
              Escolher comercializadoras/produtos ({produtosDoSegmento.length - produtosExcluidos.size} de {produtosDoSegmento.length} selecionados)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {produtosDoSegmento.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={!produtosExcluidos.has(p.id)}
                    onChange={(e) =>
                      setProdutosExcluidos((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.delete(p.id)
                        else next.add(p.id)
                        return next
                      })
                    }
                  />
                  {comercializadoraNome(p.id)} — {p.nome}
                </label>
              ))}
            </div>
          </details>

          {!podeCalcular && (
            <p className="text-sm text-slate-400">
              {catalogLoading ? 'A carregar catálogo…' : 'Insira o consumo de pelo menos um período para ver os resultados.'}
            </p>
          )}

          {faturaPorRever && (
            <Card>
              <CardHeader
                title="Rever dados lidos da fatura"
                subtitle="Nenhum valor lido da fatura entra no cálculo sem a sua confirmação — edite o campo acima ou marque-o como revisto"
              />
              <CardBody className="space-y-3">
                <ul className="divide-y divide-slate-200/70 dark:divide-white/5">
                  {camposFatura.map((c) => (
                    <li key={c.campo} className="flex items-center gap-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={`${c.rotulo} revisto`}
                        checked={revistos.has(c.campo)}
                        onChange={(e) =>
                          setRevistos((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(c.campo)
                            else next.delete(c.campo)
                            return next
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      <span className="w-40 shrink-0 text-slate-500 dark:text-slate-400">{c.rotulo}</span>
                      <span className="min-w-0 flex-1 truncate font-numeric text-slate-800 dark:text-slate-100">{c.valorTexto}</span>
                      {revistos.has(c.campo) ? (
                        <Badge tone="neutral">Revisto</Badge>
                      ) : c.confianca === 'ALTA' ? (
                        <Badge tone="savings">Confiança alta</Badge>
                      ) : (
                        <Badge tone="pending">Confirmar</Badge>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {pendentesFatura.length > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Falta rever {pendentesFatura.length} {pendentesFatura.length === 1 ? 'campo' : 'campos'}
                    </span>
                  )}
                  <Button onClick={() => setFaturaConfirmada(true)} disabled={pendentesFatura.length > 0}>
                    Confirmar dados e calcular
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {resultados && !faturaPorRever && (
            <Card>
              <CardHeader
                title="Resultado da comparação"
                subtitle="A decisão final é sempre do consultor — a sugestão é apenas um ponto de partida"
              />
              <CardBody className="space-y-4">
                <RecommendationBanner rows={linhasNormalizadas} onMarcarEscolhida={toggleEscolhidaLinha} />
                <ResultsTable
                  resultados={linhasNormalizadas}
                  comercializadoraNome={comercializadoraNome}
                  periodos={periodos}
                  linhaAtual={{ precoMedio: consumoTotal > 0 ? custoAtualAjustado / consumoTotal : null, custoAtualIndefinido: custoAtualAjustado <= 0 }}
                  tarOn={tarOn}
                  onChangeTarOn={setTarOn}
                  onToggleCandidata={toggleCandidataLinha}
                  onToggleEscolhida={toggleEscolhidaLinha}
                  onChangeGoLinha={changeGoLinha}
                  onFixarGoLinha={fixarGoLinha}
                  produtosComMaisVariantes={produtosComMaisVariantes}
                  produtosExpandidos={produtosExpandidos}
                  onToggleVerMaisVariantes={toggleVerMaisVariantes}
                />
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {clientId && !pontoConsumoIdEfetivo && (
                    <span className="text-xs text-danger">Escolha ou crie uma CPE para este cliente antes de guardar.</span>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => void handleGuardar()}
                    disabled={aGuardar || (!!clientId && !pontoConsumoIdEfetivo)}
                  >
                    {createSimulation.isPending && !gerandoProposta ? 'A guardar…' : 'Guardar simulação'}
                  </Button>
                  <Button
                    onClick={() => void handleGuardar({ gerarProposta: true })}
                    disabled={aGuardar || faltaParaProposta.length > 0}
                    title={faltaParaProposta.length > 0 ? `Falta: ${faltaParaProposta.join(' · ')}` : undefined}
                  >
                    {gerandoProposta ? 'A gerar proposta…' : 'Guardar e gerar proposta'}
                  </Button>
                </div>
                {faltaParaProposta.length > 0 && (
                  <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                    Guardar e gerar proposta — falta: {faltaParaProposta.join(' · ')}
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
