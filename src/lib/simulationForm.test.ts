import { describe, expect, it } from 'vitest'
import { precificarProduto, type PricingCatalog, type SimulationInput } from './pricingEngine'
import {
  aplicarGoPorLinha,
  dadosDaSimulacao,
  estadoFormularioDaSimulacao,
  linhasParaGravar,
  marcacoesDasLinhas,
  produtosExcluidosParaGravar,
  type EstadoFormularioSimulacao,
} from './simulationForm'
import { alternarCandidata, chaveLinha, linhaEscolhidaDaSimulacao, marcarEscolhida, normalizarResultados } from './simulationLines'
import type { Simulation, TarEnergiaBteMt } from '../types/database'
import { linha, price, product, simulacao, variant } from '../test/fixtures'

// EZU BTE GO, grupo Set/Out26 — Jun27 e Jun28 (0017 §3): Ponta 0,1060 / 0,0916; go_valor 10.
// SuperNova BTE GO 18 meses (0017 §5): Ponta 0,0758; go_valor 10. TAR BTE Ponta 0,0397 (0002).
const EzuBteGo = product({ id: 'EzuBteGo', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', go_valor: 10 })
const SnBteGo = product({ id: 'SnBteGo', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', go_valor: 10 })
const vJun27 = variant('v-jun27', 'EzuBteGo', { grupo_label: 'Set/Out26', fim_label: 'Jun27', data_inicio: '2026-09-01', data_fim: '2027-06-30' })
const vJun28 = variant('v-jun28', 'EzuBteGo', { grupo_label: 'Set/Out26', fim_label: 'Jun28', data_inicio: '2026-09-01', data_fim: '2028-06-30' })
const vSn18 = variant('v-sn18', 'SnBteGo', { duracao_meses: 18 })

const tarBte: TarEnergiaBteMt[] = [
  { id: 'b1', categoria: 'BTE', periodo: 'PONTA', valor: 0.0397, updated_at: '' },
  { id: 'b2', categoria: 'BTE', periodo: 'CHEIA', valor: 0.0353, updated_at: '' },
  { id: 'b3', categoria: 'BTE', periodo: 'VAZIO', valor: 0.0285, updated_at: '' },
  { id: 'b4', categoria: 'BTE', periodo: 'SUPER_VAZIO', valor: 0.0237, updated_at: '' },
]

function tetra(productId: string, variantId: string | null, ponta: number) {
  return (['PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO'] as const).map((p) => price(productId, variantId, 'TETRA_HORARIO', p, p === 'PONTA' ? ponta : 0.1))
}

const catalog: PricingCatalog = {
  products: [EzuBteGo, SnBteGo],
  energyPrices: [...tetra('EzuBteGo', vJun27.id, 0.106), ...tetra('EzuBteGo', vJun28.id, 0.0916), ...tetra('SnBteGo', vSn18.id, 0.0758)],
  formulas: [],
  variants: [vJun27, vJun28, vSn18],
  tarEnergiaBtn: [],
  tarPotenciaBtn: [],
  tarEnergiaBteMt: tarBte,
  tarPotenciaBteMt: [],
  potenciaValores: [],
  marketIndices: [],
  goGrid: new Map(),
}

const inputBase: SimulationInput = {
  segmento: 'BTE',
  esquemaHorario: 'TETRA_HORARIO',
  potenciaContratadaKva: 60,
  diasFaturados: 31,
  consumoPeriodo: { PONTA: 2019, CHEIA: 5180, VAZIO: 2640, SUPER_VAZIO: 1355 },
  comTar: true,
  horasPontaDiarias: null,
  custoAtualPeriodo: 1500,
}

const kJun27 = chaveLinha('EzuBteGo', vJun27.id)
const kJun28 = chaveLinha('EzuBteGo', vJun28.id)
const kSn18 = chaveLinha('SnBteGo', vSn18.id)

/** Linhas base tal como o ecrã as monta com "Ver mais prazos/períodos" aberto na EZU (2 variantes) + SuperNova (1). */
function linhasBase() {
  return [
    precificarProduto(EzuBteGo, catalog, { ...inputBase, variantePorProduto: { EzuBteGo: vJun27.id } })!,
    precificarProduto(EzuBteGo, catalog, { ...inputBase, variantePorProduto: { EzuBteGo: vJun28.id } })!,
    precificarProduto(SnBteGo, catalog, { ...inputBase, variantePorProduto: { SnBteGo: vSn18.id } })!,
  ]
}

function porChave<T extends { product: { id: string }; variantId: string | null }>(rs: T[]) {
  return new Map(rs.map((r) => [chaveLinha(r.product.id, r.variantId), r]))
}

describe('GO por linha — cada linha de comparação é independente', () => {
  it('mudar o GO de uma linha só recalcula essa linha (nem a outra variante do mesmo produto)', () => {
    const antes = porChave(linhasBase())
    const depois = porChave(aplicarGoPorLinha(linhasBase(), catalog, inputBase, { [kJun27]: 20 }))
    expect(depois.get(kJun27)!.precosPeriodo.PONTA).toBeCloseTo(0.106 + 0.02 + 0.0397, 6)
    expect(depois.get(kJun28)!.precosPeriodo).toEqual(antes.get(kJun28)!.precosPeriodo)
    expect(depois.get(kJun28)!.precosPeriodo.PONTA).toBeCloseTo(0.0916 + 0.01 + 0.0397, 6)
    expect(depois.get(kSn18)!.precosPeriodo).toEqual(antes.get(kSn18)!.precosPeriodo)
  })

  it('duas linhas com GOs diferentes ao mesmo tempo mantêm cada uma o seu GO e a sua variante', () => {
    const r = porChave(aplicarGoPorLinha(linhasBase(), catalog, inputBase, { [kJun27]: 20, [kJun28]: 5 }))
    expect(r.get(kJun27)!.variantId).toBe(vJun27.id)
    expect(r.get(kJun28)!.variantId).toBe(vJun28.id)
    expect(r.get(kJun28)!.precosPeriodo.PONTA).toBeCloseTo(0.0916 + 0.005 + 0.0397, 6)
  })

  it('fixar o GO de uma linha não fixa nenhuma outra; linhas sem ajuste mostram o GO por omissão do produto', () => {
    const resultados = aplicarGoPorLinha(linhasBase(), catalog, inputBase, { [kJun27]: 20 })
    const m = marcacoesDasLinhas(resultados, catalog, { goPorLinha: { [kJun27]: 20 }, goFixadoPorLinha: { [kJun27]: true }, candidatas: new Set(), escolhidaKey: null })
    expect(m.get(kJun27)).toMatchObject({ goOverride: 20, goFixado: true })
    expect(m.get(kJun28)).toMatchObject({ goOverride: 10, goFixado: false })
    expect(m.get(kSn18)).toMatchObject({ goOverride: 10, goFixado: false })
  })

  it('Fechados nunca têm GO, mesmo que haja um valor na chave dessa linha', () => {
    const Fechado = product({ id: 'Z', segmento: 'BTE', nome: 'Z', tipo: 'FECHADO', preco_estatico_com_tar: true })
    const cat: PricingCatalog = { ...catalog, products: [...catalog.products, Fechado], energyPrices: [...catalog.energyPrices, ...tetra('Z', null, 0.2)] }
    const base = precificarProduto(Fechado, cat, inputBase)!
    const [r] = aplicarGoPorLinha([base], cat, inputBase, { Z: 99 })
    expect(r).toBe(base)
    expect(marcacoesDasLinhas([r], cat, { goPorLinha: { Z: 99 }, goFixadoPorLinha: {}, candidatas: new Set(), escolhidaKey: null }).get('Z')!.goOverride).toBeNull()
  })

  it('as linhas gravadas guardam o GO de cada linha (base do Documento Interno)', () => {
    const resultados = aplicarGoPorLinha(linhasBase(), catalog, inputBase, { [kJun27]: 20, [kJun28]: 5 })
    const m = marcacoesDasLinhas(resultados, catalog, { goPorLinha: { [kJun27]: 20, [kJun28]: 5 }, goFixadoPorLinha: {}, candidatas: new Set([kJun27, kJun28]), escolhidaKey: null })
    const gravadas = linhasParaGravar(resultados, m, () => null)
    expect(gravadas.map((l) => [l.variant_id, l.go_override])).toEqual([
      [vJun27.id, 20],
      [vJun28.id, 5],
      [vSn18.id, 10],
    ])
  })
})

describe('Edição de simulação — round-trip formulário → gravar → formulário', () => {
  const variantePadrao = (productId: string) => (productId === 'EzuBteGo' ? vJun27.id : productId === 'SnBteGo' ? vSn18.id : null)

  function gravarERecarregar(estado: EstadoFormularioSimulacao, esquema: Simulation['esquema_horario'], pontoConsumoId: string) {
    const resultados = aplicarGoPorLinha(linhasBase(), catalog, inputBase, estado.goPorLinha)
    const linhas = linhasParaGravar(resultados, marcacoesDasLinhas(resultados, catalog, estado), (id) => (id === vJun27.id ? 'Set/Out26 → Jun27' : null))
    const dados = dadosDaSimulacao(estado, esquema, pontoConsumoId, linhas, 'SnBteGo')
    // Como volta da BD: os mesmos dados + colunas geridas pelo servidor. JSON round-trip = jsonb.
    const gravada: Simulation = JSON.parse(
      JSON.stringify({ ...dados, id: 'sim-1', owner_id: 'u', created_at: '', updated_at: '', estado: 'RASCUNHO', enviada_em: null, ativa: false }),
    )
    return { dados, gravada, reaberto: estadoFormularioDaSimulacao(gravada, variantePadrao) }
  }

  const estadoBte: EstadoFormularioSimulacao = {
    segmento: 'BTE',
    clientId: 'cliente-1',
    pontoConsumoId: 'cpe-1',
    esquemaBtn: null,
    diasFaturados: 31,
    potencia: 60,
    horasPonta: null,
    consumoPeriodo: { PONTA: 2019, CHEIA: 5180, VAZIO: 2640, SUPER_VAZIO: 1355 },
    modoPrecoAtual: 'PERIODOS',
    precoAtualPeriodos: { PONTA: 0.1156, CHEIA: 0.0895, VAZIO: 0.1157, SUPER_VAZIO: 0.1072 },
    valorTotalPeriodo: 0,
    incluiTarAtual: false,
    tarOn: false,
    goPorLinha: { [kJun27]: 20, [kJun28]: 5, [kSn18]: 10 },
    goFixadoPorLinha: { [kJun28]: true },
    candidatas: new Set([kJun27, kSn18]),
    escolhidaKey: kSn18,
    produtosExpandidos: new Set(['EzuBteGo']),
    // Filtro 3.8: produtos desmarcados (fora da comparação) — têm de voltar desmarcados ao reabrir/duplicar.
    produtosExcluidos: new Set(['ZProdutoExcluido', 'AOutroExcluido']),
  }

  it('nenhum campo do formulário se perde (modo €/kWh por período, BTE)', () => {
    const { reaberto } = gravarERecarregar(estadoBte, 'TETRA_HORARIO', 'cpe-1')
    expect(reaberto).toEqual(estadoBte)
  })

  it('modo "valor total da fatura" (BTN): valor total, esquema, potência e TAR voltam intactos', () => {
    const estadoBtn: EstadoFormularioSimulacao = {
      ...estadoBte,
      segmento: 'BTN',
      esquemaBtn: 'BI_HORARIO',
      potencia: 10.35,
      modoPrecoAtual: 'TOTAL',
      precoAtualPeriodos: {},
      valorTotalPeriodo: 987.65,
      incluiTarAtual: true,
      tarOn: true,
      clientId: '',
      pontoConsumoId: '',
    }
    const { dados, reaberto } = gravarERecarregar(estadoBtn, 'BI_HORARIO', '')
    expect(dados.preco_atual_periodos).toBeNull()
    expect(dados.client_id).toBeNull()
    expect(reaberto).toEqual(estadoBtn)
  })

  it('produtos excluídos (filtro 3.8): gravados ordenados/sem repetidos e restaurados ao reabrir; simulação antiga sem a coluna → nenhum excluído', () => {
    const { dados, gravada, reaberto } = gravarERecarregar(estadoBte, 'TETRA_HORARIO', 'cpe-1')
    expect(dados.produtos_excluidos).toEqual(['AOutroExcluido', 'ZProdutoExcluido'])
    expect(reaberto.produtosExcluidos).toEqual(new Set(['ZProdutoExcluido', 'AOutroExcluido']))
    // "Duplicar simulação" copia a linha gravada inteira (spread) — a cópia reabre com o mesmo filtro.
    const { id: _id, ...copia } = gravada
    expect(estadoFormularioDaSimulacao({ ...copia, id: 'copia' }, variantePadrao).produtosExcluidos).toEqual(reaberto.produtosExcluidos)
    // Editar e voltar a incluir tudo grava [] (limpa o filtro antigo), nunca deixa o valor anterior.
    expect(gravarERecarregar({ ...estadoBte, produtosExcluidos: new Set() }, 'TETRA_HORARIO', 'cpe-1').dados.produtos_excluidos).toEqual([])
    expect(produtosExcluidosParaGravar(['b', 'a', 'b'])).toEqual(['a', 'b'])
    const { produtos_excluidos: _p, ...antiga } = gravada
    expect(estadoFormularioDaSimulacao(antiga as Simulation, variantePadrao).produtosExcluidos).toEqual(new Set())
    expect(estadoFormularioDaSimulacao({ ...gravada, produtos_excluidos: null }, variantePadrao).produtosExcluidos).toEqual(new Set())
  })

  it('grava o esquema efetivo e a CPE efetiva, e produto_escolhido_id deriva da linha escolhida', () => {
    const { dados } = gravarERecarregar(estadoBte, 'TETRA_HORARIO', 'cpe-efetiva')
    expect(dados.esquema_horario).toBe('TETRA_HORARIO')
    expect(dados.ponto_consumo_id).toBe('cpe-efetiva')
    expect(dados.produto_escolhido_id).toBe('SnBteGo')
    expect(dados.produto_sugerido_id).toBe('SnBteGo')
    expect(dados.go_override).toBeNull()
    expect(dados.resultados.filter((l) => l.escolhida)).toHaveLength(1)
  })

  it('só abre expandido ("Ver mais") o produto com uma linha gravada numa variante que não é a por omissão', () => {
    const soDefault = { ...estadoBte, produtosExpandidos: new Set<string>() }
    const gravada = simulacao({
      id: 's',
      segmento: 'BTE',
      resultados: [
        linha({ product_id: 'EzuBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO', variant_id: vJun27.id }),
        linha({ product_id: 'SnBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO', variant_id: vSn18.id }),
      ],
    })
    expect(estadoFormularioDaSimulacao(gravada, variantePadrao).produtosExpandidos).toEqual(soDefault.produtosExpandidos)
    const comOutra = { ...gravada, resultados: [...gravada.resultados, linha({ product_id: 'EzuBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO', variant_id: vJun28.id })] }
    expect(estadoFormularioDaSimulacao(comOutra, variantePadrao).produtosExpandidos).toEqual(new Set(['EzuBteGo']))
  })

  it('simulação antiga (GO e escolha só a nível da simulação) reabre com o GO em cada linha aberta e a escolhida certa', () => {
    const antiga = simulacao({
      id: 'antiga',
      segmento: 'BTE',
      go_override: 12,
      produto_escolhido_id: 'SnBteGo',
      resultados: [
        linha({ product_id: 'EzuBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO' }),
        linha({ product_id: 'SnBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO' }),
        linha({ product_id: 'Z', produto_nome: 'Z', tipo: 'FECHADO' }),
      ],
    })
    const e = estadoFormularioDaSimulacao(antiga)
    expect(e.goPorLinha).toEqual({ EzuBteGo: 12, SnBteGo: 12 })
    expect(e.escolhidaKey).toBe('SnBteGo')
    expect(e.candidatas.size).toBe(0)
  })
})

describe('Candidata / Escolhida (simulationLines)', () => {
  const sim = simulacao({
    id: 's',
    segmento: 'BTE',
    resultados: [
      linha({ product_id: 'EzuBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO', variant_id: vJun27.id, escolhida: true }),
      linha({ product_id: 'EzuBteGo', produto_nome: 'BTE GO', tipo: 'ABERTO_FIXO', variant_id: vJun28.id }),
    ],
  })

  it('marcarEscolhida deixa sempre no máximo 1 linha escolhida, mesmo entre variantes do mesmo produto', () => {
    const novos = marcarEscolhida(sim.resultados, null, null, kJun28)
    expect(novos.filter((l) => l.escolhida).map((l) => l.variant_id)).toEqual([vJun28.id])
    expect(linhaEscolhidaDaSimulacao({ ...sim, resultados: novos })!.variant_id).toBe(vJun28.id)
  })

  it('alternarCandidata só mexe na linha indicada e não toca na escolhida', () => {
    const novos = alternarCandidata(sim.resultados, null, null, kJun28)
    expect(novos.map((l) => [l.variant_id, l.candidata, l.escolhida])).toEqual([
      [vJun27.id, false, true],
      [vJun28.id, true, false],
    ])
  })

  it('normalizarResultados é idempotente e não mexe no GO de linhas já no formato novo', () => {
    const s = { ...sim, go_override: 99, resultados: [{ ...sim.resultados[0], go_override: 7, go_fixado: true, candidata: true }] }
    const uma = normalizarResultados(s)
    expect(normalizarResultados({ ...s, resultados: uma })).toEqual(uma)
    expect(uma[0]).toMatchObject({ go_override: 7, go_fixado: true, candidata: true, escolhida: true })
  })
})
