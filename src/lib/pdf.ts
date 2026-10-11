import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatEur, formatEurPerKwh, formatGo, formatKwh, formatPct } from '@/lib/format'
import { carregarLogo, LOGO_NOME, type LogoData } from '@/lib/logo'
import { ORDEM_PERIODOS, periodoLabel, tarEnergiaOficial } from '@/lib/pricingEngine'
import { linhaEscolhidaDaSimulacao, linhasCandidatasDaSimulacao } from '@/lib/simulationLines'
import type { Client, Periodo, PontoConsumo, Simulation, SimulationResultLine, TarEnergiaBteMt, TarEnergiaBtn } from '@/types/database'

/** As 2 tabelas TAR oficiais/transversais (mesmas do motor de cálculo) — só o suficiente para ajustar o "Preço Atual" por período na tabela "Consumo e preços por período" (ver desenharConsumoPrecosPeriodo) e não é recalculado nada além disso. */
export interface TarTables {
  tarEnergiaBtn: TarEnergiaBtn[]
  tarEnergiaBteMt: TarEnergiaBteMt[]
}

function precoMedioLinha(l: SimulationResultLine, comTar = true): number | null {
  if (l.preco_medio_ponderado) return comTar ? l.preco_medio_ponderado.comTar : l.preco_medio_ponderado.semTar
  const valores = Object.values(l.precos_periodo) as number[]
  return valores[0] ?? null
}

/**
 * Períodos com preço calculado nesta linha, na ordem canónica do ecrã — adapta-se sozinho ao esquema
 * de cada produto (Simples: 1, Bi-Horário: 2, Tri-Horário: 3, Tetra-Horário/BTE-MT: 4), sem precisar
 * de saber o esquema de antemão: usa exatamente o que o motor já calculou em precos_periodo.
 */
function periodosDaLinha(l: SimulationResultLine): Periodo[] {
  return ORDEM_PERIODOS.filter((p) => l.precos_periodo[p] != null)
}

/**
 * Custo atual do cliente para esta simulação — o mesmo indicador de verificação já mostrado no ecrã
 * de simulação ("Custo total calculado do período — confirme contra a fatura em papel", ver
 * SimulationNewPage 3.6): não é guardado à parte, mas é reconstruído sem qualquer recálculo a partir
 * da 1ª linha guardada (poupanca_eur_periodo + custo_energia_periodo = custo_atual_periodo original —
 * ver precificarProduto em pricingEngine.ts). O custo atual é uma propriedade da simulação, não do
 * produto, por isso é igual em todas as linhas.
 */
function custoAtualDaSimulacao(simulation: Simulation): { custoTotal: number; precoMedio: number | null; indefinido: boolean } {
  const l = simulation.resultados[0]
  // resultados é jsonb (sem esquema imposto pela BD) — uma simulação muito antiga pode faltar algum
  // destes campos; nesse caso trata-se como indefinido em vez de mostrar um valor incorreto (NaN).
  if (!l || l.custo_atual_indefinido || !Number.isFinite(l.poupanca_eur_periodo) || !Number.isFinite(l.custo_energia_periodo)) {
    return { custoTotal: 0, precoMedio: null, indefinido: true }
  }
  const custoTotal = l.poupanca_eur_periodo + l.custo_energia_periodo
  const consumoTotal = Object.values(simulation.consumo_periodo).reduce((soma, v) => soma + (v ?? 0), 0)
  return {
    custoTotal,
    precoMedio: consumoTotal > 0 ? custoTotal / consumoTotal : null,
    indefinido: false,
  }
}

/**
 * Caixa "preço atual do cliente" — colocada logo no cabeçalho, junto à identificação da CPE, antes da
 * comparação/proposta, para que o preço real (não só as % de poupança mais abaixo) seja visível de
 * relance. Mostra o preço tal como foi inserido na simulação: preço médio €/kWh e o custo total do
 * período faturado — omitida quando o custo atual ainda não foi inserido (nada a mostrar).
 */
