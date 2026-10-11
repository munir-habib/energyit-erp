import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  calcularComissao,
  calcularCustoAtualPeriodo,
  compararProdutos,
  consumoAnualTotal,
  estimarComissao,
  goValorResolvido,
  linhasPorVariante,
  precificarProduto,
  selecionarRegraComissao,
  tarEnergiaOficial,
  variantesComparaveis,
  type PricingCatalog,
  type SimulationInput,
} from './pricingEngine'
import type { PotenciaContratadaValor, ProductEnergyPrice, TarEnergiaBtn, TarEnergiaBteMt } from '../types/database'
import { potencia, price, product, regraComissao, variant } from '../test/fixtures'

const Z = product({ id: 'Z', segmento: 'BTN', nome: 'Z', tipo: 'FECHADO', preco_estatico_com_tar: true, potencia_tabela_id: 'tabZ' })
const ZC = product({ id: 'ZC', segmento: 'BTN', nome: 'ZC', tipo: 'FECHADO', preco_estatico_com_tar: true, potencia_tabela_id: 'tabZC' })
const DeluxePlus = product({ id: 'DeluxePlus', segmento: 'BTN', nome: 'Deluxe+', tipo: 'FECHADO', preco_estatico_com_tar: true, potencia_tabela_id: 'tabZC' })
const EzuBtnGo = product({ id: 'EzuBtnGo', segmento: 'BTN', nome: 'BTN GO', tipo: 'ABERTO_FIXO', preco_estatico_com_tar: false, potencia_tabela_id: 'tabBtnGoExcecao' })
const EzuBteGo = product({ id: 'EzuBteGo', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', preco_estatico_com_tar: false })
const EzuMtGo = product({ id: 'EzuMtGo', segmento: 'MT', nome: 'MT GO', tipo: 'ABERTO_FIXO', preco_estatico_com_tar: false })
const Boost = product({ id: 'Boost', segmento: 'BTN', nome: 'Plano BOOST', tipo: 'FECHADO', preco_estatico_com_tar: true, potencia_tabela_id: 'tabBoost' })
const Max = product({ id: 'Max', segmento: 'BTN', nome: 'Plano MAX', tipo: 'FECHADO', preco_estatico_com_tar: true, potencia_tabela_id: 'tabMax' })
const SnBteGo = product({ id: 'SnBteGo', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', preco_estatico_com_tar: false })

const vSetOutJun27Btn = variant('v-btn-set-jun27', 'EzuBtnGo', { grupo_label: 'Set/Out26', fim_label: 'Jun27', data_inicio: '2026-09-01', data_fim: '2027-06-30' })
const vSetOutJun27Bte = variant('v-bte-set-jun27', 'EzuBteGo', { grupo_label: 'Set/Out26', fim_label: 'Jun27', data_inicio: '2026-09-01', data_fim: '2027-06-30' })
const vSetOutJun27Mt = variant('v-mt-set-jun27', 'EzuMtGo', { grupo_label: 'Set/Out26', fim_label: 'Jun27', data_inicio: '2026-09-01', data_fim: '2027-06-30' })
const vJanJun30Mt = variant('v-mt-jan-jun30', 'EzuMtGo', { grupo_label: 'Jan27', fim_label: 'Jun30', data_inicio: '2027-01-01', data_fim: '2030-06-30' })
const vBoost24 = variant('v-boost-24', 'Boost', { duracao_meses: 24 })
const vMax12 = variant('v-max-12', 'Max', { duracao_meses: 12 })
const vSn18 = variant('v-sn-18', 'SnBteGo', { duracao_meses: 18 })

const energyPrices: ProductEnergyPrice[] = [
  price('Z', null, 'SIMPLES', 'SIMPLES', 0.1697),
  price('Z', null, 'BI_HORARIO', 'FORA_VAZIO', 0.1925),
  price('Z', null, 'BI_HORARIO', 'VAZIO', 0.1248),
  price('Z', null, 'TRI_HORARIO', 'PONTA', 0.3547),
  price('Z', null, 'TRI_HORARIO', 'CHEIA', 0.1614),
  price('Z', null, 'TRI_HORARIO', 'VAZIO', 0.124),
  price('ZC', null, 'TRI_HORARIO', 'PONTA', 0.3547),
  price('ZC', null, 'TRI_HORARIO', 'CHEIA', 0.1614),
  price('ZC', null, 'TRI_HORARIO', 'VAZIO', 0.124),
  price('DeluxePlus', null, 'BI_HORARIO', 'FORA_VAZIO', 0.1828),
  price('DeluxePlus', null, 'BI_HORARIO', 'VAZIO', 0.1151),
  price('EzuBtnGo', vSetOutJun27Btn.id, 'SIMPLES', 'SIMPLES', 0.1144),
  price('EzuBteGo', vSetOutJun27Bte.id, 'TETRA_HORARIO', 'PONTA', 0.106),
  price('EzuBteGo', vSetOutJun27Bte.id, 'TETRA_HORARIO', 'CHEIA', 0.1006),
  price('EzuBteGo', vSetOutJun27Bte.id, 'TETRA_HORARIO', 'VAZIO', 0.1272),
  price('EzuBteGo', vSetOutJun27Bte.id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.1277),
  price('EzuMtGo', vSetOutJun27Mt.id, 'TETRA_HORARIO', 'PONTA', 0.1037),
  price('EzuMtGo', vSetOutJun27Mt.id, 'TETRA_HORARIO', 'CHEIA', 0.0985),
  price('EzuMtGo', vSetOutJun27Mt.id, 'TETRA_HORARIO', 'VAZIO', 0.1254),
  price('EzuMtGo', vSetOutJun27Mt.id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.126),
  price('EzuMtGo', vJanJun30Mt.id, 'TETRA_HORARIO', 'PONTA', 0.0679),
  price('EzuMtGo', vJanJun30Mt.id, 'TETRA_HORARIO', 'CHEIA', 0.0619),
  price('EzuMtGo', vJanJun30Mt.id, 'TETRA_HORARIO', 'VAZIO', 0.0898),
  price('EzuMtGo', vJanJun30Mt.id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0916),
  price('Boost', vBoost24.id, 'TRI_HORARIO', 'PONTA', 0.342, false),
  price('Boost', vBoost24.id, 'TRI_HORARIO', 'CHEIA', 0.1461, false),
  price('Boost', vBoost24.id, 'TRI_HORARIO', 'VAZIO', 0.1155, false),
  price('Max', vMax12.id, 'SIMPLES', 'SIMPLES', 0.1563, null),
  price('SnBteGo', vSn18.id, 'TETRA_HORARIO', 'PONTA', 0.0758),
  price('SnBteGo', vSn18.id, 'TETRA_HORARIO', 'CHEIA', 0.0772),
  price('SnBteGo', vSn18.id, 'TETRA_HORARIO', 'VAZIO', 0.0839),
  price('SnBteGo', vSn18.id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0787),
]

const potenciaValores: PotenciaContratadaValor[] = [
  potencia('tabZ', 6.9, 0.73757),
  potencia('tabZC', 34.5, 2.88268),
  potencia('tabZC', 13.8, 1.51698),
  potencia('tabBoost', 34.5, 2.316),
  potencia('tabMax', 6.9, 0.9836),
]

const tarEnergiaBtn: TarEnergiaBtn[] = [
  { id: '1', esquema_horario: 'SIMPLES', periodo: 'SIMPLES', abaixo_20_7kva: false, valor: 0.0607, updated_at: '' },
]

const tarEnergiaBteMt: TarEnergiaBteMt[] = [
  { id: 'b1', categoria: 'BTE', periodo: 'PONTA', valor: 0.0397, updated_at: '' },
  { id: 'b2', categoria: 'BTE', periodo: 'CHEIA', valor: 0.0353, updated_at: '' },
  { id: 'b3', categoria: 'BTE', periodo: 'VAZIO', valor: 0.0285, updated_at: '' },
  { id: 'b4', categoria: 'BTE', periodo: 'SUPER_VAZIO', valor: 0.0237, updated_at: '' },
  { id: 'm1', categoria: 'MT', periodo: 'PONTA', valor: 0.0203, updated_at: '' },
  { id: 'm2', categoria: 'MT', periodo: 'CHEIA', valor: 0.0182, updated_at: '' },
  { id: 'm3', categoria: 'MT', periodo: 'VAZIO', valor: 0.0146, updated_at: '' },
  { id: 'm4', categoria: 'MT', periodo: 'SUPER_VAZIO', valor: 0.0129, updated_at: '' },
]

const catalog: PricingCatalog = {
  products: [Z, ZC, DeluxePlus, EzuBtnGo, EzuBteGo, EzuMtGo, Boost, Max, SnBteGo],
  energyPrices,
  formulas: [],
  variants: [vSetOutJun27Btn, vSetOutJun27Bte, vSetOutJun27Mt, vJanJun30Mt, vBoost24, vMax12, vSn18],
  tarEnergiaBtn,
  tarPotenciaBtn: [],
  tarEnergiaBteMt,
  tarPotenciaBteMt: [],
  potenciaValores,
  marketIndices: [],
  goGrid: new Map(),
}

function baseInput(overrides: Partial<SimulationInput>): SimulationInput {
  return {
    segmento: 'BTN',
    esquemaHorario: 'SIMPLES',
    potenciaContratadaKva: 6.9,
    diasFaturados: 30,
    consumoPeriodo: {},
    comTar: true,
    custoAtualPeriodo: 0,
    ...overrides,
  }
}

/** Total do período = energia + potência contratada (esta última nunca entra na poupança, só no total apresentado). */
function totalPeriodo(r: NonNullable<ReturnType<typeof precificarProduto>>): number {
  return r.custoEnergiaPeriodo + r.potenciaEurPeriodo
}

describe('precificarProduto — catálogo EZU/SuperNova', () => {
  it('Teste 1 — EZU Z, Simples, PC 6,9 kVA, 30 dias, 350 kWh → 81,52 €', () => {
    const r = precificarProduto(Z, catalog, baseInput({ consumoPeriodo: { SIMPLES: 350 } }))!
    expect(totalPeriodo(r)).toBeCloseTo(81.52, 2)
  })

  it('Teste 2 — EZU ZC, Tri, PC 34,5 kVA, Ponta 100 / Cheia 250 / Vazio 600 → 236,70 €', () => {
    const r = precificarProduto(
      ZC,
      catalog,
      baseInput({ esquemaHorario: 'TRI_HORARIO', potenciaContratadaKva: 34.5, consumoPeriodo: { PONTA: 100, CHEIA: 250, VAZIO: 600 } }),
    )!
    expect(totalPeriodo(r)).toBeCloseTo(236.7, 2)
  })

  it('Teste 3 — EZU Deluxe+, Bi, PC 13,8 kVA, FV 180 / Vazio 220 → 103,74 €', () => {
    const r = precificarProduto(
      DeluxePlus,
      catalog,
      baseInput({ esquemaHorario: 'BI_HORARIO', potenciaContratadaKva: 13.8, consumoPeriodo: { FORA_VAZIO: 180, VAZIO: 220 } }),
    )!
    expect(totalPeriodo(r)).toBeCloseTo(103.74, 2)
  })

  it('Teste 4 — EZU BTN GO (Set/Out26→Jun27), Simples, GO=10 → 0,1851 €/kWh', () => {
    const r = precificarProduto(
      EzuBtnGo,
      catalog,
      baseInput({ consumoPeriodo: { SIMPLES: 1 }, goOverride: 10, variantePorProduto: { EzuBtnGo: vSetOutJun27Btn.id } }),
    )!
    expect(r.precosPeriodo.SIMPLES).toBeCloseTo(0.1851, 4)
  })

  it('Teste 5 — EZU BTE GO (Set/Out26→Jun27), GO=11 → Ponta 0,1567 €/kWh', () => {
    const r = precificarProduto(
      EzuBteGo,
      catalog,
      baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { PONTA: 1 }, goOverride: 11, variantePorProduto: { EzuBteGo: vSetOutJun27Bte.id } }),
    )!
    expect(r.precosPeriodo.PONTA).toBeCloseTo(0.1567, 4)
  })

  it('Teste 6 — EZU MT GO (Jan27→Jun30), GO=5 → Vazio 0,1094 €/kWh', () => {
    const r = precificarProduto(
      EzuMtGo,
      catalog,
      baseInput({ segmento: 'MT', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { VAZIO: 1 }, goOverride: 5, variantePorProduto: { EzuMtGo: vJanJun30Mt.id } }),
    )!
    expect(r.precosPeriodo.VAZIO).toBeCloseTo(0.1094, 4)
  })

  it('Teste 7 — SuperNova BOOST, Tri, PC 34,5 kVA (>20,7), 24 meses, Ponta 150 / Cheia 300 / Vazio 450 → 216,59 €', () => {
    const r = precificarProduto(
      Boost,
      catalog,
      baseInput({ esquemaHorario: 'TRI_HORARIO', potenciaContratadaKva: 34.5, consumoPeriodo: { PONTA: 150, CHEIA: 300, VAZIO: 450 }, variantePorProduto: { Boost: vBoost24.id } }),
    )!
    expect(totalPeriodo(r)).toBeCloseTo(216.59, 2)
  })

  it('Teste 8 — SuperNova BTE GO, 18 meses, GO=13 → Ponta 0,1285 €/kWh', () => {
    const r = precificarProduto(
      SnBteGo,
      catalog,
      baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { PONTA: 1 }, goOverride: 13, variantePorProduto: { SnBteGo: vSn18.id } }),
    )!
    expect(r.precosPeriodo.PONTA).toBeCloseTo(0.1285, 4)
  })

  it('Teste 9 — SuperNova Plano MAX, Simples, PC 6,9 kVA, 30 dias, 350 kWh, 12 meses → 84,21 € (sem arredondar parcelas)', () => {
    const r = precificarProduto(
      Max,
      catalog,
      baseInput({ consumoPeriodo: { SIMPLES: 350 }, variantePorProduto: { Max: vMax12.id } }),
    )!
    // 0,1563 × 350 + 0,9836 × 30 = 54,705 + 29,508 = 84,213 → 84,21 € no total apresentado.
    expect(totalPeriodo(r)).toBeCloseTo(84.213, 3)
  })

  it('Teste 10 — EZU MT GO (Set/Out26→Jun27), GO=9 → Cheia 0,1257 €/kWh', () => {
    const r = precificarProduto(
      EzuMtGo,
      catalog,
      baseInput({ segmento: 'MT', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { CHEIA: 1 }, goOverride: 9, variantePorProduto: { EzuMtGo: vSetOutJun27Mt.id } }),
    )!
    expect(r.precosPeriodo.CHEIA).toBeCloseTo(0.1257, 4)
  })
})

