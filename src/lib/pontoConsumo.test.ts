import { describe, expect, it } from 'vitest'
import { diasAteRenovacao, nivelRenovacao } from './pontoConsumo'

describe('Alertas de renovação — níveis 60 / 30 / 7 dias (DiasRenovacaoBadge)', () => {
  it.each([
    [61, null],
    [60, 'aviso'],
    [59, 'aviso'],
    [31, 'aviso'],
    [30, 'urgente'],
    [29, 'urgente'],
    [8, 'urgente'],
    [7, 'critico'],
    [6, 'critico'],
    [0, 'critico'],
    [-3, 'critico'],
  ] as const)('%i dias → %s', (dias, nivel) => {
    expect(nivelRenovacao(dias)).toBe(nivel)
  })

  it('sem data de renovação → sem nível', () => {
    expect(nivelRenovacao(null)).toBeNull()
  })
})

describe('diasAteRenovacao', () => {
  const hoje = new Date(2026, 8, 23, 15, 30) // 23/09/2026 a meio da tarde, hora local

  it('conta dias de calendário a partir de hoje (a hora do dia não conta)', () => {
    expect(diasAteRenovacao({ data_fim_contrato: '2026-11-22' }, hoje)).toBe(60)
    expect(diasAteRenovacao({ data_fim_contrato: '2026-11-23' }, hoje)).toBe(61)
    expect(diasAteRenovacao({ data_fim_contrato: '2026-10-23' }, hoje)).toBe(30)
    expect(diasAteRenovacao({ data_fim_contrato: '2026-09-30' }, hoje)).toBe(7)
    expect(diasAteRenovacao({ data_fim_contrato: '2026-09-23' }, hoje)).toBe(0)
    expect(diasAteRenovacao({ data_fim_contrato: '2026-09-20' }, hoje)).toBe(-3)
  })

  it('sem data de fim → null', () => {
    expect(diasAteRenovacao({ data_fim_contrato: null }, hoje)).toBeNull()
  })
})