function desenharPrecoAtual(
  doc: jsPDF,
  y: number,
  custoAtual: { custoTotal: number; precoMedio: number | null; indefinido: boolean },
): number {
  if (custoAtual.indefinido || custoAtual.precoMedio == null) return y
  const altura = 14
  doc.setFillColor(255, 247, 237) // amber-50
  doc.setDrawColor(251, 191, 36) // amber-400
  doc.setLineWidth(0.4)
  doc.roundedRect(14, y, 182, altura, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(146, 64, 14) // amber-800
  doc.text('PREÇO ATUAL DO CLIENTE', 18, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text(
    `${formatEurPerKwh(custoAtual.precoMedio)}   ·   ${formatEur(custoAtual.custoTotal)} no período faturado`,
    18,
    y + 10.5,
  )
  return y + altura + 5
}

export const BRAND_GREEN: [number, number, number] = [22, 163, 74] // #16A34A
export const INK: [number, number, number] = [20, 24, 29] // #14181D

/**
 * Cabeçalho de PDF: logo real da VIKSA Group + wordmark "VIKSA Group" (reforço
 * para impressão a preto e branco), fundo branco com um filete colorido em baixo.
 * Se o logo faltar, cai só no wordmark de texto. Devolve o Y onde o conteúdo pode começar.
 */
function desenharCabecalho(
  doc: jsPDF,
  logo: LogoData | null,
  cor: [number, number, number],
  subtitulo: string,
): number {
  if (logo) {
    // O ficheiro do logo já traz o wordmark "VIKSA GROUP" desenhado — não repetir o nome em texto ao lado.
    const h = 15
    const w = (logo.width / logo.height) * h
    doc.addImage(logo.dataUrl, 'PNG', 14, 5, w, h)
  } else {
    // Sem logo (ficheiro em falta) — cai no wordmark de texto.
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(LOGO_NOME, 14, 16)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(subtitulo, 196, 16, { align: 'right' })

  doc.setDrawColor(...cor)
  doc.setLineWidth(0.8)
  doc.line(14, 24, 196, 24)
  return 34
}

export interface DocSimulacao {
  simulation: Simulation
  pontoConsumo: PontoConsumo | null
}
/** @deprecated usar DocSimulacao */
export type SimulacaoParaAprovacao = DocSimulacao

function identificacaoCpe(client: Client, pontoConsumo: PontoConsumo | null): { codigo: string; morada: string | null } {
  return {
    codigo: pontoConsumo?.cpe ?? client.cpe ?? '—',
    morada: pontoConsumo?.morada ?? client.morada ?? null,
  }
}

/** "Prazo: 24 meses" para produtos de prazo fixo, "Período: Set/Out26 → Jun27" para os GO da EZU (variant_label já vem com "→" desse formato) — nunca o valor de GO. null quando o produto não tem variante (ex: Fechado). */
function prazoLabel(l: SimulationResultLine): string | null {
  if (!l.variant_label) return null
  return l.variant_label.includes('→') ? `Período: ${l.variant_label}` : `Prazo: ${l.variant_label}`
}


// ---------------------------------------------------------------------------
// Documento para o Cliente — identidade visual própria (papel + verde/dourado VIKSA), independente
// da paleta INK/BRAND_GREEN do Documento de aprovação interna.
// ---------------------------------------------------------------------------

const V_GREEN_DEEP: [number, number, number] = [15, 42, 29] // #0F2A1D
const V_GREEN_DARK: [number, number, number] = [22, 84, 58] // #16543A
const V_GREEN_MED: [number, number, number] = [46, 107, 74] // #2E6B4A
const V_GOLD: [number, number, number] = [201, 162, 75] // #C9A24B
const V_GOLD_LABEL: [number, number, number] = [232, 201, 122] // #E8C97A — etiqueta "DIVISÃO DE ENERGIA"
const V_TEXT: [number, number, number] = [26, 26, 26] // #1A1A1A
const V_TEXT_SOFT: [number, number, number] = [138, 138, 138] // #8A8A8A
const V_PAPER: [number, number, number] = [253, 252, 249] // #FDFCF9
const V_BG_1: [number, number, number] = [244, 241, 233] // #F4F1E9 — situação atual / bloco institucional / rodapé
const V_BG_2: [number, number, number] = [247, 245, 239] // #F7F5EF — resumo / comparação
const V_BG_3: [number, number, number] = [239, 246, 241] // #EFF6F1 — poupança total combinada

interface GradientStop {
  offset: number
  color: [number, number, number]
}

function corInterpolada(stops: GradientStop[], t: number): [number, number, number] {
  const clamped = Math.min(Math.max(t, 0), 1)
  if (clamped <= stops[0].offset) return stops[0].color
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (clamped <= b.offset) {
      const local = b.offset === a.offset ? 0 : (clamped - a.offset) / (b.offset - a.offset)
      return [0, 1, 2].map((k) => Math.round(a.color[k] + (b.color[k] - a.color[k]) * local)) as [number, number, number]
    }
  }
  return stops[stops.length - 1].color
}

/**
 * Aproxima um linear-gradient CSS (ângulo + stops, mesma convenção: 0° aponta para cima, sentido
 * horário) com faixas verticais finas de cor interpolada — jsPDF não tem gradientes fiáveis fora do
 * modo avançado. O eixo é projetado exatamente como a spec CSS (projeção nos 4 cantos da caixa
 * define o intervalo 0..1); só ignora a variação vertical dentro de cada faixa, o que é impercetível
 * numa faixa larga e baixa como um cabeçalho.
 */
function desenharGradiente(doc: jsPDF, x: number, y: number, w: number, h: number, anguloGraus: number, stops: GradientStop[]) {
  const rad = (anguloGraus * Math.PI) / 180
  const dir: [number, number] = [Math.sin(rad), -Math.cos(rad)]
  const cantos: [number, number][] = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]
  const projs = cantos.map(([cx, cy]) => cx * dir[0] + cy * dir[1])
  const min = Math.min(...projs)
  const max = Math.max(...projs)
  const passos = 140
  const largura = w / passos
  for (let i = 0; i < passos; i++) {
    const cx = x + (i + 0.5) * largura
    const cy = y + h / 2
    const proj = cx * dir[0] + cy * dir[1]
    const t = max > min ? (proj - min) / (max - min) : 0
    const [r, g, b] = corInterpolada(stops, t)
    doc.setFillColor(r, g, b)
    doc.rect(x + i * largura, y, largura + 0.25, h, 'F')
  }
}

const HEADER_GRADIENT: GradientStop[] = [
  { offset: 0, color: V_GREEN_DEEP },
  { offset: 0.45, color: V_GREEN_DARK },
  { offset: 0.75, color: V_GREEN_MED },
  { offset: 1.3, color: V_GOLD },
]
const PROPOSTA_GRADIENT: GradientStop[] = [
  { offset: 0, color: V_GREEN_DARK },
  { offset: 1, color: V_GREEN_MED },
]
/** Gradiente das barras horizontais (verde escuro → verde médio → dourado), aplicado ao longo de cada barra. */
const BARRA_GRADIENT: GradientStop[] = [
  { offset: 0, color: V_GREEN_DARK },
  { offset: 0.65, color: V_GREEN_MED },
  { offset: 1, color: V_GOLD },
]

function fundoPaginaCliente(doc: jsPDF) {
  doc.setFillColor(...V_PAPER)
  doc.rect(0, 0, 210, 297, 'F')
}

interface BarraDados {
  label: string
  valor: number
}

/**
 * Gráfico de barras horizontais com o degradê da marca — cada barra é desenhada com
 * desenharGradiente(..., 90, BARRA_GRADIENT), que sempre varre verde escuro → dourado ao longo do
 * comprimento da própria barra (independente do comprimento, já que a interpolação é feita entre os
 * cantos dessa barra). Rótulo à esquerda, valor formatado à direita.
 */
function desenharGraficoBarras(doc: jsPDF, x: number, y: number, larguraTotal: number, barras: BarraDados[], formatarValor: (v: number) => string): number {
  const alturaBarra = 7
  const gap = 4.5
  const larguraLabel = 42
  const larguraValor = 26
  const larguraMaxBarra = larguraTotal - larguraLabel - larguraValor
  const maxValor = Math.max(...barras.map((b) => Math.abs(b.valor)), 1)
  let cy = y
  barras.forEach((b) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...V_TEXT)
    const labelLinhas: string[] = doc.splitTextToSize(b.label, larguraLabel - 3)
    doc.text(labelLinhas, x, cy + alturaBarra / 2 + 1.2)
    const larguraBarra = Math.max((Math.abs(b.valor) / maxValor) * larguraMaxBarra, 3)
    doc.setFillColor(...V_BG_1)
    doc.rect(x + larguraLabel, cy, larguraMaxBarra, alturaBarra, 'F')
    desenharGradiente(doc, x + larguraLabel, cy, larguraBarra, alturaBarra, 90, BARRA_GRADIENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...V_TEXT)
    doc.text(formatarValor(b.valor), x + larguraLabel + larguraMaxBarra + 3, cy + alturaBarra / 2 + 1.2)
    cy += alturaBarra + gap
  })
  return cy - gap
}

