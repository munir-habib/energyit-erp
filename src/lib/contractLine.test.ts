import { describe, expect, it } from 'vitest'
import { goDaLinhaDoContrato, linhaCongeladaParaContrato, precosCongeladosDaSimulacao } from './contractLine'
import { calcularComissao } from './pricingEngine'
import { linha, product, regraComissao, simulacao } from '../test/fixtures'

// EZU BTE GO com 2 variantes (Jun27 / Jun28) na mesma simulação — cada linha com os seus preços e o seu GO.
// A escolhida (✓) é a SEGUNDA linha do mesmo produto: procurar só por product_id apanharia a primeira.
const jun27 = linha({
  product_id: 'EzuBteGo',
  produto_nome: 'BTE GO',
  tipo: 'ABERTO_FIXO',
  variant_id: 'v-jun27',
  variant_label: 'Set/Out26 → Jun27',
  precos_periodo: { PONTA: 0.1557 },
  custo_energia_periodo: 900,
  poupanca_eur_ano: 1000,
  poupanca_pct: 10,
  go_override: 10,
  go_fixado: false,
  candidata: true,
  escolhida: false,
})
const jun28 = linha({
  product_id: 'EzuBteGo',
  produto_nome: 'BTE GO',
  tipo: 'ABERTO_FIXO',
  variant_id: 'v-jun28',
  variant_label: 'Set/Out26 → Jun28',
  precos_periodo: { PONTA: 0.1463 },
  custo_energia_periodo: 850,
  poupanca_eur_ano: 1600,
  poupanca_pct: 16,
  go_override: 15,
  go_fixado: true,
  candidata: true,
  escolhida: true,
})
const sim = simulacao({
  id: 'sim-1',
  segmento: 'BTE',
  esquema_horario: 'TETRA_HORARIO',
  consumo_periodo: { PONTA: 1000 },
  dias_faturados: 31,
  produto_escolhido_id: 'EzuBteGo',
  resultados: [jun27, jun28],
})

describe('Contrato — preços congelados vêm da linha exata escolhida (Produto + Variante)', () => {
  it('escolhe a variante marcada ✓, nunca a primeira linha do mesmo produto', () => {
    expect(linhaCongeladaParaContrato(sim)?.variant_id).toBe('v-jun28')
    const c = precosCongeladosDaSimulacao(sim)!
    expect(c.productId).toBe('EzuBteGo')
    expect(c.precos).toEqual({
      produto_nome: 'BTE GO',
      precos_periodo: { PONTA: 0.1463 },
      custo_energia_periodo: 850,
      poupanca_eur_ano: 1600,
      poupanca_pct: 16,
      consumo_periodo: { PONTA: 1000 },
      dias_faturados: 31,
      tipo: 'ABERTO_FIXO',
      variant_id: 'v-jun28',
      variant_label: 'Set/Out26 → Jun28',
      go_override: 15,
      go_fixado: true,
    })
  })

  it('sem linha escolhida não há contrato', () => {
    const semEscolha = { ...sim, produto_escolhido_id: null, resultados: sim.resultados.map((l) => ({ ...l, escolhida: false })) }
    expect(precosCongeladosDaSimulacao(semEscolha)).toBeNull()
  })

  it('Fechado congela sem GO', () => {
    const z = linha({ product_id: 'Z', produto_nome: 'Z', tipo: 'FECHADO', go_override: 99, escolhida: true })
    const c = precosCongeladosDaSimulacao(simulacao({ id: 's', segmento: 'BTN', resultados: [z] }))!
    expect(c.precos.go_override).toBeNull()
  })
})

describe('Contrato — comissão usa o GO negociado na linha escolhida, nunca o GO do catálogo', () => {
  // GO por omissão do produto no catálogo = 10; a linha escolhida foi negociada a 15.
  const EzuBteGo = product({ id: 'EzuBteGo', segmento: 'BTE', nome: 'BTE GO', tipo: 'ABERTO_FIXO', go_valor: 10 })
  const regras = [regraComissao({ id: 'r1', multiplicador: 1, valido_desde: '2026-01-01' })]
  const contrato = { product_id: 'EzuBteGo', precos_congelados: precosCongeladosDaSimulacao(sim)!.precos }

  it('contrato novo: GO congelado da linha (15) → comissão = 100 000 kWh × 15/1000 × 1 = 1500 €', () => {
    const go = goDaLinhaDoContrato(contrato)
    expect(go).toBe(15)
    const calc = calcularComissao(EzuBteGo, regras, 100_000, '2026-09-23', go ?? undefined)
    expect(calc.goAplicado).toBe(15)
    expect(calc.valor).toBeCloseTo(1500, 6)
  })

  it('contrato antigo (sem GO congelado): usa o GO da linha da simulação de origem com os mesmos preços (variante exata)', () => {
    const { tipo: _t, variant_id: _v, variant_label: _l, go_override: _g, go_fixado: _f, ...antigo } = contrato.precos_congelados
    expect(goDaLinhaDoContrato({ product_id: 'EzuBteGo', precos_congelados: antigo }, sim)).toBe(15)
    // Preços congelados da outra variante → GO dessa outra linha, nunca o do produto/catálogo.
    const antigoJun27 = { ...antigo, precos_periodo: { PONTA: 0.1557 } }
    expect(goDaLinhaDoContrato({ product_id: 'EzuBteGo', precos_congelados: antigoJun27 }, sim)).toBe(10)
  })

  it('GO desconhecido (contrato antigo sem simulação, ou linha sem GO) → null, nunca o GO do catálogo', () => {
    const { go_override: _g, ...antigo } = contrato.precos_congelados
    expect(goDaLinhaDoContrato({ product_id: 'EzuBteGo', precos_congelados: antigo }, null)).toBeNull()
    expect(goDaLinhaDoContrato({ product_id: 'EzuBteGo', precos_congelados: { ...contrato.precos_congelados, go_override: null } })).toBeNull()
  })
})
