import { describe, expect, it } from 'vitest'
import { extrairDadosFatura } from './invoiceExtraction'
import { planoDePreenchimento } from './invoiceToForm'

const FATURA = `Nível de Tensão: BTN
CPE: PT0002000012345678AB
Bi-Horário
Potência Contratada: 6,90 kVA
Período de Faturação: 01/08/2026 a 31/08/2026
Fora de Vazio 300 kWh 0,1900 €/kWh
Vazio 200 kWh 0,1000 €/kWh
TAR Fora de Vazio 0,0600 €/kWh`

const ler = (texto = FATURA) => extrairDadosFatura([texto], { origem: 'TEXTO' })
const ponto = { id: 'p1', cpe: 'PT0002000012345678AB', client_id: 'c1', cliente: 'Padaria Lda' }
const ctx = { segmento: 'BTN' as const, emEdicao: false, clientIdAtual: '', cpeAtual: null, pontosConsumo: [ponto] }

describe('planoDePreenchimento', () => {
  it('preenche esquema, potência, dias, consumo/preço por período e TAR — cada campo com a sua confiança', () => {
    const p = planoDePreenchimento(ler(), ctx)
    expect(p.esquemaBtn).toBe('BI_HORARIO')
    expect(p.potencia).toBe(6.9)
    expect(p.dias).toBe(31)
    expect(p.consumoPeriodo).toEqual({ FORA_VAZIO: 300, VAZIO: 200 })
    expect(p.precoAtualPeriodos).toEqual({ FORA_VAZIO: 0.19, VAZIO: 0.1 })
    expect(p.incluiTarAtual).toBe(false)
    expect(p.campos.map((c) => c.campo).sort()).toEqual(
      ['consumo:FORA_VAZIO', 'consumo:VAZIO', 'cpe', 'dias', 'esquema', 'potencia', 'preco:FORA_VAZIO', 'preco:VAZIO', 'tar'].sort(),
    )
    expect(p.campos.every((c) => c.confianca === 'ALTA')).toBe(true)
  })

  it('CPE já existente e sem cliente escolhido → seleciona essa CPE e o cliente dela', () => {
    expect(planoDePreenchimento(ler(), ctx).cpe).toEqual({ acao: 'SELECIONAR', pontoConsumoId: 'p1', clientId: 'c1' })
  })

  it('CPE de outro cliente → nunca troca de cliente sozinho, só avisa', () => {
    const p = planoDePreenchimento(ler(), { ...ctx, clientIdAtual: 'c2' })
    expect(p.cpe).toEqual({ acao: 'NENHUMA' })
    expect(p.notas.join(' ')).toContain('pertence a outro cliente (Padaria Lda)')
  })

  it('CPE nova com cliente escolhido → prepara a criação da CPE com o código lido', () => {
    const p = planoDePreenchimento(ler(), { ...ctx, clientIdAtual: 'c9', pontosConsumo: [] })
    expect(p.cpe).toEqual({ acao: 'CRIAR', codigo: 'PT0002000012345678AB' })
  })

  it('a editar: cliente/CPE fixos, a fatura nunca os altera', () => {
    const p = planoDePreenchimento(ler(), { ...ctx, emEdicao: true, cpeAtual: 'PT0002000099999999ZZ' })
    expect(p.cpe).toEqual({ acao: 'NENHUMA' })
    expect(p.campos.some((c) => c.campo === 'cpe')).toBe(false)
    expect(p.notas.join(' ')).toContain('diferente da CPE desta simulação')
  })

  it('segmento lido diferente do escolhido → só sinaliza, nunca muda a segmentação sozinho', () => {
    const p = planoDePreenchimento(ler(FATURA.replace('BTN', 'BTE')), ctx)
    expect(p.segmentoDiferente).toBe('BTE')
  })

  it('BTE/MT usam sempre os 4 períodos: períodos da fatura fora desse esquema não entram, e há nota', () => {
    const p = planoDePreenchimento(ler(), { ...ctx, segmento: 'BTE' })
    expect(p.esquemaBtn).toBeUndefined()
    expect(p.consumoPeriodo).toEqual({ VAZIO: 200 })
    expect(p.notas.join(' ')).toContain('Fora de Vazio, que não existe no esquema escolhido')
  })

  it('sem datas na fatura → dias não são tocados (nunca assume 30)', () => {
    const p = planoDePreenchimento(ler(FATURA.replace('Período de Faturação: 01/08/2026 a 31/08/2026', '')), ctx)
    expect(p.dias).toBeUndefined()
    expect(p.campos.some((c) => c.campo === 'dias')).toBe(false)
  })

  it('CPE duvidoso (erro de OCR) → nota, nunca preenchido', () => {
    const p = planoDePreenchimento(ler(FATURA.replace('PT0002000012345678AB', 'PT00020000I2345678AB')), ctx)
    expect(p.cpe).toEqual({ acao: 'NENHUMA' })
    expect(p.notas.join(' ')).toContain('PT00020000I2345678AB')
  })
})