/**
 * Cabeçalho com o degradê da marca — desenhado só 1 vez por documento (não repete por CPE). Layout
 * horizontal em 2 zonas separadas por um filete vertical: esquerda só o logo (já traz "V" + "VIKSA
 * GROUP" desenhados, nunca escrever "VIKSA Energy" ao lado); direita a etiqueta "DIVISÃO DE ENERGIA"
 * + título do documento.
 */
function desenharCabecalhoCliente(doc: jsPDF, logo: LogoData | null): number {
  const alturaFaixa = 42
  desenharGradiente(doc, 0, 0, 210, alturaFaixa, 135, HEADER_GRADIENT)

  const xSeparador = 108
  // Branco a 25% de opacidade sobre o degradê — jsPDF não tem opacidade de traço fiável fora do modo
  // avançado, por isso este é o tom já resultante dessa mistura no ponto do separador, não uma
  // opacidade real aplicada em runtime.
  doc.setDrawColor(86, 133, 111)
  doc.setLineWidth(0.4)
  doc.line(xSeparador, 9, xSeparador, alturaFaixa - 9)

  if (logo) {
    const h = 24
    const w = (logo.width / logo.height) * h
    doc.addImage(logo.dataUrl, 'PNG', 16, (alturaFaixa - h) / 2, w, h)
  } else {
    // Sem logo (ficheiro em falta) — cai no wordmark de texto, nunca "VIKSA Energy".
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(255, 255, 255)
    doc.text(LOGO_NOME, 16, alturaFaixa / 2 + 2)
  }

  const xDireita = xSeparador + 10
  const larguraDireita = 196 - xDireita
  doc.setDrawColor(...V_GOLD_LABEL)
  doc.setLineWidth(0.3)
  doc.line(xDireita, 13, xDireita + larguraDireita, 13)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...V_GOLD_LABEL)
  doc.text('DIVISÃO DE ENERGIA', xDireita, 19, { charSpace: 1.4 })
  doc.line(xDireita, 22, xDireita + larguraDireita, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  const tituloLinhas: string[] = doc.splitTextToSize('Proposta de Poupança Energética', larguraDireita)
  doc.text(tituloLinhas, xDireita, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(225, 232, 227)
  doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-PT')}`, xDireita, 30 + tituloLinhas.length * 5.5 + 4)

  const y = alturaFaixa + 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...V_TEXT)
  doc.text('Segue a proposta que solicitou.', 16, y)
  return y + 8
}

/** Bloco institucional (1 vez, logo a seguir ao cabeçalho) — fundo suave com borda esquerda dourada. */
function desenharBlocoInstitucional(doc: jsPDF, y: number): number {
  const texto1 =
    'A VIKSA Energy é uma empresa do VIKSA GROUP, especializada em soluções energéticas para o segmento empresarial, com mais de 15 anos de experiência no setor.'
  const texto2 =
    'Analisámos o seu consumo, identificámos oportunidades de otimização e preparámos a solução abaixo, pensada para promover eficiência, sustentabilidade e resultados reais para o seu negócio.'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const l1: string[] = doc.splitTextToSize(texto1, 166)
  const l2: string[] = doc.splitTextToSize(texto2, 166)
  const altura = 10 + (l1.length + l2.length) * 4.6 + 4

  doc.setFillColor(...V_BG_1)
  doc.rect(14, y, 182, altura, 'F')
  doc.setFillColor(...V_GOLD)
  doc.rect(14, y, 1.3, altura, 'F')

  doc.setTextColor(...V_TEXT)
  doc.text(l1, 20, y + 8)
  doc.text(l2, 20, y + 8 + l1.length * 4.6 + 3)
  return y + altura + 8
}

