import { describe, expect, it } from 'vitest'
import {
  temErros,
  validarConsumoAnual,
  validarConsumoForaDoNormal,
  validarConsumoPeriodo,
  validarContacto,
  validarCPE,
  validarDiasFaturados,
  validarEmail,
  validarGo,
  validarMargem,
  validarNaoNegativo,
  validarNIF,
  validarNome,
  validarPotencia,
  validarPrecoKwh,
} from './validators'

describe('validarNIF', () => {
  it('aceita NIFs com dígito de controlo correto (singular, empresa, com espaços e prefixo PT)', () => {
    expect(validarNIF('123456789').status).toBe('valid')
    expect(validarNIF('501964843').status).toBe('valid')
    expect(validarNIF('PT 501 964 843').status).toBe('valid')
  })

  it('rejeita dígito de controlo errado', () => {
    const r = validarNIF('123456780')
    expect(r.status).toBe('error')
    expect(r.message).toMatch(/controlo/)
  })

  it('rejeita comprimento errado, letras e prefixos inválidos', () => {
    expect(validarNIF('12345678').message).toMatch(/9 dígitos/)
    expect(validarNIF('12345678A').status).toBe('error')
    expect(validarNIF('412345678').message).toMatch(/Prefixo/)
  })

  it('vazio: sem feedback, ou erro se obrigatório', () => {
    expect(validarNIF('')).toEqual({})
    expect(validarNIF(null)).toEqual({})
    expect(validarNIF('  ', { obrigatorio: true }).status).toBe('error')
  })
})

describe('validarPotencia', () => {
  it('erro para vazio, zero ou negativo', () => {
    expect(validarPotencia(null).status).toBe('error')
    expect(validarPotencia(Number.NaN).status).toBe('error')
    expect(validarPotencia(0, 'BTN').status).toBe('error')
    expect(validarPotencia(-3, 'BTE').status).toBe('error')
  })

  it('BTN: válida até 41,4 kVA, erro acima, aviso abaixo de 1,15', () => {
    expect(validarPotencia(6.9, 'BTN').status).toBe('valid')
    expect(validarPotencia(41.4, 'BTN').status).toBe('valid')
    expect(validarPotencia(41.5, 'BTN').status).toBe('error')
    expect(validarPotencia(1, 'BTN').status).toBe('warning')
  })

  it('BTE/MT: aviso quando a potência é típica de BTN', () => {
    expect(validarPotencia(6.9, 'BTE').status).toBe('warning')
    expect(validarPotencia(20, 'MT').status).toBe('warning')
    expect(validarPotencia(100, 'BTE').status).toBe('valid')
    expect(validarPotencia(500, 'MT').status).toBe('valid')
  })

  it('sem segmento só verifica que é positiva', () => {
    expect(validarPotencia(100).status).toBe('valid')
  })
})

describe('validarConsumoForaDoNormal', () => {
  it('sem aviso para consumos normais ou dados incompletos', () => {
    expect(validarConsumoForaDoNormal({ consumoTotalKwh: 300, diasFaturados: 30, segmento: 'BTN', potenciaKva: 6.9 })).toEqual({})
    expect(validarConsumoForaDoNormal({ consumoTotalKwh: 0, diasFaturados: 30, segmento: 'BTN' })).toEqual({})
    expect(validarConsumoForaDoNormal({ consumoTotalKwh: 300, diasFaturados: 30, segmento: null })).toEqual({})
  })

  it('aviso acima de 3× o consumo diário típico do segmento', () => {
    // BTN: típico 30 kWh/dia → aviso acima de 90 kWh/dia (sem potência para não disparar a outra regra)
    expect(validarConsumoForaDoNormal({ consumoTotalKwh: 90 * 30, diasFaturados: 30, segmento: 'BTN' })).toEqual({})
    expect(validarConsumoForaDoNormal({ consumoTotalKwh: 91 * 30, diasFaturados: 30, segmento: 'BTN' }).status).toBe('warning')
    // O mesmo consumo é normal em BTE
    expect(validarConsumoForaDoNormal({ consumoTotalKwh: 91 * 30, diasFaturados: 30, segmento: 'BTE' })).toEqual({})
  })

  it('aviso quando excede o fisicamente possível com a potência contratada', () => {
    // 6,9 kVA × 24h = 165,6 kWh/dia; 200 kWh/dia em BTE (abaixo do limiar do segmento) ainda avisa
    const r = validarConsumoForaDoNormal({ consumoTotalKwh: 200 * 30, diasFaturados: 30, segmento: 'BTE', potenciaKva: 6.9 })
    expect(r.status).toBe('warning')
    expect(r.message).toMatch(/6.9 kVA/)
  })

  it('nunca devolve erro (não bloqueia)', () => {
    const r = validarConsumoForaDoNormal({ consumoTotalKwh: 1e9, diasFaturados: 1, segmento: 'MT', potenciaKva: 1 })
    expect(r.status).toBe('warning')
  })
})

