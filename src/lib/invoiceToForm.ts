/**
 * Traduz o resultado da leitura da fatura (invoiceExtraction.ts) num plano de preenchimento do
 * formulário de simulação — função pura, sem tocar em estado React. A página aplica o plano e marca
 * cada campo preenchido com a sua confiança até o consultor o rever (SimulationNewPage.tsx).
 *
 * Só entram no formulário campos com confiança ALTA ou MÉDIA; BAIXA (ex: CPE com erro de OCR) fica
 * como nota para o consultor, nunca como valor preenchido.
 */
import { periodoLabel, periodosDoEsquema } from './pricingEngine'
import type { Confianca, ResultadoExtracao } from './invoiceExtraction'
import type { ConsumoPeriodos, EsquemaHorario, Periodo, PontoConsumo, PrecoPeriodos, Segmento } from '@/types/database'

export type CampoFatura = 'cpe' | 'potencia' | 'esquema' | 'dias' | 'tar' | `consumo:${Periodo}` | `preco:${Periodo}`

export interface CampoPreenchido {
  campo: CampoFatura
  rotulo: string
  valorTexto: string
  confianca: Exclude<Confianca, 'BAIXA'>
}

export type AcaoCpe =
  | { acao: 'SELECIONAR'; pontoConsumoId: string; clientId: string | null }
  | { acao: 'CRIAR'; codigo: string }
  | { acao: 'NENHUMA' }

export interface PlanoPreenchimento {
  esquemaBtn?: EsquemaHorario
  potencia?: number
  dias?: number
  consumoPeriodo?: ConsumoPeriodos
  precoAtualPeriodos?: PrecoPeriodos
  incluiTarAtual?: boolean
  cpe: AcaoCpe
  /** Segmento lido na fatura quando é diferente do escolhido — nunca muda sozinho (a página oferece "Mudar"). */
  segmentoDiferente?: Segmento
  campos: CampoPreenchido[]
  /** Informação para o consultor que não corresponde a um campo preenchido. */
  notas: string[]
}

const ESQUEMA_LABEL: Record<EsquemaHorario, string> = {
  SIMPLES: 'Simples',
  BI_HORARIO: 'Bi-Horário',
  TRI_HORARIO: 'Tri-Horário',
  TETRA_HORARIO: 'Tetra-Horário',
}

const num = (n: number, casas = 2) => n.toLocaleString('pt-PT', { maximumFractionDigits: casas })
const normalizarCpe = (c: string) => c.replace(/\s/g, '').toUpperCase()