/** Identificação do cliente (1 vez, logo a seguir ao bloco institucional) — dados tal como estão no sistema. */
function desenharIdentificacaoCliente(doc: jsPDF, client: Client, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...V_TEXT_SOFT)
  doc.text('EMPRESA', 16, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...V_TEXT)
  doc.text(client.nome, 16, y + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...V_TEXT_SOFT)
  const linha = [client.nif ? `NIF ${client.nif}` : null, client.morada ?? null].filter(Boolean).join('   ·   ')
  doc.text(linha, 16, y + 12.5)

  doc.setDrawColor(...V_BG_1)
  doc.setLineWidth(0.6)
  doc.line(16, y + 17, 194, y + 17)
  return y + 24
}

/**
 * Preço atual ajustado de um período (€/kWh) — mesmo ajuste de TAR já aplicado ao Custo_Atual da
 * poupança (ver calcularCustoAtualPeriodo em pricingEngine.ts), aqui decomposto por período em vez de
 * só o total/média. null quando falta o preço em bruto desse período (nunca inventa um valor).
 */
function precoAtualAjustadoPeriodo(simulation: Simulation, periodo: Periodo, tarTables: TarTables): number | null {
  const bruto = simulation.preco_atual_periodos?.[periodo]
  if (bruto == null) return null
  if (simulation.inclui_tar_atual) return bruto
  return (
    bruto +
    tarEnergiaOficial(
      simulation.segmento,
      periodo,
      simulation.esquema_horario,
      simulation.potencia_contratada_kva ?? 0,
      tarTables.tarEnergiaBtn,
      tarTables.tarEnergiaBteMt,
    )
  )
}

/**
 * Só há "Preço Atual" por período quando o preço atual foi mesmo inserido por período (Modo A) — o
 * Modo B (valor total da fatura) nunca teve um preço por período para decompor. Para BTN, também
 * precisa da potência contratada (escalão 20,7 kVA da TAR) — simulações anteriores a este campo não a
 * têm.
 */
function precoAtualPorPeriodoDisponivel(simulation: Simulation): boolean {
  if (simulation.modo_preco_atual !== 'PERIODOS' || !simulation.preco_atual_periodos) return false
  if (simulation.segmento === 'BTN' && simulation.potencia_contratada_kva == null) return false
  return true
}

/**
 * "Consumo e preços por período" — 1 linha por período aplicável ao esquema do cliente (mesma lista
 * que o produto usa, periodosDaLinha — sempre pelo menos 1, mesmo em esquema Simples). Preço Novo é o
 * único dado do produto recomendado mostrado aqui (nome/tarifário continua escondido). Preço Atual
 * fica "—" quando não há preço por período disponível (Modo B, ou dados antigos) — nunca inventa um valor.
 */
function desenharConsumoPrecosPeriodo(doc: jsPDF, y: number, simulation: Simulation, l: SimulationResultLine, tarTables: TarTables): number {
  const periodos = periodosDaLinha(l)
  const comPrecoAtual = precoAtualPorPeriodoDisponivel(simulation)

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Período', 'Consumo', 'Preço Atual', 'Preço Novo']],
    body: periodos.map((p) => {
      const consumo = simulation.consumo_periodo[p]
      const precoAtualP = comPrecoAtual ? precoAtualAjustadoPeriodo(simulation, p, tarTables) : null
      const precoNovoP = l.precos_periodo[p]
      return [
        periodoLabel(p),
        consumo != null ? formatKwh(consumo) : '—',
        precoAtualP != null ? formatEurPerKwh(precoAtualP) : '—',
        precoNovoP != null ? formatEurPerKwh(precoNovoP) : '—',
      ]
    }),
    headStyles: { fillColor: V_BG_1, textColor: V_TEXT_SOFT, fontSize: 7.5, fontStyle: 'normal' },
    bodyStyles: { fontSize: 8.5, textColor: V_TEXT },
    alternateRowStyles: { fillColor: V_BG_2 },
    styles: { cellPadding: 2.6 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
}

/** "Situação Atual" — preço médio + custo do período faturado juntos numa frase, com o consumo total entre parênteses. Omitida quando o custo atual não foi inserido (nada de real para mostrar). */
function desenharSituacaoAtual(doc: jsPDF, y: number, simulation: Simulation): number {
  const atual = custoAtualDaSimulacao(simulation)
  if (atual.indefinido || atual.precoMedio == null) return y
  const consumoTotal = Object.values(simulation.consumo_periodo).reduce((soma, v) => soma + (v ?? 0), 0)
  const altura = 14
  doc.setFillColor(...V_BG_1)
  doc.rect(14, y, 182, altura, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...V_GREEN_DARK)
  doc.text('SITUAÇÃO ATUAL', 20, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...V_TEXT)
  doc.text(
    `${formatEurPerKwh(atual.precoMedio)} · ${formatEur(atual.custoTotal)} no período faturado (${consumoTotal.toLocaleString('pt-PT')} kWh)`,
    20,
    y + 10.5,
  )
  return y + altura + 6
}

/** Poupança em destaque — 3 valores lado a lado: Poupança/mês e Poupança/ano a verde, Poupança % a dourado. */
function desenharPoupancaDestaque(doc: jsPDF, y: number, l: SimulationResultLine): number {
  if (l.custo_atual_indefinido) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...V_TEXT_SOFT)
    doc.text('Sem comparação — custo atual ainda não inserido nesta simulação.', 16, y + 5)
    return y + 12
  }
  const cols = [16, 82, 148]
  const labels = ['Poupança / mês', 'Poupança / ano', 'Poupança']
  const valores = [formatEur(l.poupanca_eur_mes), formatEur(l.poupanca_eur_ano), formatPct(l.poupanca_pct)]
  const cores: [number, number, number][] = [V_GREEN_DARK, V_GREEN_DARK, V_GOLD]
  labels.forEach((label, i) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...V_TEXT_SOFT)
    doc.text(label.toUpperCase(), cols[i], y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...cores[i])
    doc.text(valores[i], cols[i], y + 8.5)
  })
  return y + 15
}

