import { describe, expect, it } from 'vitest'
import { diasInclusivos, extrairDadosFatura, MENSAGEM_GAS, normalizarTexto, parseNumero } from './invoiceExtraction'

const TEXTO = { origem: 'TEXTO' as const }
const codigos = (r: ReturnType<typeof extrairDadosFatura>) => r.avisos.map((a) => a.codigo)

/** Fatura de referência (EZU, BTN Tri-Horário) — texto tal como sai de um PDF com camada de texto. */
const FATURA_EZU = `
EZU Energia — Fatura de Eletricidade
Nível de Tensão: BTN
Código do Ponto de Entrega (CPE): PT 0002 0000 1234 5678 AB
Opção tarifária: Tri-Horário
Potência Contratada: 6,90 kVA
Período de Faturação: 01/08/2026 a 31/08/2026
Leitura real

Energia Ativa
Ponta 120 kWh 0,2150 €/kWh 25,80 €
Cheia 300 kWh 0,1780 €/kWh 53,40 €
Vazio 180 kWh 0,1020 €/kWh 18,36 €
TAR Ponta 120 kWh 0,0512 €/kWh 6,14 €
Potência 31 dias 0,3436 €/dia 10,65 €
Contribuição Audiovisual 2,85 €
IVA 23% 21,95 €
Total a pagar 120,15 €
`

describe('parseNumero — separadores decimais/milhares', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1234.56', 1234.56],
    ['1234,56', 1234.56],
    ['0,1234', 0.1234],
    ['1.234', 1234],
    ['12.500.000', 12500000],
    ['6,90', 6.9],
    ['8,5', 8.5],
  ])('%s → %d', (s, n) => expect(parseNumero(s)).toBe(n))
})

describe('normalizarTexto', () => {
  it('colapsa espaços/tabs e junta números partidos entre linhas, sem mexer em acentos', () => {
    expect(normalizarTexto('Potência   Contratada\t6,90 kVA')).toBe('Potência Contratada 6,90 kVA')
    expect(normalizarTexto('Preço 0,129\n1 €/kWh'.replace(' €/kWh', ''))).toBe('Preço 0,1291')
  })
})

describe('extrairDadosFatura — fatura EZU real (texto nativo)', () => {
  const r = extrairDadosFatura([FATURA_EZU], TEXTO)

  it('campos principais com confiança alta', () => {
    expect(r.estado).toBe('OK')
    expect(r.cpe).toMatchObject({ valor: 'PT0002000012345678AB', confianca: 'ALTA' })
    expect(r.potenciaKva).toMatchObject({ valor: 6.9, confianca: 'ALTA' })
    expect(r.esquema).toMatchObject({ valor: 'TRI_HORARIO', confianca: 'ALTA' })
    expect(r.segmento).toMatchObject({ valor: 'BTN', confianca: 'ALTA' })
    expect(r.consumoPeriodo.PONTA).toMatchObject({ valor: 120, confianca: 'ALTA' })
    expect(r.consumoPeriodo.CHEIA?.valor).toBe(300)
    expect(r.consumoPeriodo.VAZIO?.valor).toBe(180)
    expect(r.precoPeriodo.PONTA).toMatchObject({ valor: 0.215, confianca: 'ALTA' })
    expect(r.precoPeriodo.VAZIO?.valor).toBe(0.102)
    expect(r.diasFaturados).toMatchObject({ valor: 31, confianca: 'ALTA' })
    expect(r.leitura).toBe('REAL')
    expect(r.qualidadeBaixa).toBe(false)
  })

  it('TAR à parte: marcada como separada, com o valor guardado para referência — e a linha de TAR nunca entra na energia', () => {
    expect(r.tar).toMatchObject({ estado: 'SEPARADA', valores: [0.0512] })
    expect(r.consumoPeriodo.PONTA?.valor).toBe(120) // não 240 (a linha "TAR Ponta" não é somada)
  })

  it('ignora IVA, contribuição audiovisual e total a pagar — nunca aparecem como energia/preço', () => {
    expect(Object.keys(r.consumoPeriodo).sort()).toEqual(['CHEIA', 'PONTA', 'VAZIO'])
    expect(Object.values(r.precoPeriodo).every((p) => p!.valor < 1)).toBe(true)
  })
})