describe('calcularCustoAtualPeriodo — ajuste de TAR quando "já inclui TAR" está desmarcada', () => {
  // Caso real reportado: BTE, 31 dias, PC 60 kVA — preço atual inserido SEM TAR (checkbox desmarcada).
  const consumoPeriodo = { PONTA: 2019, CHEIA: 5180, VAZIO: 2640, SUPER_VAZIO: 1355 }
  const precoAtualPeriodos = { PONTA: 0.1156, CHEIA: 0.0895, VAZIO: 0.1157, SUPER_VAZIO: 0.1072 }
  const ajusteTarAtual = {
    segmento: 'BTE' as const,
    esquemaHorario: 'TETRA_HORARIO' as const,
    potenciaContratadaKva: 60,
    tarEnergiaBtn,
    tarEnergiaBteMt,
  }

  it('checkbox desmarcada → soma a TAR oficial do período antes de multiplicar pelo consumo (1.518,07 €)', () => {
    const custo = calcularCustoAtualPeriodo({
      modo: 'PERIODOS',
      consumoPeriodo,
      precoAtualPeriodos,
      ajusteTarAtual: { ...ajusteTarAtual, incluiTarAtual: false },
    })
    expect(custo).toBeCloseTo(1518.07, 2)
  })

  it('checkbox marcada → usa o preço tal como inserido, sem somar TAR (1.147,71 €, valor de antes da correção — mas agora correto porque o preço já a inclui)', () => {
    const custo = calcularCustoAtualPeriodo({
      modo: 'PERIODOS',
      consumoPeriodo,
      precoAtualPeriodos,
      ajusteTarAtual: { ...ajusteTarAtual, incluiTarAtual: true },
    })
    expect(custo).toBeCloseTo(1147.71, 2)
  })

  it('indicador de verificação (sem ajusteTarAtual, como o ecrã calcula o quadro "confirme contra a fatura em papel") mantém-se 1.147,71 € mesmo com a checkbox desmarcada — nunca ajusta, é literalmente o que o consultor escreveu', () => {
    // O ecrã (SimulationNewPage) chama a função assim, sem ajusteTarAtual, para o indicador de
    // verificação — independentemente do estado real da checkbox "já inclui TAR" nesse momento.
    const custo = calcularCustoAtualPeriodo({ modo: 'PERIODOS', consumoPeriodo, precoAtualPeriodos })
    expect(custo).toBeCloseTo(1147.71, 2)
  })

  it('Modo TOTAL nunca ajusta (já é um valor final, sem período a ajustar)', () => {
    const custo = calcularCustoAtualPeriodo({
      modo: 'TOTAL',
      consumoPeriodo,
      valorTotalPeriodo: 1000,
      ajusteTarAtual: { ...ajusteTarAtual, incluiTarAtual: false },
    })
    expect(custo).toBe(1000)
  })

  it('ponta a ponta: SuperNova BTE GO a 0,126683 €/kWh → poupança ≈ 6,6% (positiva, antes dava -23,6%)', () => {
    const SnBteGoFlat = product({
      id: 'SnBteGoFlat',
      segmento: 'BTE',
      nome: 'SuperNova BTE GO',
      tipo: 'ABERTO_FIXO',
      preco_estatico_com_tar: true, // preço já final (0,126683 €/kWh em todos os períodos), sem TAR/GO adicional do motor
    })
    const catalogBte: PricingCatalog = {
      products: [SnBteGoFlat],
      energyPrices: (['PONTA', 'CHEIA', 'VAZIO', 'SUPER_VAZIO'] as const).map((p) => price('SnBteGoFlat', null, 'TETRA_HORARIO', p, 0.126683)),
      formulas: [],
      variants: [],
      tarEnergiaBtn,
      tarPotenciaBtn: [],
      tarEnergiaBteMt,
      tarPotenciaBteMt: [],
      potenciaValores: [],
      marketIndices: [],
      goGrid: new Map(),
    }
    const custoAtualPeriodo = calcularCustoAtualPeriodo({
      modo: 'PERIODOS',
      consumoPeriodo,
      precoAtualPeriodos,
      ajusteTarAtual: { ...ajusteTarAtual, incluiTarAtual: false },
    })
    const r = precificarProduto(
      SnBteGoFlat,
      catalogBte,
      baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', potenciaContratadaKva: 60, diasFaturados: 31, consumoPeriodo, custoAtualPeriodo }),
    )!
    expect(r.custoEnergiaPeriodo).toBeCloseTo(1418.09, 1)
    expect(r.poupancaPct).toBeCloseTo(6.6, 1)
    expect(r.poupancaPct).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// QA — cobertura adicional. Valores esperados derivados dos preços/TAR de seed
// (0002_seed.sql, 0011_ezu_supernova_real_data.sql, 0017_catalogo_ezu_supernova.sql) aplicados à
// fórmula documentada do motor: preço final = base + GO/1000 + TAR (Abertos) ou base (Fechados, preço
// já com TAR); total do período = Σ preço × kWh + potência €/dia × dias.
// ---------------------------------------------------------------------------

// SuperNova Plano Flex (0017 §4): 12 meses Simples 0,1463; Tri ≤20,7 kVA 0,3306/0,1244/0,1047; Tri >20,7 0,3311/0,1356/0,1039.
// 24 meses Tri ≤20,7 0,3388/0,1322/0,1136. Potência: tabela "SuperNova — Plano Flex" (0011 §4).
const Flex = product({ id: 'Flex', segmento: 'BTN', nome: 'Plano Flex', tipo: 'FECHADO', preco_estatico_com_tar: true, potencia_tabela_id: 'tabFlex' })
const vFlex12 = variant('v-flex-12', 'Flex', { duracao_meses: 12 })
const vFlex24 = variant('v-flex-24', 'Flex', { duracao_meses: 24 })
// SuperNova MT GO 24 meses (0017 §5): 0,0736 / 0,0760 / 0,0728 / 0,0754, go_valor 10.
const SnMtGo = product({ id: 'SnMtGo', segmento: 'MT', nome: 'MT GO', tipo: 'ABERTO_FIXO', go_valor: 10 })
const vSnMt24 = variant('v-snmt-24', 'SnMtGo', { duracao_meses: 24 })
// Produto Aberto BTN sem tabela de potência própria — usa a TAR de Potência transversal.
const BtnAbertoGenerico = product({ id: 'BtnAberto', segmento: 'BTN', nome: 'Aberto BTN', tipo: 'ABERTO_FIXO', go_valor: 10 })

const catalogQa: PricingCatalog = {
  ...catalog,
  products: [...catalog.products, Flex, SnMtGo, BtnAbertoGenerico],
  variants: [...catalog.variants, vFlex12, vFlex24, vSnMt24],
  energyPrices: [
    ...catalog.energyPrices,
    price('Flex', vFlex12.id, 'SIMPLES', 'SIMPLES', 0.1463, null),
    price('Flex', vFlex12.id, 'TRI_HORARIO', 'PONTA', 0.3306, true),
    price('Flex', vFlex12.id, 'TRI_HORARIO', 'CHEIA', 0.1244, true),
    price('Flex', vFlex12.id, 'TRI_HORARIO', 'VAZIO', 0.1047, true),
    price('Flex', vFlex12.id, 'TRI_HORARIO', 'PONTA', 0.3311, false),
    price('Flex', vFlex12.id, 'TRI_HORARIO', 'CHEIA', 0.1356, false),
    price('Flex', vFlex12.id, 'TRI_HORARIO', 'VAZIO', 0.1039, false),
    price('Flex', vFlex24.id, 'TRI_HORARIO', 'PONTA', 0.3388, true),
    price('Flex', vFlex24.id, 'TRI_HORARIO', 'CHEIA', 0.1322, true),
    price('Flex', vFlex24.id, 'TRI_HORARIO', 'VAZIO', 0.1136, true),
    price('SnMtGo', vSnMt24.id, 'TETRA_HORARIO', 'PONTA', 0.0736),
    price('SnMtGo', vSnMt24.id, 'TETRA_HORARIO', 'CHEIA', 0.076),
    price('SnMtGo', vSnMt24.id, 'TETRA_HORARIO', 'VAZIO', 0.0728),
    price('SnMtGo', vSnMt24.id, 'TETRA_HORARIO', 'SUPER_VAZIO', 0.0754),
    price('BtnAberto', null, 'SIMPLES', 'SIMPLES', 0.1144),
  ],
  potenciaValores: [
    ...catalog.potenciaValores,
    potencia('tabFlex', 6.9, 0.4036),
    potencia('tabFlex', 13.8, 0.7562),
    // Exceção EZU Aberto BTN (0011 §3, "tabela antiga, exceção").
    potencia('tabBtnGoExcecao', 6.9, 0.4592),
  ],
  // TAR de Potência BTN oficial/transversal (0011 §2).
  tarPotenciaBtn: [
    { id: 'tp1', potencia_kva: 6.9, valor_dia: 0.3436, updated_at: '' },
    { id: 'tp2', potencia_kva: 10.35, valor_dia: 0.5154, updated_at: '' },
  ],
  // Coeficientes TAR Potência BTE/MT (0002, "TAR — Componente Potência BTE & MT").
  tarPotenciaBteMt: [
    { id: 'pb', categoria: 'BTE', coef_php: 0.5521, coef_pc: 0.0563, updated_at: '' },
    { id: 'pm', categoria: 'MT', coef_php: 0.2435, coef_pc: 0.0458, updated_at: '' },
  ],
}

describe('precificarProduto — SuperNova Plano Flex e MT GO', () => {
  it('Plano Flex 12 meses, Simples, PC 6,9 kVA, 30 dias, 350 kWh → 0,1463×350 + 0,4036×30 = 63,313 €', () => {
    const r = precificarProduto(Flex, catalogQa, baseInput({ consumoPeriodo: { SIMPLES: 350 }, variantePorProduto: { Flex: vFlex12.id } }))!
    expect(r.precosPeriodo.SIMPLES).toBeCloseTo(0.1463, 6)
    expect(r.potenciaEurDia).toBeCloseTo(0.4036, 6)
    expect(totalPeriodo(r)).toBeCloseTo(63.313, 3)
  })

  it('Plano Flex Tri-Horário escolhe o escalão de preço pela potência: 13,8 kVA → ≤20,7; 34,5 kVA → >20,7', () => {
    const tri = { esquemaHorario: 'TRI_HORARIO' as const, consumoPeriodo: { PONTA: 1, CHEIA: 1, VAZIO: 1 }, variantePorProduto: { Flex: vFlex12.id } }
    const abaixo = precificarProduto(Flex, catalogQa, baseInput({ ...tri, potenciaContratadaKva: 13.8 }))!
    const acima = precificarProduto(Flex, catalogQa, baseInput({ ...tri, potenciaContratadaKva: 34.5 }))!
    expect(abaixo.precosPeriodo).toEqual({ PONTA: 0.3306, CHEIA: 0.1244, VAZIO: 0.1047 })
    expect(acima.precosPeriodo).toEqual({ PONTA: 0.3311, CHEIA: 0.1356, VAZIO: 0.1039 })
  })

  it('fronteira 20,7 kVA: exatamente 20,7 kVA fica no escalão ≤20,7 (preço Flex e TAR de energia BTN); 20,71 já é >20,7', () => {
    const tri = { esquemaHorario: 'TRI_HORARIO' as const, consumoPeriodo: { PONTA: 1, CHEIA: 1, VAZIO: 1 }, variantePorProduto: { Flex: vFlex12.id } }
    const em = precificarProduto(Flex, catalogQa, baseInput({ ...tri, potenciaContratadaKva: 20.7 }))!
    const acima = precificarProduto(Flex, catalogQa, baseInput({ ...tri, potenciaContratadaKva: 20.71 }))!
    expect(em.precosPeriodo).toEqual({ PONTA: 0.3306, CHEIA: 0.1244, VAZIO: 0.1047 })
    expect(acima.precosPeriodo).toEqual({ PONTA: 0.3311, CHEIA: 0.1356, VAZIO: 0.1039 })

    // Linhas sintéticas só para distinguir os dois escalões da TAR de energia BTN.
    const tarBtn: TarEnergiaBtn[] = [
      { id: 'lo', esquema_horario: 'SIMPLES', periodo: 'SIMPLES', abaixo_20_7kva: true, valor: 0.01, updated_at: '' },
      { id: 'hi', esquema_horario: 'SIMPLES', periodo: 'SIMPLES', abaixo_20_7kva: false, valor: 0.02, updated_at: '' },
    ]
    expect(tarEnergiaOficial('BTN', 'SIMPLES', 'SIMPLES', 20.7, tarBtn, [])).toBe(0.01)
    expect(tarEnergiaOficial('BTN', 'SIMPLES', 'SIMPLES', 20.71, tarBtn, [])).toBe(0.02)
  })

  it('Plano Flex 24 meses usa os preços da variante de 24 meses (não os de 12)', () => {
    const r = precificarProduto(
      Flex,
      catalogQa,
      baseInput({ esquemaHorario: 'TRI_HORARIO', potenciaContratadaKva: 13.8, consumoPeriodo: { PONTA: 1 }, variantePorProduto: { Flex: vFlex24.id } }),
    )!
    expect(r.precosPeriodo.PONTA).toBeCloseTo(0.3388, 6)
  })

  it('Plano Flex sem variante escolhida usa a duração mais curta (12 meses)', () => {
    const r = precificarProduto(Flex, catalogQa, baseInput({ consumoPeriodo: { SIMPLES: 1 } }))!
    expect(r.variantId).toBe(vFlex12.id)
  })

  it('SuperNova MT GO 24 meses, GO por omissão do produto (10) → Ponta 0,0736 + 0,010 + TAR MT 0,0203 = 0,1039 €/kWh', () => {
    const r = precificarProduto(
      SnMtGo,
      catalogQa,
      baseInput({ segmento: 'MT', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { PONTA: 1 }, variantePorProduto: { SnMtGo: vSnMt24.id } }),
    )!
    expect(r.precosPeriodo.PONTA).toBeCloseTo(0.1039, 6)
    expect(r.precosPeriodo.SUPER_VAZIO).toBeCloseTo(0.0754 + 0.01 + 0.0129, 6)
  })
})

describe('TAR — energia e potência', () => {
  it('Aberto: preço final = base + GO/1000 + TAR energia; decomposição semTar = base + GO, tar = TAR oficial', () => {
    const r = precificarProduto(
      EzuBteGo,
      catalogQa,
      baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { CHEIA: 1 }, goOverride: 11, variantePorProduto: { EzuBteGo: vSetOutJun27Bte.id } }),
    )!
    expect(r.componentesPeriodo.CHEIA!.semTar).toBeCloseTo(0.1006 + 0.011, 6)
    expect(r.componentesPeriodo.CHEIA!.tar).toBeCloseTo(0.0353, 6)
    expect(r.precosPeriodo.CHEIA).toBeCloseTo(0.1006 + 0.011 + 0.0353, 6)
  })

  it('Aberto com comTar=false: não soma TAR de energia nem cobra potência', () => {
    const r = precificarProduto(
      EzuBtnGo,
      catalogQa,
      baseInput({ consumoPeriodo: { SIMPLES: 1 }, goOverride: 10, comTar: false, variantePorProduto: { EzuBtnGo: vSetOutJun27Btn.id } }),
    )!
    expect(r.precosPeriodo.SIMPLES).toBeCloseTo(0.1144 + 0.01, 6)
    expect(r.potenciaEurDia).toBe(0)
  })

  it('Fechado (preço já com TAR): nunca soma TAR nem GO; semTar = preço − TAR oficial', () => {
    const r = precificarProduto(Z, catalogQa, baseInput({ consumoPeriodo: { SIMPLES: 1 }, goOverride: 50 }))!
    expect(r.precosPeriodo.SIMPLES).toBeCloseTo(0.1697, 6)
    expect(r.componentesPeriodo.SIMPLES!.semTar).toBeCloseTo(0.1697 - 0.0607, 6)
    expect(r.tarSempreIncluida).toBe(true)
  })

  it('Exceção EZU aberta BTN: potência usa a tabela própria (0,4592 €/dia a 6,9 kVA), não a TAR de Potência transversal (0,3436)', () => {
    const r = precificarProduto(EzuBtnGo, catalogQa, baseInput({ consumoPeriodo: { SIMPLES: 1 }, variantePorProduto: { EzuBtnGo: vSetOutJun27Btn.id } }))!
    expect(r.potenciaEurDia).toBeCloseTo(0.4592, 6)
    expect(r.potenciaEurPeriodo).toBeCloseTo(0.4592 * 30, 6)
  })

  it('Aberto BTN sem tabela própria usa a TAR de Potência transversal (0,3436 €/dia a 6,9 kVA)', () => {
    const r = precificarProduto(BtnAbertoGenerico, catalogQa, baseInput({ consumoPeriodo: { SIMPLES: 1 } }))!
    expect(r.potenciaEurDia).toBeCloseTo(0.3436, 6)
  })

  it('TAR de Potência transversal BTN numa potência fora da tabela usa o escalão seguinte (7 kVA → 10,35 kVA)', () => {
    const r = precificarProduto(BtnAbertoGenerico, catalogQa, baseInput({ potenciaContratadaKva: 7, consumoPeriodo: { SIMPLES: 1 } }))!
    expect(r.potenciaEurDia).toBeCloseTo(0.5154, 6)
  })

  it('TAR de Potência BTE = coef_pc × PC + coef_php × (kWh Ponta ÷ (horas Ponta × dias))', () => {
    const r = precificarProduto(
      EzuBteGo,
      catalogQa,
      baseInput({
        segmento: 'BTE',
        esquemaHorario: 'TETRA_HORARIO',
        potenciaContratadaKva: 60,
        horasPontaDiarias: 4,
        consumoPeriodo: { PONTA: 2400 },
        variantePorProduto: { EzuBteGo: vSetOutJun27Bte.id },
      }),
    )!
    // 0,0563 × 60 + 0,5521 × 2400/(4×30) = 3,378 + 11,042 = 14,42 €/dia
    expect(r.potenciaEurDia).toBeCloseTo(14.42, 6)
  })

  it('TAR de Potência BTE sem horas de ponta → só o termo da potência contratada', () => {
    const r = precificarProduto(
      EzuBteGo,
      catalogQa,
      baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', potenciaContratadaKva: 60, consumoPeriodo: { PONTA: 2400 }, variantePorProduto: { EzuBteGo: vSetOutJun27Bte.id } }),
    )!
    expect(r.potenciaEurDia).toBeCloseTo(0.0563 * 60, 6)
  })

  it('a potência nunca entra na poupança — só custo de energia', () => {
    const r = precificarProduto(Z, catalogQa, baseInput({ consumoPeriodo: { SIMPLES: 350 }, custoAtualPeriodo: 70 }))!
    expect(r.poupancaEurPeriodo).toBeCloseTo(70 - 0.1697 * 350, 6)
  })
})

describe('GO — resolução', () => {
  const inputBte = baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { PONTA: 1 }, variantePorProduto: { EzuBteGo: vSetOutJun27Bte.id } })
  const EzuBteGo10 = { ...EzuBteGo, go_valor: 10 }

  it('sem override nem grelha → go_valor do produto', () => {
    expect(goValorResolvido(EzuBteGo10, catalogQa)).toBe(10)
    expect(precificarProduto(EzuBteGo10, catalogQa, inputBte)!.precosPeriodo.PONTA).toBeCloseTo(0.106 + 0.01 + 0.0397, 6)
  })

  it('grelha de GO (fórmula) prevalece sobre go_valor', () => {
    const cat = { ...catalogQa, goGrid: new Map([[EzuBteGo10.id, { value: 14 }]]) }
    expect(goValorResolvido(EzuBteGo10, cat)).toBe(14)
    expect(precificarProduto(EzuBteGo10, cat, inputBte)!.precosPeriodo.PONTA).toBeCloseTo(0.106 + 0.014 + 0.0397, 6)
  })

  it('GO da linha (goOverride) prevalece sobre grelha e go_valor', () => {
    const cat = { ...catalogQa, goGrid: new Map([[EzuBteGo10.id, { value: 14 }]]) }
    expect(precificarProduto(EzuBteGo10, cat, { ...inputBte, goOverride: 3 })!.precosPeriodo.PONTA).toBeCloseTo(0.106 + 0.003 + 0.0397, 6)
  })

  it('alertaGo quando o preço final ultrapassa o preço-limite do produto', () => {
    const comLimite = { ...EzuBteGo10, preco_limite: 0.17 } // o alerta olha para todos os períodos (o mais caro é Vazio: 0,1272 + GO + 0,0285)
    expect(precificarProduto(comLimite, catalogQa, { ...inputBte, goOverride: 10 })!.alertaGo).toBe(false) // Vazio 0,1657
    expect(precificarProduto(comLimite, catalogQa, { ...inputBte, goOverride: 20 })!.alertaGo).toBe(true) // Vazio 0,1757
  })
})