/** Gráfico de barras — custo do período faturado, Atualmente vs. Nova proposta (mesmos valores já usados em "Situação Atual"/"Comparação", nunca recalculados aqui). */
function desenharGraficoComparacaoCusto(doc: jsPDF, y: number, simulation: Simulation, l: SimulationResultLine): number {
  const atual = custoAtualDaSimulacao(simulation)
  if (atual.indefinido) return y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...V_GREEN_DARK)
  doc.text('CUSTO DO PERÍODO FATURADO — ATUALMENTE VS. NOVA PROPOSTA', 16, y)
  y += 5
  y = desenharGraficoBarras(
    doc,
    16,
    y,
    180,
    [
      { label: 'Atualmente', valor: atual.custoTotal },
      { label: 'Nova proposta', valor: l.custo_energia_periodo },
    ],
    formatEur,
  )
  return y + 8
}

/** "Comparação Atualmente / Com esta proposta" — 2 colunas, preço médio + custo do período faturado, sem recalcular nada. */
function desenharComparacao(doc: jsPDF, y: number, simulation: Simulation, l: SimulationResultLine): number {
  const atual = custoAtualDaSimulacao(simulation)
  const altura = 30
  const precoProposta = precoMedioLinha(l, simulation.com_tar)

  doc.setFillColor(...V_BG_2)
  doc.rect(14, y, 182, altura, 'F')
  doc.setDrawColor(...V_BG_1)
  doc.setLineWidth(0.6)
  doc.line(105, y + 4, 105, y + altura - 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...V_TEXT_SOFT)
  doc.text('ATUALMENTE', 20, y + 7)
  doc.text('COM ESTA PROPOSTA', 111, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...V_TEXT)
  doc.text(`Preço médio: ${atual.precoMedio != null ? formatEurPerKwh(atual.precoMedio) : '—'}`, 20, y + 15)
  doc.text(`Custo do período faturado: ${atual.indefinido ? '—' : formatEur(atual.custoTotal)}`, 20, y + 22)
  doc.text(`Preço médio: ${precoProposta != null ? formatEurPerKwh(precoProposta) : '—'}`, 111, y + 15)
  doc.text(`Custo do período faturado: ${formatEur(l.custo_energia_periodo)}`, 111, y + 22)

  return y + altura + 6
}

/** "Comercializadora recomendada" — faixa de destaque logo a seguir ao cabeçalho de cada CPE: só o nome da comercializadora e o prazo, nunca o produto/tarifário específico nem o GO (esse fica só no Documento Interno). */
function desenharComercializadoraRecomendada(doc: jsPDF, y: number, l: SimulationResultLine, comercializadoraNome: (productId: string) => string): number {
  const prazo = prazoLabel(l)
  const altura = prazo ? 18 : 14
  desenharGradiente(doc, 14, y, 182, altura, 120, PROPOSTA_GRADIENT)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(220, 232, 225)
  doc.text('COMERCIALIZADORA RECOMENDADA', 20, y + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(comercializadoraNome(l.product_id), 20, y + (prazo ? 12.5 : 12))
  if (prazo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(230, 236, 232)
    doc.text(prazo, 20, y + 16.5)
  }
  return y + altura + 7
}

/**
 * Uma secção completa por CPE, ordem exata: comercializadora recomendada → consumo e preços por
 * período → situação atual → poupança em destaque → gráfico de barras → comparação. `contexto` só é
 * passado em documentos multi-CPE, para o cabeçalho de cada secção ler "Ponto de Consumo X de N — CPE
 * ..." em vez de só "CPE ...".
 */
function desenharSecaoCpe(
  doc: jsPDF,
  y: number,
  client: Client,
  simulation: Simulation,
  pontoConsumo: PontoConsumo | null,
  l: SimulationResultLine,
  comercializadoraNome: (productId: string) => string,
  tarTables: TarTables,
  contexto?: { indice: number; total: number },
): number {
  const cpe = identificacaoCpe(client, pontoConsumo)
  const moradaDiferente = cpe.morada && cpe.morada !== client.morada

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...V_GREEN_DARK)
  const titulo = contexto ? `Ponto de Consumo ${contexto.indice} de ${contexto.total} — CPE ${cpe.codigo}` : `CPE ${cpe.codigo}`
  doc.text(titulo, 16, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...V_TEXT_SOFT)
  const subtitulo = [moradaDiferente ? cpe.morada : null, `Eletricidade — ${simulation.segmento}`].filter(Boolean).join('   ·   ')
  doc.text(subtitulo, 16, y + 5.5)
  y += 13

  y = desenharComercializadoraRecomendada(doc, y, l, comercializadoraNome)
  y = desenharConsumoPrecosPeriodo(doc, y, simulation, l, tarTables)
  y = desenharSituacaoAtual(doc, y, simulation)
  y = desenharPoupancaDestaque(doc, y, l)
  y = desenharGraficoComparacaoCusto(doc, y, simulation, l)
  y = desenharComparacao(doc, y, simulation, l)
  return y
}