describe('extrairDadosFatura — exceções (secção 7)', () => {
  it('fatura de gás: recusada com a mensagem certa, sem preencher nada', () => {
    const r = extrairDadosFatura(
      ['Galp Gás Natural\nCUI PT1600000000123456AB\nEscalão de Gás 2\nConsumo 45 m³ × PCS 11,2 = 504 kWh\nTotal a pagar 60,10 €'],
      TEXTO,
    )
    expect(r.estado).toBe('RECUSADA')
    expect(r.motivoRecusa).toBe(MENSAGEM_GAS)
    expect(r.cpe).toBeUndefined()
    expect(r.consumoPeriodo).toEqual({})
    expect(r.potenciaKva).toBeUndefined()
  })

  it('2 CPEs: pede escolha antes de extrair o resto; depois da escolha, só olha para a secção desse CPE', () => {
    const texto = `Período de Faturação: 01/08/2026 a 31/08/2026
CPE: PT0002000011111111AA
Potência Contratada 6,90 kVA
Simples 250 kWh 0,1650 €/kWh
CPE: PT0002000022222222BB
Potência Contratada 13,80 kVA
Simples 900 kWh 0,1500 €/kWh`
    const r = extrairDadosFatura([texto], TEXTO)
    expect(r.estado).toBe('ESCOLHER_CPE')
    expect(r.cpesEncontrados).toEqual(['PT0002000011111111AA', 'PT0002000022222222BB'])
    expect(r.potenciaKva).toBeUndefined()

    const escolhido = extrairDadosFatura([texto], TEXTO, { cpeEscolhido: 'PT0002000022222222BB' })
    expect(escolhido.estado).toBe('OK')
    expect(escolhido.cpe?.valor).toBe('PT0002000022222222BB')
    expect(escolhido.potenciaKva?.valor).toBe(13.8)
    expect(escolhido.consumoPeriodo.SIMPLES?.valor).toBe(900)
    expect(escolhido.diasFaturados?.valor).toBe(31) // cabeçalho comum continua a contar
  })

  it('sem discriminação por período: preenche só o que existe (total informativo) e avisa', () => {
    const r = extrairDadosFatura(
      ['CPE PT0002000012345678AB\nPotência Contratada 6,90 kVA\nConsumo total do período 540 kWh\nEnergia 89,10 €'],
      TEXTO,
    )
    expect(r.consumoPeriodo).toEqual({})
    expect(r.precoPeriodo).toEqual({})
    expect(r.consumoTotal?.valor).toBe(540)
    expect(codigos(r)).toContain('SEM_PERIODOS')
    expect(r.avisos.find((a) => a.codigo === 'SEM_PERIODOS')?.mensagem).toBe('Fatura sem detalhe por período — preencha manualmente se necessário.')
  })

  it('fatura de acerto: aviso próprio, antes de preencher', () => {
    const r = extrairDadosFatura([`Fatura de Acerto\n${FATURA_EZU}`], TEXTO)
    expect(codigos(r)[0]).toBe('ACERTO')
    expect(r.consumoPeriodo.PONTA?.valor).toBe(120)
  })

  it('consumo estimado: preenche os valores, com aviso "não é leitura real"', () => {
    const r = extrairDadosFatura([FATURA_EZU.replace('Leitura real', 'Consumo Estimado (kWh)')], TEXTO)
    expect(r.leitura).toBe('ESTIMADA')
    expect(r.avisos.find((a) => a.codigo === 'CONSUMO_ESTIMADO')?.mensagem).toBe('Consumo estimado, não é leitura real.')
    expect(r.consumoPeriodo.CHEIA?.valor).toBe(300)
  })

  it('4 linhas de "Fora de Vazio" a preços diferentes: soma os consumos e usa o preço médio ponderado', () => {
    const r = extrairDadosFatura(
      [
        `CPE PT0002000012345678AB
Bi-Horário
Potência Contratada 10,35 kVA
Fora de Vazio 100 kWh 0,2000 €/kWh
Fora de Vazio 200 kWh 0,1800 €/kWh
Fora de Vazio 50 kWh 0,2200 €/kWh
Fora de Vazio 150 kWh 0,1900 €/kWh
Vazio 300 kWh 0,1000 €/kWh`,
      ],
      TEXTO,
    )
    expect(r.esquema?.valor).toBe('BI_HORARIO')
    expect(r.consumoPeriodo.FORA_VAZIO?.valor).toBe(500)
    // (100×0,20 + 200×0,18 + 50×0,22 + 150×0,19) ÷ 500 = 95,5 ÷ 500 = 0,191
    expect(r.precoPeriodo.FORA_VAZIO?.valor).toBeCloseTo(0.191, 6)
    // "Vazio" nunca apanha as linhas de "Fora de Vazio"
    expect(r.consumoPeriodo.VAZIO?.valor).toBe(300)
  })

  it('"Super Vazio" nunca é contado como "Vazio"', () => {
    const r = extrairDadosFatura(['Tetra-Horário\nVazio 400 kWh 0,1100 €/kWh\nSuper Vazio 250 kWh 0,0900 €/kWh'], TEXTO)
    expect(r.consumoPeriodo.VAZIO?.valor).toBe(400)
    expect(r.consumoPeriodo.SUPER_VAZIO?.valor).toBe(250)
    expect(r.esquema?.valor).toBe('TETRA_HORARIO')
  })

  it('período de menos de 30 dias: os dias vêm das datas reais (fim − início + 1)', () => {
    const r = extrairDadosFatura([FATURA_EZU.replace('01/08/2026 a 31/08/2026', '10/08/2026 a 03/09/2026')], TEXTO)
    expect(r.diasFaturados?.valor).toBe(25)
    expect(r.dataInicio).toBe('2026-08-10')
    expect(r.dataFim).toBe('2026-09-03')
  })

  it('sem datas: dias ficam por preencher (nunca assume 30) e avisa', () => {
    const r = extrairDadosFatura([FATURA_EZU.replace('Período de Faturação: 01/08/2026 a 31/08/2026', '')], TEXTO)
    expect(r.diasFaturados).toBeUndefined()
    expect(codigos(r)).toContain('DIAS_NAO_ENCONTRADOS')
  })

  it('números em formato 1.234,56 normalizados antes de preencher', () => {
    const r = extrairDadosFatura(['CPE PT0002000012345678AB\nPotência Contratada 41,40 kVA\nSimples 1.234,56 kWh 0,1650 €/kWh'], TEXTO)
    expect(r.consumoPeriodo.SIMPLES?.valor).toBe(1234.56)
  })

  it('foto de baixa qualidade (OCR < 70%): aviso geral de baixa confiança, mas mantém os campos com confiança alta', () => {
    const r = extrairDadosFatura([FATURA_EZU], { origem: 'OCR', confiancaOcr: 52 })
    expect(r.qualidadeBaixa).toBe(true)
    expect(codigos(r)[0]).toBe('QUALIDADE_BAIXA')
    expect(r.potenciaKva?.confianca).toBe('ALTA')
  })

  it('OCR com boa confiança não dispara o aviso geral', () => {
    expect(extrairDadosFatura([FATURA_EZU], { origem: 'OCR', confiancaOcr: 91 }).qualidadeBaixa).toBe(false)
  })

  it('menos de metade dos campos principais legíveis também dispara o aviso geral', () => {
    const r = extrairDadosFatura(['Fatura de eletricidade\nConsumo total 300 kWh'], TEXTO)
    expect(r.qualidadeBaixa).toBe(true)
  })

  it('sem CPE legível: campo em branco, sem inventar — e os restantes campos continuam a ser extraídos', () => {
    const r = extrairDadosFatura([FATURA_EZU.replace('PT 0002 0000 1234 5678 AB', 'ilegível')], TEXTO)
    expect(r.cpe).toBeUndefined()
    expect(r.cpeDuvidoso).toBeUndefined()
    expect(r.potenciaKva?.valor).toBe(6.9)
  })

  it('CPE com erro de OCR (quase bate): mostrado tal como veio, confiança baixa, nunca corrigido nem preenchido', () => {
    const r = extrairDadosFatura([FATURA_EZU.replace('PT 0002 0000 1234 5678 AB', 'PT00020000I2345678AB')], TEXTO)
    expect(r.cpe).toBeUndefined()
    expect(r.cpeDuvidoso).toBe('PT00020000I2345678AB')
    expect(codigos(r)).toContain('CPE_ILEGIVEL')
  })

  it('potência fora dos 13 escalões (8,5 kVA): aceite sem arredondar', () => {
    const r = extrairDadosFatura([FATURA_EZU.replace('6,90 kVA', '8,5 kVA')], TEXTO)
    expect(r.potenciaKva?.valor).toBe(8.5)
  })

  it('TAR provavelmente incluída: nunca confiança alta, sempre a confirmar', () => {
    const r = extrairDadosFatura(['CPE PT0002000012345678AB\nSimples 250 kWh 0,2100 €/kWh\nPreço com todos os encargos'], TEXTO)
    expect(r.tar).toEqual({ estado: 'PROVAVELMENTE_INCLUIDA', confianca: 'MEDIA' })
  })

  it('troca de comercializadora a meio do período: avisa', () => {
    const r = extrairDadosFatura(
      [
        `CPE PT0002000012345678AB
Galp — Período de Faturação: 01/08/2026 a 14/08/2026
Simples 100 kWh 0,1900 €/kWh
Goldenergy — Período de Faturação: 15/08/2026 a 31/08/2026
Simples 120 kWh 0,1700 €/kWh`,
      ],
      TEXTO,
    )
    expect(codigos(r)).toContain('TROCA_COMERCIALIZADORA')
  })

  it('fatura noutro idioma: não adivinha por posição, avisa para preencher manualmente', () => {
    const r = extrairDadosFatura(['Electricity bill\nMeter PT0002000012345678AB\nUsage 300 units\nAmount due 55.00'], TEXTO)
    expect(codigos(r)).toContain('VOCABULARIO_DESCONHECIDO')
    expect(r.consumoPeriodo).toEqual({})
    expect(r.potenciaKva).toBeUndefined()
  })

  it('multi-página: em conflito, os valores das 2 primeiras páginas (o resumo) ganham ao detalhe', () => {
    const r = extrairDadosFatura(
      [
        'CPE PT0002000012345678AB\nPotência Contratada 6,90 kVA',
        'Simples 250 kWh 0,1650 €/kWh',
        'Detalhe\nSimples 125 kWh 0,1650 €/kWh\nSimples 125 kWh 0,1650 €/kWh',
      ],
      TEXTO,
    )
    expect(r.consumoPeriodo.SIMPLES?.valor).toBe(250) // não 500 (resumo + detalhe)
  })

  it('segmento: sigla junto de "Nível de Tensão" ganha a uma sigla solta noutro sítio (ex: nome comercial)', () => {
    const r = extrairDadosFatura(['MT Energia, Lda.\nNível de Tensão: BTE\nPotência Contratada 60 kW'], TEXTO)
    expect(r.segmento).toMatchObject({ valor: 'BTE', confianca: 'ALTA' })
  })
})

describe('diasInclusivos', () => {
  it('conta início e fim', () => {
    expect(diasInclusivos('2026-08-01', '2026-08-31')).toBe(31)
    expect(diasInclusivos('2026-02-01', '2026-02-28')).toBe(28)
  })
})