describe('Comissão por GO', () => {
  // Regras de seed (0002): "Padrão — GO ≤ 15" ×0,125 desde 2026-01-01; "Temporária — qualquer GO" ×0,15 de 2026-06-01 a 2026-12-31.
  const padrao = regraComissao({ id: 'padrao', go_max: 15, multiplicador: 0.125, valido_desde: '2026-01-01' })
  const temporaria = regraComissao({ id: 'temporaria', multiplicador: 0.15, valido_desde: '2026-06-01', valido_ate: '2026-12-31' })
  const regras = [padrao, temporaria]

  it('fronteira do GO máximo: GO 15 → Padrão; GO 15,01 fora da janela temporária → nenhuma regra', () => {
    expect(selecionarRegraComissao(regras, 15, '2026-03-01')?.id).toBe('padrao')
    expect(selecionarRegraComissao(regras, 15.01, '2026-03-01')).toBeNull()
  })

  it('regra com intervalo de GO específico ganha à regra "qualquer GO" quando ambas se aplicam', () => {
    expect(selecionarRegraComissao(regras, 10, '2026-07-01')?.id).toBe('padrao')
    expect(selecionarRegraComissao(regras, 20, '2026-07-01')?.id).toBe('temporaria')
  })

  it('janela de validade: fora das datas a regra não se aplica', () => {
    expect(selecionarRegraComissao(regras, 20, '2026-12-31')?.id).toBe('temporaria')
    expect(selecionarRegraComissao(regras, 20, '2027-01-01')).toBeNull()
    expect(selecionarRegraComissao(regras, 10, '2025-12-31')).toBeNull()
  })

  it('fórmula: comissão = consumo anual × GO/1000 × multiplicador', () => {
    const aberto = product({ id: 'a', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', go_valor: 10 })
    const c = calcularComissao(aberto, regras, 100_000, '2026-03-01', 12)
    expect(c.valor).toBeCloseTo(100_000 * 0.012 * 0.125, 6) // 150 €
    expect(c.goAplicado).toBe(12)
    expect(c.multiplicadorAplicado).toBe(0.125)
    expect(c.regraId).toBe('padrao')
    // sem GO resolvido → go_valor do produto
    expect(calcularComissao(aberto, regras, 100_000, '2026-03-01').valor).toBeCloseTo(100_000 * 0.01 * 0.125, 6)
  })

  it('Fechado usa sempre a comissão fixa, nunca GO', () => {
    const fechado = product({ id: 'f', segmento: 'BTN', nome: 'Z', tipo: 'FECHADO', comissao_fixa: 80 })
    expect(calcularComissao(fechado, regras, 100_000, '2026-03-01', 30)).toEqual({ valor: 80, goAplicado: null, multiplicadorAplicado: null, regraId: null })
  })

  it('estimarComissao nunca inventa €0: sem regra aplicável ou sem comissão fixa → indefinida', () => {
    const aberto = product({ id: 'a', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', go_valor: 10 })
    const fechadoSemValor = product({ id: 'f', segmento: 'BTN', nome: 'Z', tipo: 'FECHADO' })
    expect(estimarComissao(aberto, [], 1000, '2026-03-01').indefinida).toBe(true)
    expect(estimarComissao(aberto, regras, 1000, '2026-03-01', 40).indefinida).toBe(true) // GO 40 > 15 e fora da janela temporária
    expect(estimarComissao(fechadoSemValor, regras, 1000, '2026-03-01').indefinida).toBe(true)
    expect(estimarComissao(aberto, regras, 1000, '2026-03-01', 12)).toEqual({ valor: 1000 * 0.012 * 0.125, indefinida: false })
  })

  it('consumo anual para a comissão = kWh do período × 365 ÷ dias faturados', () => {
    expect(consumoAnualTotal({ PONTA: 1000, CHEIA: 2000 }, 30)).toBeCloseTo((3000 * 365) / 30, 6)
    expect(consumoAnualTotal({ SIMPLES: 500 }, 0)).toBe(0)
  })
})

describe('Segmentação — BTN, BTE e MT nunca se misturam', () => {
  beforeAll(() => {
    // Variantes EZU GO têm datas — fixa "hoje" dentro do grupo Set/Out26 para o resultado não depender do dia.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it.each(['BTN', 'BTE', 'MT'] as const)('compararProdutos(%s) só devolve produtos desse segmento', (segmento) => {
    const input = baseInput({
      segmento,
      esquemaHorario: segmento === 'BTN' ? 'SIMPLES' : 'TETRA_HORARIO',
      consumoPeriodo: segmento === 'BTN' ? { SIMPLES: 100 } : { PONTA: 100, CHEIA: 100, VAZIO: 100, SUPER_VAZIO: 100 },
      custoAtualPeriodo: 50,
    })
    const r = compararProdutos(catalogQa, input)
    expect(r.length).toBeGreaterThan(0)
    for (const l of r) expect(l.product.segmento).toBe(segmento)
  })

  it('compararProdutos ignora produtos inativos', () => {
    const cat = { ...catalogQa, products: catalogQa.products.map((p) => (p.id === 'SnBteGo' ? { ...p, ativo: false } : p)) }
    const r = compararProdutos(cat, baseInput({ segmento: 'BTE', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { PONTA: 1 } }))
    expect(r.map((x) => x.product.id)).not.toContain('SnBteGo')
  })

  it('linhasPorVariante (Ver mais prazos/períodos) só gera linhas do próprio produto, 1 por variante do grupo ativo', () => {
    const linhas = linhasPorVariante(EzuMtGo, catalogQa, baseInput({ segmento: 'MT', esquemaHorario: 'TETRA_HORARIO', consumoPeriodo: { PONTA: 1 } }))
    // Em Out/2026 só o grupo Set/Out26 está ativo — a variante Jan27→Jun30 (outro grupo) nunca aparece.
    expect(linhas.map((l) => l.variantId)).toEqual([vSetOutJun27Mt.id])
    for (const l of linhas) expect(l.product.segmento).toBe('MT')
  })

  it('variantesComparaveis de prazo fixo: todas as durações, da mais curta para a mais longa', () => {
    expect(variantesComparaveis(catalogQa.variants, 'Flex')).toEqual([vFlex12.id, vFlex24.id])
  })
})