/** Página de resumo (só quando há mais de 1 CPE) — gráfico de barras por CPE, tabela CPE → Comercializadora → Poupança/ano, e o total combinado. */
function desenharResumoMultiCpe(
  doc: jsPDF,
  y: number,
  itens: { pontoConsumo: PontoConsumo | null; simulation: Simulation; l: SimulationResultLine }[],
  comercializadoraNome: (productId: string) => string,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...V_GREEN_DARK)
  doc.text('Resumo da Proposta', 16, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...V_TEXT_SOFT)
  doc.text(`${itens.length} pontos de consumo (CPE) analisados`, 16, y + 6)
  y += 16

  const validos = itens.filter(({ l }) => !l.custo_atual_indefinido)
  if (validos.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...V_GREEN_DARK)
    doc.text('POUPANÇA/ANO POR PONTO DE CONSUMO', 16, y)
    y += 5
    y =
      desenharGraficoBarras(
        doc,
        16,
        y,
        180,
        validos.map(({ pontoConsumo, l }) => ({ label: pontoConsumo?.cpe ?? '—', valor: l.poupanca_eur_ano })),
        formatEur,
      ) + 8
  }

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    // CPE → Comercializadora → Poupança/ano, só isto — nunca o nome do produto/tarifário aqui.
    head: [['CPE', 'Comercializadora', 'Poupança/ano']],
    body: itens.map(({ pontoConsumo, l }) => [
      pontoConsumo?.cpe ?? '—',
      comercializadoraNome(l.product_id),
      l.custo_atual_indefinido ? '—' : formatEur(l.poupanca_eur_ano),
    ]),
    headStyles: { fillColor: V_GREEN_DARK, textColor: 255 },
    alternateRowStyles: { fillColor: V_BG_2 },
    styles: { fontSize: 8.5, cellPadding: 3.2, textColor: V_TEXT },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  const totalMes = validos.reduce((soma, { l }) => soma + l.poupanca_eur_mes, 0)
  const totalAno = validos.reduce((soma, { l }) => soma + l.poupanca_eur_ano, 0)

  doc.setFillColor(...V_BG_3)
  doc.roundedRect(14, y, 182, 24, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...V_TEXT_SOFT)
  doc.text('POUPANÇA TOTAL COMBINADA', 20, y + 8)
  doc.setFontSize(15)
  doc.setTextColor(...V_GREEN_DARK)
  doc.text(`${formatEur(totalMes)} / mês`, 20, y + 18)
  doc.setTextColor(...V_GOLD)
  doc.text(`${formatEur(totalAno)} / ano`, 110, y + 18)
  if (validos.length < itens.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...V_TEXT_SOFT)
    doc.text('Exclui CPEs sem custo atual inserido na simulação.', 20, y + 22.5)
  }
  return y + 24 + 8
}

/** Rodapé (1 vez, no fim do documento) — nome/contacto do consultor antes do bloco de avisos legais. */
/** Rodapé (1 vez, no fim do documento): validade + aviso de scoring, contacto, "VIKSA Group —
 * Energia | Tecnologia | Investimentos.", e por último o nome do consultor (nunca o email de login —
 * ver ClientDetailPage/SimulationResultPage, em branco quando o cliente não tem consultor associado). */
function desenharRodapeCliente(doc: jsPDF, y: number, consultor?: { nome: string | null; contacto: string | null }): number {
  const paragrafos = [
    'Esta proposta é válida por 10 dias a partir da data de emissão. A contratação está sujeita a avaliação de scoring por parte da comercializadora.',
    'Qualquer dúvida ou questão, contacte: energia@example.com',
    'Os valores apresentados são estimativas com base no consumo e período faturado indicados. VIKSA Group — Energia | Tecnologia | Investimentos.',
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const wrapped = paragrafos.map((p): string[] => doc.splitTextToSize(p, 174))
  const totalLinhas = wrapped.reduce((soma, w) => soma + w.length, 0)
  const alturaConsultor = consultor?.nome ? 6 : 0
  const altura = totalLinhas * 3.8 + 10 + alturaConsultor

  doc.setFillColor(...V_BG_1)
  doc.rect(14, y, 182, altura, 'F')
  let ly = y + 6.5
  doc.setTextColor(...V_TEXT_SOFT)
  wrapped.forEach((w) => {
    doc.text(w, 20, ly)
    ly += w.length * 3.8 + 3
  })
  if (consultor?.nome) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...V_TEXT)
    doc.text(`Consultor: ${consultor.nome}${consultor.contacto ? `   ·   ${consultor.contacto}` : ''}`, 20, ly + 1)
  }
  return y + altura
}