describe('validarCPE', () => {
  it('aceita PT + 16 dígitos + 2 letras, com espaços/minúsculas e sufixo opcional', () => {
    expect(validarCPE('PT0002000012345678AB').status).toBe('valid')
    expect(validarCPE('pt 0002 0000 1234 5678 ab').status).toBe('valid')
    expect(validarCPE('PT0002000012345678AB1P').status).toBe('valid')
  })

  it('rejeita sem prefixo PT, comprimento errado ou formato errado', () => {
    expect(validarCPE('ES0002000012345678AB').message).toMatch(/PT/)
    expect(validarCPE('PT0002').message).toMatch(/20 caracteres/)
    expect(validarCPE('PT00020000123456AB78').status).toBe('error')
  })

  it('vazio: sem feedback, ou erro se obrigatório', () => {
    expect(validarCPE('')).toEqual({})
    expect(validarCPE('', { obrigatorio: true }).status).toBe('error')
  })
})

describe('validarNome / validarEmail / validarContacto', () => {
  it('nome obrigatório com pelo menos 2 caracteres', () => {
    expect(validarNome('').status).toBe('error')
    expect(validarNome('A').status).toBe('error')
    expect(validarNome('Acme, Lda').status).toBe('valid')
    expect(validarNome('', { obrigatorio: false })).toEqual({})
  })

  it('email', () => {
    expect(validarEmail('a@b.pt').status).toBe('valid')
    expect(validarEmail('a@b').status).toBe('error')
    expect(validarEmail('')).toEqual({})
  })

  it('contacto aceita email ou telefone; formato desconhecido é só aviso', () => {
    expect(validarContacto('geral@acme.pt').status).toBe('valid')
    expect(validarContacto('geral@acme').status).toBe('error')
    expect(validarContacto('912 345 678').status).toBe('valid')
    expect(validarContacto('+351 212 345 678').status).toBe('valid')
    expect(validarContacto('+34 612 345 678').status).toBe('valid')
    expect(validarContacto('Sr. João').status).toBe('warning')
  })
})

describe('consumos, dias e catálogo', () => {
  it('validarConsumoPeriodo', () => {
    expect(validarConsumoPeriodo(0)).toEqual({})
    expect(validarConsumoPeriodo(120).status).toBe('valid')
    expect(validarConsumoPeriodo(-1).status).toBe('error')
  })

  it('validarConsumoAnual', () => {
    expect(validarConsumoAnual(null)).toEqual({})
    expect(validarConsumoAnual(-5).status).toBe('error')
    expect(validarConsumoAnual(5000, 6.9).status).toBe('valid')
    expect(validarConsumoAnual(6.9 * 24 * 365 + 1, 6.9).status).toBe('warning')
  })

  it('validarDiasFaturados', () => {
    expect(validarDiasFaturados(0).status).toBe('error')
    expect(validarDiasFaturados(1.5).status).toBe('error')
    expect(validarDiasFaturados(30).status).toBe('valid')
    expect(validarDiasFaturados(90).status).toBe('warning')
  })

  it('validarPrecoKwh / validarGo / validarMargem / validarNaoNegativo (aceitam texto de input)', () => {
    expect(validarPrecoKwh('')).toEqual({})
    expect(validarPrecoKwh('0.15').status).toBe('valid')
    expect(validarPrecoKwh('0,15').status).toBe('valid')
    expect(validarPrecoKwh('0').status).toBe('error')
    expect(validarPrecoKwh('150').status).toBe('warning')
    // GO não tem "valor normal" — o consultor pode pôr o que quiser, sem restrição de intervalo.
    expect(validarGo('')).toEqual({})
    expect(validarGo('-1').status).toBe('valid')
    expect(validarGo('2.5').status).toBe('valid')
    expect(validarGo('50').status).toBe('valid')
    expect(validarGo('abc').status).toBe('error')
    expect(validarMargem('0.01').status).toBe('valid')
    expect(validarMargem('5').status).toBe('warning')
    expect(validarNaoNegativo('-1').status).toBe('error')
    expect(validarNaoNegativo('1.5', { inteiro: true }).status).toBe('error')
    expect(validarNaoNegativo('abc').status).toBe('error')
  })

  it('temErros ignora avisos', () => {
    expect(temErros({ status: 'warning' }, { status: 'valid' }, {})).toBe(false)
    expect(temErros({ status: 'warning' }, { status: 'error', message: 'x' })).toBe(true)
  })
})