export function planoDePreenchimento(
  r: ResultadoExtracao,
  ctx: {
    segmento: Segmento
    /** A editar uma simulação existente: cliente/CPE fixos, nunca alterados pela fatura. */
    emEdicao: boolean
    clientIdAtual: string
    cpeAtual: string | null
    pontosConsumo: Pick<PontoConsumo, 'id' | 'cpe' | 'client_id' | 'cliente'>[]
  },
): PlanoPreenchimento {
  const campos: CampoPreenchido[] = []
  const notas: string[] = []
  const plano: PlanoPreenchimento = { cpe: { acao: 'NENHUMA' }, campos, notas }
  type Util<T> = { valor: T; confianca: Exclude<Confianca, 'BAIXA'> }
  const confiavel = <T,>(c?: { valor: T; confianca: Confianca }): Util<T> | undefined =>
    c && c.confianca !== 'BAIXA' ? { valor: c.valor, confianca: c.confianca } : undefined

  // --- Segmento: só informa quando difere (a segmentação BTN/BTE/MT nunca muda sozinha).
  const seg = confiavel(r.segmento)
  if (seg && seg.valor !== ctx.segmento) plano.segmentoDiferente = seg.valor

  // --- CPE
  const cpe = confiavel(r.cpe)
  if (cpe) {
    const codigo = normalizarCpe(cpe.valor)
    const ponto = ctx.pontosConsumo.find((p) => normalizarCpe(p.cpe) === codigo)
    if (ctx.emEdicao) {
      if (ctx.cpeAtual && normalizarCpe(ctx.cpeAtual) !== codigo) {
        notas.push(`A fatura é da CPE ${codigo}, diferente da CPE desta simulação (${ctx.cpeAtual}) — confirme que é a fatura certa.`)
      }
    } else if (ponto && (!ctx.clientIdAtual || ponto.client_id === ctx.clientIdAtual)) {
      plano.cpe = { acao: 'SELECIONAR', pontoConsumoId: ponto.id, clientId: ponto.client_id }
      campos.push({ campo: 'cpe', rotulo: 'CPE', valorTexto: codigo, confianca: cpe.confianca })
    } else if (ponto) {
      notas.push(`A CPE ${codigo} da fatura pertence a outro cliente (${ponto.cliente}) — confirme o cliente escolhido.`)
    } else if (ctx.clientIdAtual) {
      plano.cpe = { acao: 'CRIAR', codigo }
      campos.push({ campo: 'cpe', rotulo: 'CPE (nova)', valorTexto: codigo, confianca: cpe.confianca })
    } else {
      notas.push(`CPE da fatura: ${codigo} — escolha ou crie o cliente para a associar.`)
    }
  } else if (r.cpeDuvidoso) {
    notas.push(`Possível CPE com leitura duvidosa: "${r.cpeDuvidoso}" — não foi preenchido, escreva-o manualmente.`)
  }

  // --- Esquema horário (só BTN escolhe; BTE/MT são sempre os 4 períodos)
  let esquema: EsquemaHorario = ctx.segmento === 'BTN' ? 'TRI_HORARIO' : 'TETRA_HORARIO'
  const esq = confiavel(r.esquema)
  if (ctx.segmento === 'BTN' && esq) {
    if (esq.valor === 'TETRA_HORARIO') {
      notas.push('A fatura indica Tetra-Horário, que não existe em BTN — confirme o segmento e o esquema.')
    } else {
      esquema = esq.valor
      plano.esquemaBtn = esq.valor
      campos.push({ campo: 'esquema', rotulo: 'Esquema horário', valorTexto: ESQUEMA_LABEL[esq.valor], confianca: esq.confianca })
    }
  }

  // --- Potência
  const pot = confiavel(r.potenciaKva)
  if (pot) {
    plano.potencia = pot.valor
    campos.push({ campo: 'potencia', rotulo: 'Potência contratada', valorTexto: `${num(pot.valor)} kVA`, confianca: pot.confianca })
  }

  // --- Dias faturados (nunca assumidos: sem datas, o campo não é tocado)
  const dias = confiavel(r.diasFaturados)
  if (dias) {
    plano.dias = dias.valor
    const periodo = r.dataInicio && r.dataFim ? ` (${r.dataInicio.split('-').reverse().join('/')} a ${r.dataFim.split('-').reverse().join('/')})` : ''
    campos.push({ campo: 'dias', rotulo: 'Dias faturados', valorTexto: `${dias.valor}${periodo}`, confianca: dias.confianca })
  }

  // --- Consumo e preço por período — só os períodos que existem no esquema em uso
  const periodos = new Set(periodosDoEsquema(esquema))
  const consumo: ConsumoPeriodos = {}
  const preco: PrecoPeriodos = {}
  const foraDoEsquema: Periodo[] = []
  for (const [p, c] of Object.entries(r.consumoPeriodo) as [Periodo, NonNullable<ResultadoExtracao['consumoPeriodo'][Periodo]>][]) {
    if (!periodos.has(p)) {
      foraDoEsquema.push(p)
      continue
    }
    if (c.confianca === 'BAIXA') continue
    consumo[p] = c.valor
    campos.push({ campo: `consumo:${p}`, rotulo: `Consumo ${periodoLabel(p)}`, valorTexto: `${num(c.valor, 3)} kWh`, confianca: c.confianca })
  }
  for (const [p, c] of Object.entries(r.precoPeriodo) as [Periodo, NonNullable<ResultadoExtracao['precoPeriodo'][Periodo]>][]) {
    if (!periodos.has(p) || c.confianca === 'BAIXA') continue
    preco[p] = c.valor
    campos.push({ campo: `preco:${p}`, rotulo: `Preço ${periodoLabel(p)}`, valorTexto: `${num(c.valor, 6)} €/kWh`, confianca: c.confianca })
  }
  if (Object.keys(consumo).length) plano.consumoPeriodo = consumo
  if (Object.keys(preco).length) plano.precoAtualPeriodos = preco
  if (foraDoEsquema.length) {
    notas.push(
      `A fatura tem consumo em ${foraDoEsquema.map(periodoLabel).join(', ')}, que não existe no esquema escolhido — confirme o esquema horário.`,
    )
  }
  if (r.consumoTotal) notas.push(`Consumo total lido na fatura: ${num(r.consumoTotal.valor, 3)} kWh (sem detalhe por período).`)

  // --- TAR
  if (r.tar.estado === 'SEPARADA') {
    plano.incluiTarAtual = false
    campos.push({
      campo: 'tar',
      rotulo: 'TAR',
      valorTexto: `não incluída no preço — TAR à parte na fatura: ${r.tar.valores.map((v) => num(v, 6)).join(' / ')}`,
      confianca: r.tar.confianca === 'BAIXA' ? 'MEDIA' : r.tar.confianca,
    })
  } else if (r.tar.estado === 'PROVAVELMENTE_INCLUIDA') {
    plano.incluiTarAtual = true
    campos.push({ campo: 'tar', rotulo: 'TAR', valorTexto: 'provavelmente incluída no preço — confirmar', confianca: 'MEDIA' })
  }

  return plano
}