/** Numeração "Página X de N" em todas as páginas — exceto a página 1 de um documento multi-CPE, que leva a nota especial da capa+resumo em vez disso (ver desenharNotaCapaResumo). */
function desenharNumerosPaginaCliente(doc: jsPDF, saltarPagina1: boolean) {
  const total = doc.getNumberOfPages()
  if (total <= 1) return
  for (let i = 1; i <= total; i++) {
    if (i === 1 && saltarPagina1) continue
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...V_TEXT_SOFT)
    doc.text(`Página ${i} de ${total}`, 194, 291, { align: 'right' })
  }
}

/** Nota de rodapé só da página 1 (capa+resumo) de um documento multi-CPE — nunca repetida nas páginas seguintes. */
function desenharNotaCapaResumo(doc: jsPDF, totalPaginas: number) {
  doc.setPage(1)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...V_TEXT_SOFT)
  doc.text(`Página 1 de ${totalPaginas} — detalhe de cada ponto de consumo nas páginas seguintes.`, 16, 291)
}

/**
 * Proposta para o cliente final — 1 documento por cliente, cabeçalho/bloco institucional/identificação
 * só 1 vez, seguidos de 1 secção por CPE selecionada (cada uma focada só na linha marcada Escolhida
 * dessa simulação — nunca a sugerida, nunca uma adivinhada). Bloqueia (lança erro, sem gerar nada)
 * se alguma CPE selecionada ainda não tiver nenhuma linha marcada como Escolhida — nunca gera com um
 * valor adivinhado, ver docs/redesign-linhas-comparacao.md ponto 4; o chamador deve mostrar o erro ao
 * consultor e nunca o engolir. Com mais de 1 CPE, a página 1 combina capa + resumo (sem página em
 * branco) e cada CPE ganha a sua própria página a seguir. Cada simulação foi calculada isoladamente
 * por CPE; aqui só se juntam num documento.
 */
export async function gerarPropostaPdf({
  client,
  simulacoes,
  comercializadoraNome,
  consultor,
  tarTables,
}: {
  client: Client
  simulacoes: DocSimulacao[]
  comercializadoraNome: (productId: string) => string
  consultor?: { nome: string | null; contacto: string | null }
  /** Tabelas TAR oficiais — só para a coluna "Preço Atual" de "Consumo e preços por período" (ver desenharConsumoPrecosPeriodo). */
  tarTables: TarTables
}) {
  const logo = await carregarLogo()
  const doc = new jsPDF({ compress: true })
  fundoPaginaCliente(doc)

  function novaPagina(): number {
    doc.addPage()
    fundoPaginaCliente(doc)
    return 20
  }

  let y = desenharCabecalhoCliente(doc, logo)
  y = desenharBlocoInstitucional(doc, y)
  y = desenharIdentificacaoCliente(doc, client, y)

  // Bloqueio defensivo — o chamador (ClientDetailPage) já deve ter verificado isto antes de chegar
  // aqui, mas esta função nunca gera um documento parcial nem adivinha uma escolha: se alguma CPE
  // selecionada não tiver uma linha marcada como Escolhida, para tudo e lança erro (ver ponto 4).
  const semEscolha = simulacoes.filter(({ simulation }) => !linhaEscolhidaDaSimulacao(simulation))
  if (semEscolha.length > 0) {
    const codigos = semEscolha.map(({ pontoConsumo }) => identificacaoCpe(client, pontoConsumo).codigo)
    throw new Error(
      semEscolha.length === 1
        ? `A CPE ${codigos[0]} ainda não tem nenhuma linha marcada como Escolhida — marque uma opção antes de gerar o Documento do Cliente.`
        : `${semEscolha.length} CPEs selecionadas ainda não têm uma linha marcada como Escolhida (${codigos.join(', ')}) — marque uma opção para cada uma antes de gerar o Documento do Cliente.`,
    )
  }

  const itens = simulacoes.map(({ simulation, pontoConsumo }) => ({
    simulation,
    pontoConsumo,
    l: linhaEscolhidaDaSimulacao(simulation)!,
  }))

  const multiCpe = itens.length > 1
  // Multi-CPE: o resumo continua na página 1 (capa+resumo combinada, nunca uma página em branco antes).
  if (multiCpe) {
    y = desenharResumoMultiCpe(doc, y, itens, comercializadoraNome)
  }

  itens.forEach(({ simulation, pontoConsumo, l }, index) => {
    // Multi-CPE: cada secção começa sempre numa página nova a seguir à capa+resumo. Só 1 CPE: a
    // secção continua no fluxo natural logo a seguir à identificação do cliente.
    if (multiCpe || index > 0) y = novaPagina()
    y = desenharSecaoCpe(doc, y, client, simulation, pontoConsumo, l, comercializadoraNome, tarTables, multiCpe ? { indice: index + 1, total: itens.length } : undefined)
    y += 8
  })

  if (y > 250) y = novaPagina()
  desenharRodapeCliente(doc, y, consultor)
  desenharNumerosPaginaCliente(doc, multiCpe)
  if (multiCpe) desenharNotaCapaResumo(doc, doc.getNumberOfPages())

  doc.save(`Proposta-${client.nome.replace(/\s+/g, '-')}.pdf`)
}

/**
 * Documento de aprovação interna (manager) — junta várias simulações do mesmo cliente (uma por CPE)
 * num só PDF. Mostra, por CPE, só as linhas marcadas Candidata (não a tabela de comparação completa)
 * — cada uma com o seu próprio GO sempre visível (l.go_override, nunca o antigo GO a nível da
 * simulação inteira). Uma CPE sem nenhuma candidata marcada mostra um aviso discreto na sua secção,
 * em vez de ser omitida em silêncio (ver docs/redesign-linhas-comparacao.md ponto 5). Cada simulação
 * foi calculada isoladamente por CPE — aqui só se agrupam.
 */
export async function gerarDocumentoAprovacaoInterna({
  client,
  simulacoes,
  comercializadoraNome,
}: {
  client: Client
  simulacoes: DocSimulacao[]
  comercializadoraNome: (productId: string) => string
}) {
  const logo = await carregarLogo()
  const doc = new jsPDF({ compress: true })

  simulacoes.forEach(({ simulation, pontoConsumo }, index) => {
    if (index > 0) doc.addPage()
    const topo = desenharCabecalho(doc, logo, INK, 'Documento de aprovação interna')

    doc.setTextColor(...INK)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(client.nome, 14, topo)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)

    const cpe = identificacaoCpe(client, pontoConsumo)
    const infoTexto = [
      `CPE: ${cpe.codigo}`,
      cpe.morada ? `Morada: ${cpe.morada}` : null,
      client.nif ? `NIF: ${client.nif}` : null,
      `Segmento: ${simulation.segmento}`,
      `Simulação de ${new Date(simulation.created_at).toLocaleDateString('pt-PT')}`,
      `Preço médio apresentado: ${simulation.com_tar ? 'Com TAR' : 'Sem TAR'}`,
    ]
      .filter(Boolean)
      .join('   ·   ')
    const infoLinhas: string[] = doc.splitTextToSize(infoTexto, 182)
    doc.text(infoLinhas, 14, topo + 6)

    let y = desenharPrecoAtual(doc, topo + 6 + infoLinhas.length * 4.5 + 6, custoAtualDaSimulacao(simulation))

    // Só as linhas marcadas Candidata (⭐) — nunca a tabela de comparação completa. Uma CPE sem
    // nenhuma candidata marcada mostra um aviso discreto em vez de ficar com a secção vazia/omitida.
    const linhas = linhasCandidatasDaSimulacao(simulation)

    if (linhas.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(180, 83, 9) // amber-700
      doc.text('Nenhuma opção marcada como candidata para esta CPE.', 14, y + 5)
      y += 12
    }

    // Cada linha candidata é um pequeno bloco de 2 tabelas — a linha de comparação de sempre, seguida
    // imediatamente (mesma posição, sem tabela única com todas as linhas) da tabela de detalhe por
    // período dessa linha, cujo nº de colunas se adapta sozinho ao esquema do produto.
    linhas.forEach((l) => {
      if (y > 250) {
        doc.addPage()
        y = desenharCabecalho(doc, logo, INK, 'Documento de aprovação interna (continuação)')
      }
      const preco = precoMedioLinha(l, simulation.com_tar)
      const marca = l.escolhida ? '  ✓ Escolhida' : ''

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Produto', 'Preço médio (€/kWh)', 'Poupança/mês', 'Poupança/ano', 'Poupança %']],
        body: [
          [
            `${comercializadoraNome(l.product_id)} — ${l.produto_nome}${l.variant_label ? ` (${l.variant_label})` : ''}${marca}`,
            preco != null ? formatEurPerKwh(preco) : '—',
            l.custo_atual_indefinido ? '—' : formatEur(l.poupanca_eur_mes),
            l.custo_atual_indefinido ? '—' : formatEur(l.poupanca_eur_ano),
            l.custo_atual_indefinido ? '—' : formatPct(l.poupanca_pct),
          ],
        ],
        headStyles: { fillColor: INK, textColor: 255 },
        styles: { fontSize: 8, cellPadding: 3 },
        ...(l.escolhida ? { bodyStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52] } } : {}),
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

      // GO desta linha — sempre visível para as candidatas (cada linha tem o seu próprio GO,
      // independente das outras). Só produtos "abertos" têm GO; Fechados não mostram nada. Nunca
      // aparece no Documento do Cliente, só aqui. Simulações antigas sem GO gravado nessa linha mostram
      // "GO utilizado: —" (nunca a linha em branco, que o manager leria como "sem GO").
      if (l.tipo !== 'FECHADO') {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(180, 83, 9) // amber-700 — destaca o valor da alavanca de margem para o manager
        doc.text(`GO utilizado: ${formatGo(l.go_override)}${l.go_fixado && l.go_override != null ? ' (fixado)' : ''}`, 18, y + 4.5)
        y += 5.5
      }

      const periodos = periodosDaLinha(l)
      if (periodos.length > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(120, 120, 120)
        doc.text('Preço por período (€/kWh):', 18, y + 4.5)

        autoTable(doc, {
          startY: y + 6.5,
          margin: { left: 18, right: 14 },
          tableWidth: 'wrap',
          head: [periodos.map((p) => periodoLabel(p))],
          body: [periodos.map((p) => formatEurPerKwh(l.precos_periodo[p]!))],
          headStyles: { fillColor: [226, 232, 240], textColor: [71, 85, 105], fontSize: 7, fontStyle: 'normal' },
          bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
          styles: { cellPadding: 1.8 },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
      }
      y += 6
    })

    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Documento interno para decisão do manager. ${simulacoes.length > 1 ? `CPE ${index + 1} de ${simulacoes.length}.` : ''} Valores estimados com base no consumo indicado.`,
      14,
      287,
    )
  })

  doc.save(`Aprovacao-interna-${client.nome.replace(/\s+/g, '-')}.pdf`)
}
