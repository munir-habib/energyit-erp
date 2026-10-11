/**
 * Leitura automática de faturas de eletricidade — extração 100% local por heurísticas, sobre o texto
 * já obtido do documento (texto nativo do PDF ou OCR, ver invoiceReader.ts). Funções puras: recebem
 * o texto por página e devolvem um resultado estruturado, campo a campo, com o nível de confiança.
 *
 * Âmbito: só Energia Ativa, TAR e Potência Contratada (+ CPE, datas, esquema, segmento). Linhas de
 * IVA, descontos, taxas, contribuição audiovisual, impostos ou totais a pagar são ignoradas por
 * completo — nunca confundidas com energia nem com o total da fatura.
 *
 * Nada aqui preenche o formulário diretamente: o resultado é sempre revisto e confirmado pelo
 * consultor, campo a campo, antes de entrar em qualquer cálculo (SimulationNewPage.tsx).
 */
import type { EsquemaHorario, Periodo, Segmento } from '@/types/database'

// ---------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------

/**
 * ALTA — valor no formato esperado E rótulo a menos de 50 caracteres.
 * MEDIA — formato certo mas rótulo longe/ausente, ou rótulo encontrado mas formato imperfeito.
 * BAIXA — só para mostrar ao consultor tal como veio (ex: CPE com erro de OCR); nunca preenche.
 */
export type Confianca = 'ALTA' | 'MEDIA' | 'BAIXA'

export interface CampoExtraido<T> {
  valor: T
  confianca: Confianca
  /** Página (1-based) onde o valor foi encontrado. */
  pagina: number
}

export type CodigoAviso =
  | 'MULTIPLOS_CPES'
  | 'SEM_PERIODOS'
  | 'ACERTO'
  | 'CONSUMO_ESTIMADO'
  | 'TROCA_COMERCIALIZADORA'
  | 'QUALIDADE_BAIXA'
  | 'VOCABULARIO_DESCONHECIDO'
  | 'CPE_ILEGIVEL'
  | 'TAR_PROVAVELMENTE_INCLUIDA'
  | 'DIAS_NAO_ENCONTRADOS'

export interface AvisoExtracao {
  codigo: CodigoAviso
  mensagem: string
}

export type EstadoTar =
  | { estado: 'SEPARADA'; valores: number[]; confianca: Confianca }
  | { estado: 'PROVAVELMENTE_INCLUIDA'; confianca: 'MEDIA' }
  | { estado: 'DESCONHECIDA' }

export interface ResultadoExtracao {
  /** RECUSADA = fatura de gás (nada é preenchido). ESCOLHER_CPE = vários CPEs, pedir escolha antes do resto. */
  estado: 'OK' | 'RECUSADA' | 'ESCOLHER_CPE'
  motivoRecusa?: string
  origem: 'TEXTO' | 'OCR'
  /** Confiança média reportada pelo OCR (0–100), só quando origem = OCR. */
  confiancaOcr?: number
  cpe?: CampoExtraido<string>
  /** Todos os CPEs distintos válidos encontrados (mais do que 1 → ESCOLHER_CPE). */
  cpesEncontrados: string[]
  /** Candidato a CPE que quase bate com o formato (possível erro de OCR) — mostrado tal como veio, nunca corrigido. */
  cpeDuvidoso?: string
  potenciaKva?: CampoExtraido<number>
  esquema?: CampoExtraido<EsquemaHorario>
  segmento?: CampoExtraido<Segmento>
  consumoPeriodo: Partial<Record<Periodo, CampoExtraido<number>>>
  /** Preço unitário (€/kWh) por período — média ponderada quando há várias sub-linhas do mesmo período. */
  precoPeriodo: Partial<Record<Periodo, CampoExtraido<number>>>
  /** Consumo total (kWh) — só usado para informar quando a fatura não discrimina períodos. */
  consumoTotal?: CampoExtraido<number>
  dataInicio?: string
  dataFim?: string
  diasFaturados?: CampoExtraido<number>
  tar: EstadoTar
  leitura?: 'ESTIMADA' | 'REAL'
  avisos: AvisoExtracao[]
  /** Aviso geral de baixa qualidade de leitura (secção 6) — mostrado no topo, não por campo. */
  qualidadeBaixa: boolean
}

export interface MetaLeitura {
  origem: 'TEXTO' | 'OCR'
  confiancaOcr?: number
}

// ---------------------------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------------------------

/**
 * Normaliza o texto de uma página, sem mexer em acentos nem maiúsculas: espaços/tabs múltiplos →
 * 1 espaço; quebras de linha uniformes; junta números claramente partidos entre linhas
 * (ex: "0,129\n1" → "0,1291", "1.\n234" → "1.234").
 */
export function normalizarTexto(texto: string): string {
  const linhas = texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
  const out: string[] = []
  for (const linha of linhas) {
    const anterior = out[out.length - 1]
    if (
      anterior !== undefined &&
      // "…1,29" + linha só com 1–3 dígitos, ou "…1," / "…1." + linha a começar por dígitos
      ((/\d[.,]\d+$/.test(anterior) && /^\d{1,3}$/.test(linha)) || (/\d[.,]$/.test(anterior) && /^\d/.test(linha)))
    ) {
      out[out.length - 1] = anterior + linha
      continue
    }
    out.push(linha)
  }
  return out.filter((l) => l !== '').join('\n')
}

/**
 * Converte um número tal como escrito na fatura para número JS, aceitando 1.234,56 / 1,234.56 /
 * 1234.56 / 1234,56 / 0,1234. Com os dois separadores, o último é o decimal. Com um só separador
 * repetido, é de milhar. Com um só separador, uma única vez: milhar se tiver exatamente 3 dígitos
 * depois e a parte inteira não for 0 (ex: "1.234" kWh), decimal nos restantes casos (ex: "0,1234").
 */
export function parseNumero(s: string): number | null {
  const t = s.trim()
  if (!/^\d[\d.,]*$/.test(t)) return null
  const ultPonto = t.lastIndexOf('.')
  const ultVirgula = t.lastIndexOf(',')
  let normal: string
  if (ultPonto >= 0 && ultVirgula >= 0) {
    const dec = ultPonto > ultVirgula ? '.' : ','
    const mil = dec === '.' ? ',' : '.'
    normal = t.split(mil).join('').replace(dec, '.')
  } else if (ultPonto >= 0 || ultVirgula >= 0) {
    const sep = ultPonto >= 0 ? '.' : ','
    const partes = t.split(sep)
    if (partes.length > 2) normal = partes.join('')
    else {
      const [inteira, frac] = partes as [string, string]
      normal = frac.length === 3 && inteira !== '0' && !/^0/.test(inteira) ? inteira + frac : `${inteira}.${frac}`
    }
  } else normal = t
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

/** Casas decimais tal como escritas (ex: "0,1234" → 4). */
function casasDecimais(s: string): number {
  const m = /[.,](\d+)$/.exec(s)
  return m ? m[1]!.length : 0
}

// ---------------------------------------------------------------------------------------------
// Vocabulário (secção 4) — case-insensitive, tolerante a hífens/espaços opcionais
// ---------------------------------------------------------------------------------------------

const RE = {
  cpeRotulo: /c[óo]digo\s+d[eo]\s+ponto\s+de\s+entrega|ponto\s+de\s+entrega|\bCPE\b/i,
  potenciaContratada: /pot[êe]ncia\s+contratada|pot\.\s*contratada|pot[êe]ncia\s*\((?:kVA|kW)\)/i,
  potenciaGenerica: /pot[êe]ncia/i,
  tetra: /tetra[\s-]?hor[áa]rio|ciclo\s+semanal\s+com\s+super\s+vazio/i,
  tri: /tri[\s-]?hor[áa]rio/i,
  bi: /bi[\s-]?hor[áa]rio/i,
  simplesForte: /(?:tarifa|ciclo|op[çc][ãa]o(?:\s+tarif[áa]ria)?)\s+simples/i,
  simples: /\bsimples\b/i,
  periodoFaturacao: /per[íi]odo\s+de\s+(?:fatura[çc][ãa]o|consumo)|data\s+(?:de\s+)?in[íi]cio|data\s+(?:de\s+)?fim|leitura\s+(?:anterior|atual)/i,
  tar: /\bTAR\b|tarifas?\s+de\s+acesso\s+[àa]s\s+redes|acesso\s+[àa]s\s+redes/i,
  tarIncluida: /tarifa\s+final|pre[çc]o\s+com\s+todos\s+os\s+encargos|inclui\s+(?:as\s+)?(?:TAR|tarifas?\s+de\s+acesso)|TAR\s+inclu[íi]da/i,
  estimado: /estimad[oa]/i,
  real: /leitura\s+real|leitura\s+do\s+contador/i,
  btnForte: /baixa\s+tens[ãa]o\s+normal/i,
  bteForte: /baixa\s+tens[ãa]o\s+especial/i,
  mtForte: /m[ée]dia\s+tens[ãa]o/i,
  nivelTensao: /n[íi]vel\s+de\s+tens[ãa]o|segmento|tens[ãa]o\s+de\s+fornecimento/i,
  gas: /g[áa]s\s+natural|m³|\bm3\b|\bPCS\b|escal[ãa]o\s+de\s+g[áa]s/i,
  eletricidadeForte: /\bCPE\b|ponto\s+de\s+entrega|\bkVA\b|energia\s+ativa|eletricidade|electricidade/i,
  acerto: /fatura\s+de\s+acerto|\bacerto\b|regulariza[çc][ãa]o/i,
  /** Linhas fora do âmbito — ignoradas por completo (nunca energia, TAR nem total). */
  foraDeAmbito:
    /\bIVA\b|desconto|taxa\s+municipal|taxa\s+de\s+explora[çc][ãa]o|contribui[çc][ãa]o\s+audiovisual|\bCAV\b|imposto\s+especial|\bIEC\b|\bDGEG\b|total\s+a\s+pagar|valor\s+a\s+pagar|total\s+da\s+fatura|subtotal/i,
}

/** Rótulos de período — "Super Vazio" e "Fora de Vazio" procurados primeiro e excluídos de "Vazio". */
const PERIODOS_RE: [Periodo, RegExp][] = [
  ['SUPER_VAZIO', /super\s*vazio|\bS\/\s?Vazio\b|\bS\.\s?Vazio\b/i],
  ['FORA_VAZIO', /fora\s*(?:de\s*)?vazio/i],
  ['PONTA', /(?:horas?\s+(?:de\s+)?)?\bponta\b/i],
  ['CHEIA', /(?:horas?\s+)?\bcheias?\b/i],
  ['VAZIO', /(?:horas?\s+(?:de\s+)?)?\bvazio\b/i],
  ['SIMPLES', /\bsimples\b/i],
]

/** Comercializadoras conhecidas no mercado português (para detetar troca a meio do período). */
const COMERCIALIZADORAS = [
  'EDP Comercial', 'Galp', 'Endesa', 'Iberdrola', 'Goldenergy', 'Repsol', 'Luzboa', 'Coopérnico', 'Muon',
  'YesEnergy', 'EZU', 'SuperNova', 'SU Eletricidade', 'Plenitude', 'Energia Simples', 'G9', 'Audax', 'Axpo',
  'Nabalia', 'Luzigás', 'MEO Energia', 'Enat', 'Jafplus', 'Ylce', 'Elygas',
]

/** Períodos detetados numa linha, sem sobreposição (Super Vazio / Fora de Vazio "consomem" Vazio). */
function periodosNaLinha(linha: string): { periodo: Periodo; indice: number }[] {
  let resto = linha
  const achados: { periodo: Periodo; indice: number }[] = []
  for (const [periodo, re] of PERIODOS_RE) {
    const g = new RegExp(re.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = g.exec(resto))) {
      achados.push({ periodo, indice: m.index })
      // Tapa a ocorrência para "Vazio" não voltar a casar dentro de "Super Vazio"/"Fora de Vazio".
      resto = resto.slice(0, m.index) + ' '.repeat(m[0].length) + resto.slice(m.index + m[0].length)
    }
  }
  return achados.sort((a, b) => a.indice - b.indice)
}

// ---------------------------------------------------------------------------------------------
// Estrutura por páginas/linhas
// ---------------------------------------------------------------------------------------------

interface Linha {
  texto: string
  pagina: number
}

function linhasDe(paginas: string[]): Linha[] {
  const out: Linha[] = []
  paginas.forEach((p, i) => {
    for (const texto of normalizarTexto(p).split('\n')) out.push({ texto, pagina: i + 1 })
  })
  return out
}

/** Ordem de preferência entre páginas: resultados das 2 primeiras (o resumo) ganham em caso de conflito. */
function prioridadePagina(pagina: number): number {
  return pagina <= 2 ? 0 : 1
}

// ---------------------------------------------------------------------------------------------
// CPE
// ---------------------------------------------------------------------------------------------

const CPE_RE = /PT\s?(?:\d\s?){16}[A-Z]\s?[A-Z]/g
const CPE_QUASE_RE = /PT[\s\dOIlSB]{12,24}[A-Z]{2}/g

function extrairCpes(linhas: Linha[]) {
  const validos: { cpe: string; pagina: number; alta: boolean; posLinha: number }[] = []
  linhas.forEach((l, idx) => {
    const g = new RegExp(CPE_RE.source, 'g')
    let m: RegExpExecArray | null
    while ((m = g.exec(l.texto))) {
      const cpe = m[0].replace(/\s/g, '')
      // Rótulo até 50 caracteres antes (na mesma linha) ou na linha anterior.
      const antes = l.texto.slice(Math.max(0, m.index - 50), m.index)
      const alta = RE.cpeRotulo.test(antes) || (idx > 0 && RE.cpeRotulo.test(linhas[idx - 1]!.texto))
      validos.push({ cpe, pagina: l.pagina, alta, posLinha: idx })
    }
  })
  let duvidoso: string | undefined
  if (validos.length === 0) {
    for (const l of linhas) {
      const m = new RegExp(CPE_QUASE_RE.source).exec(l.texto)
      if (m) {
        duvidoso = m[0].trim()
        break
      }
    }
  }
  return { validos, duvidoso }
}

// ---------------------------------------------------------------------------------------------
// Heurísticas por campo
// ---------------------------------------------------------------------------------------------

const NUM = String.raw`\d[\d.,]*\d|\d`

function extrairPotencia(linhas: Linha[]): CampoExtraido<number> | undefined {
  const candidatos: CampoExtraido<number>[] = []
  const reValor = new RegExp(String.raw`(${NUM})\s*(kVA|kW)\b`, 'i')
  for (const rotulo of [RE.potenciaContratada, RE.potenciaGenerica]) {
    linhas.forEach((l, idx) => {
      const m = rotulo.exec(l.texto)
      if (!m) return
      // Até ~50 caracteres depois do rótulo (mesma linha, ou início da linha seguinte).
      const janela = (l.texto.slice(m.index + m[0].length) + ' ' + (linhas[idx + 1]?.texto ?? '')).slice(0, 50)
      const v = reValor.exec(janela)
      const n = v ? parseNumero(v[1]!) : null
      if (n !== null && n > 0) candidatos.push({ valor: n, confianca: 'ALTA', pagina: l.pagina })
    })
    if (candidatos.length) break
  }
  if (!candidatos.length) {
    // Formato certo sem rótulo perto → confiança média.
    for (const l of linhas) {
      if (RE.foraDeAmbito.test(l.texto)) continue
      const v = /(\d[\d.,]*)\s*kVA\b/i.exec(l.texto)
      const n = v ? parseNumero(v[1]!) : null
      if (n !== null && n > 0) {
        candidatos.push({ valor: n, confianca: 'MEDIA', pagina: l.pagina })
        break
      }
    }
  }
  return candidatos.sort((a, b) => prioridadePagina(a.pagina) - prioridadePagina(b.pagina))[0]
}

function extrairEsquema(linhas: Linha[], periodosEncontrados: Set<Periodo>): CampoExtraido<EsquemaHorario> | undefined {
  const procurar = (re: RegExp) => linhas.find((l) => re.test(l.texto))
  const ordem: [EsquemaHorario, RegExp, Confianca][] = [
    ['TETRA_HORARIO', RE.tetra, 'ALTA'],
    ['TRI_HORARIO', RE.tri, 'ALTA'],
    ['BI_HORARIO', RE.bi, 'ALTA'],
    ['SIMPLES', RE.simplesForte, 'ALTA'],
  ]
  for (const [esquema, re, confianca] of ordem) {
    const l = procurar(re)
    if (l) return { valor: esquema, confianca, pagina: l.pagina }
  }
  // Inferido pelos períodos com consumo — formato certo, mas sem rótulo explícito → média.
  if (periodosEncontrados.has('SUPER_VAZIO')) return { valor: 'TETRA_HORARIO', confianca: 'MEDIA', pagina: 1 }
  if (periodosEncontrados.has('PONTA') && periodosEncontrados.has('CHEIA')) return { valor: 'TRI_HORARIO', confianca: 'MEDIA', pagina: 1 }
  if (periodosEncontrados.has('FORA_VAZIO')) return { valor: 'BI_HORARIO', confianca: 'MEDIA', pagina: 1 }
  const simples = procurar(RE.simples)
  if (simples || periodosEncontrados.has('SIMPLES')) return { valor: 'SIMPLES', confianca: 'MEDIA', pagina: simples?.pagina ?? 1 }
  return undefined
}

function extrairSegmento(linhas: Linha[]): CampoExtraido<Segmento> | undefined {
  const siglas: [Segmento, RegExp, RegExp][] = [
    ['BTN', /\bBTN\b/, RE.btnForte],
    ['BTE', /\bBTE\b/, RE.bteForte],
    ['MT', /\bMT\b/, RE.mtForte],
  ]
  // 1) Designação completa, ou sigla junto de "Nível de Tensão"/"Segmento" → alta.
  for (const [seg, sigla, forte] of siglas) {
    for (const l of linhas) {
      if (forte.test(l.texto)) return { valor: seg, confianca: 'ALTA', pagina: l.pagina }
      const s = sigla.exec(l.texto)
      if (s) {
        const antes = l.texto.slice(Math.max(0, s.index - 50), s.index)
        if (RE.nivelTensao.test(antes)) return { valor: seg, confianca: 'ALTA', pagina: l.pagina }
      }
    }
  }
  // 2) Só a sigla solta (pode ser parte de um nome) → média, pela ordem BTN, BTE, MT.
  for (const [seg, sigla] of siglas) {
    const l = linhas.find((x) => sigla.test(x.texto))
    if (l) return { valor: seg, confianca: 'MEDIA', pagina: l.pagina }
  }
  return undefined
}

interface ParConsumoPreco {
  periodo: Periodo
  kwh?: number
  preco?: number
  /** true = preço com "€/kWh" explícito (vs "€" solto). */
  precoExplicito: boolean
  /** true = encontrado na mesma linha do rótulo (vs linha seguinte / posição de coluna). */
  mesmaLinha: boolean
  pagina: number
}

const RE_KWH = new RegExp(String.raw`(${NUM})\s*kWh\b(?!\s*\/)`, 'gi')
const RE_PRECO_KWH = new RegExp(String.raw`(${NUM})\s*€?\s*\/\s*kWh`, 'gi')
const RE_PRECO_EUR = new RegExp(String.raw`(?:(${NUM})\s*€|€\s*(${NUM}))`, 'g')

function numerosKwh(texto: string): number[] {
  return [...texto.matchAll(RE_KWH)].map((m) => parseNumero(m[1]!)).filter((n): n is number => n !== null)
}

/** Preço unitário numa linha: preferir "€/kWh" explícito; senão um valor "€" com 2–5 casas e < 1 €. */
function precoNaLinha(texto: string): { preco: number; explicito: boolean } | undefined {
  for (const m of texto.matchAll(RE_PRECO_KWH)) {
    const n = parseNumero(m[1]!)
    const casas = casasDecimais(m[1]!)
    if (n !== null && casas >= 2 && casas <= 6) return { preco: n, explicito: true }
  }
  for (const m of texto.matchAll(RE_PRECO_EUR)) {
    const bruto = m[1] ?? m[2]!
    const n = parseNumero(bruto)
    const casas = casasDecimais(bruto)
    if (n !== null && casas >= 2 && casas <= 5 && n < 1) return { preco: n, explicito: false }
  }
  return undefined
}

function linhaDeEnergia(texto: string): boolean {
  return !RE.foraDeAmbito.test(texto) && !RE.tar.test(texto) && !RE.potenciaGenerica.test(texto)
}

function extrairParesPorPeriodo(linhas: Linha[]): ParConsumoPreco[] {
  const pares: ParConsumoPreco[] = []
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]!
    if (!linhaDeEnergia(l.texto)) continue
    const periodos = periodosNaLinha(l.texto)
    if (periodos.length === 0) continue

    if (periodos.length === 1) {
      const p = periodos[0]!.periodo
      let kwh = numerosKwh(l.texto)[0]
      let preco = precoNaLinha(l.texto)
      let mesmaLinha = true
      const seguinte = linhas[i + 1]
      // Nada na linha do rótulo → procurar na linha seguinte (se não for ela própria outro período).
      if (kwh === undefined && preco === undefined && seguinte && linhaDeEnergia(seguinte.texto) && periodosNaLinha(seguinte.texto).length === 0) {
        kwh = numerosKwh(seguinte.texto)[0]
        preco = precoNaLinha(seguinte.texto)
        mesmaLinha = false
      }
      if (kwh !== undefined || preco !== undefined) {
        pares.push({ periodo: p, kwh, preco: preco?.preco, precoExplicito: !!preco?.explicito, mesmaLinha, pagina: l.pagina })
      }
      continue
    }

    // Cabeçalho de colunas ("Ponta Cheia Vazio") seguido de uma linha com o mesmo número de valores
    // em kWh → mapeamento por posição, sempre confiança média.
    const seguinte = linhas[i + 1]
    if (seguinte && linhaDeEnergia(seguinte.texto) && periodosNaLinha(seguinte.texto).length === 0) {
      const valores = numerosKwh(seguinte.texto)
      if (valores.length === periodos.length) {
        periodos.forEach((p, k) =>
          pares.push({ periodo: p.periodo, kwh: valores[k], precoExplicito: false, mesmaLinha: false, pagina: l.pagina }),
        )
      }
    }
  }
  return pares
}

/**
 * Soma os consumos das sub-linhas de cada período e calcula o preço médio ponderado
 * Σ(consumo_i × preço_i) ÷ Σ(consumo_i). Só usa as sub-linhas das 2 primeiras páginas quando o mesmo
 * período também aparece em páginas seguintes (evita somar resumo + detalhe duas vezes).
 */
function agregarPorPeriodo(pares: ParConsumoPreco[]) {
  const consumo: Partial<Record<Periodo, CampoExtraido<number>>> = {}
  const preco: Partial<Record<Periodo, CampoExtraido<number>>> = {}
  const porPeriodo = new Map<Periodo, ParConsumoPreco[]>()
  for (const p of pares) porPeriodo.set(p.periodo, [...(porPeriodo.get(p.periodo) ?? []), p])

  for (const [periodo, todos] of porPeriodo) {
    const melhorPrioridade = Math.min(...todos.map((p) => prioridadePagina(p.pagina)))
    const linhas = todos.filter((p) => prioridadePagina(p.pagina) === melhorPrioridade)
    const comKwh = linhas.filter((p) => p.kwh !== undefined)
    if (comKwh.length) {
      const total = comKwh.reduce((s, p) => s + p.kwh!, 0)
      consumo[periodo] = {
        valor: Math.round(total * 1000) / 1000,
        confianca: comKwh.every((p) => p.mesmaLinha) ? 'ALTA' : 'MEDIA',
        pagina: comKwh[0]!.pagina,
      }
    }
    const comAmbos = linhas.filter((p) => p.kwh !== undefined && p.kwh > 0 && p.preco !== undefined)
    const soPreco = linhas.filter((p) => p.preco !== undefined)
    if (comAmbos.length) {
      const somaKwh = comAmbos.reduce((s, p) => s + p.kwh!, 0)
      const ponderado = comAmbos.reduce((s, p) => s + p.kwh! * p.preco!, 0) / somaKwh
      preco[periodo] = {
        valor: Math.round(ponderado * 1e6) / 1e6,
        confianca: comAmbos.every((p) => p.mesmaLinha && p.precoExplicito) ? 'ALTA' : 'MEDIA',
        pagina: comAmbos[0]!.pagina,
      }
    } else if (soPreco.length === 1) {
      const p = soPreco[0]!
      preco[periodo] = { valor: p.preco!, confianca: p.mesmaLinha && p.precoExplicito ? 'ALTA' : 'MEDIA', pagina: p.pagina }
    }
  }
  return { consumo, preco }
}

// ---------------------------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------------------------

const RE_DATA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g

function paraIso(d: string, m: string, a: string): string | null {
  const ano = a.length === 2 ? 2000 + Number(a) : Number(a)
  const mes = Number(m)
  const dia = Number(d)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const dt = new Date(Date.UTC(ano, mes - 1, dia))
  if (dt.getUTCMonth() !== mes - 1) return null
  return dt.toISOString().slice(0, 10)
}

/** Dias entre duas datas ISO, inclusivo (fim − início + 1). */
export function diasInclusivos(inicio: string, fim: string): number {
  return Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1
}

function extrairDatas(linhas: Linha[]) {
  type Par = { inicio: string; fim: string; confianca: Confianca; pagina: number }
  const pares: Par[] = []
  linhas.forEach((l, idx) => {
    // Janela = esta linha + a seguinte (datas "Data início … / Data fim …" em linhas separadas).
    const texto = l.texto + ' \n ' + (linhas[idx + 1]?.texto ?? '')
    const datas = [...texto.matchAll(RE_DATA)]
      .map((m) => ({ iso: paraIso(m[1]!, m[2]!, m[3]!), idx: m.index!, len: m[0].length }))
      .filter((d): d is { iso: string; idx: number; len: number } => d.iso !== null)
    for (let k = 0; k + 1 < datas.length; k++) {
      const a = datas[k]!
      const b = datas[k + 1]!
      const entre = texto.slice(a.idx + a.len, b.idx)
      const proximas = entre.length <= 25 && (/^\s*(?:a|at[ée]|-|–|—|\/|e)\s*$/i.test(entre) || RE.periodoFaturacao.test(entre) || entre.trim() === '')
      if (!proximas || a.idx >= l.texto.length) continue
      const dias = diasInclusivos(a.iso, b.iso)
      if (dias < 1 || dias > 400) continue
      const antes = texto.slice(Math.max(0, a.idx - 50), a.idx)
      const comRotulo = RE.periodoFaturacao.test(antes) || RE.periodoFaturacao.test(entre) || (idx > 0 && RE.periodoFaturacao.test(linhas[idx - 1]!.texto))
      pares.push({ inicio: a.iso, fim: b.iso, confianca: comRotulo ? 'ALTA' : 'MEDIA', pagina: l.pagina })
    }
  })
  const ordenados = pares.sort(
    (x, y) => (x.confianca === y.confianca ? 0 : x.confianca === 'ALTA' ? -1 : 1) || prioridadePagina(x.pagina) - prioridadePagina(y.pagina),
  )
  const distintos = new Set(pares.map((p) => `${p.inicio}|${p.fim}`))
  return { melhor: ordenados[0], distintos: distintos.size }
}

// ---------------------------------------------------------------------------------------------
// TAR
// ---------------------------------------------------------------------------------------------

function extrairTar(linhas: Linha[]): EstadoTar {
  const valores: number[] = []
  let explicito = false
  for (const l of linhas) {
    if (RE.foraDeAmbito.test(l.texto) || !RE.tar.test(l.texto) || RE.tarIncluida.test(l.texto)) continue
    const p = precoNaLinha(l.texto)
    if (p) {
      valores.push(p.preco)
      explicito ||= p.explicito
      continue
    }
    const qualquer = /(\d[\d.,]*\d)\s*€/.exec(l.texto)
    const n = qualquer ? parseNumero(qualquer[1]!) : null
    if (n !== null) valores.push(n)
  }
  if (valores.length) return { estado: 'SEPARADA', valores, confianca: explicito ? 'ALTA' : 'MEDIA' }
  if (linhas.some((l) => RE.tarIncluida.test(l.texto))) return { estado: 'PROVAVELMENTE_INCLUIDA', confianca: 'MEDIA' }
  return { estado: 'DESCONHECIDA' }
}

// ---------------------------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------------------------

/** Restringe o texto ao cabeçalho comum + à secção do CPE escolhido (faturas com vários CPEs). */
function restringirAoCpe(linhas: Linha[], cpe: string): Linha[] {
  const posicoes: { cpe: string; idx: number }[] = []
  linhas.forEach((l, idx) => {
    for (const m of l.texto.matchAll(new RegExp(CPE_RE.source, 'g'))) posicoes.push({ cpe: m[0].replace(/\s/g, ''), idx })
  })
  const primeiraQualquer = posicoes[0]?.idx ?? 0
  const inicio = posicoes.find((p) => p.cpe === cpe)?.idx
  if (inicio === undefined) return linhas
  const fim = posicoes.find((p) => p.idx > inicio && p.cpe !== cpe)?.idx ?? linhas.length
  return [...linhas.slice(0, primeiraQualquer), ...linhas.slice(inicio, fim)]
}

function aviso(codigo: CodigoAviso, mensagem: string): AvisoExtracao {
  return { codigo, mensagem }
}

export const MENSAGEM_GAS = 'Esta parece ser uma fatura de gás — a leitura automática só suporta eletricidade por agora.'

/**
 * Extrai os dados de uma fatura de eletricidade a partir do texto de cada página.
 * `opcoes.cpeEscolhido` — nas faturas com vários CPEs, depois de o consultor escolher um: a extração
 * dos restantes campos passa a olhar só para a secção desse CPE (mais o cabeçalho comum).
 */
export function extrairDadosFatura(
  paginas: string[],
  meta: MetaLeitura,
  opcoes: { cpeEscolhido?: string } = {},
): ResultadoExtracao {
  const todas = linhasDe(paginas)
  const textoTodo = todas.map((l) => l.texto).join('\n')
  const base: ResultadoExtracao = {
    estado: 'OK',
    origem: meta.origem,
    confiancaOcr: meta.confiancaOcr,
    cpesEncontrados: [],
    consumoPeriodo: {},
    precoPeriodo: {},
    tar: { estado: 'DESCONHECIDA' },
    avisos: [],
    qualidadeBaixa: false,
  }

  // Exceção: fatura de gás — recusa imediata, nada é preenchido. "kWh" sozinho não conta como
  // eletricidade (as faturas de gás também faturam em kWh depois da conversão PCS), nem o formato
  // PT…XX sozinho (o CUI do gás tem um formato quase igual ao do CPE) — só o rótulo CPE, kVA, etc.
  if (RE.gas.test(textoTodo) && !RE.eletricidadeForte.test(textoTodo)) {
    return { ...base, estado: 'RECUSADA', motivoRecusa: MENSAGEM_GAS }
  }

  const { validos, duvidoso } = extrairCpes(todas)
  const distintos = [...new Set(validos.map((v) => v.cpe))]
  base.cpesEncontrados = distintos

  if (distintos.length > 1 && !opcoes.cpeEscolhido) {
    base.avisos.push(aviso('MULTIPLOS_CPES', `Esta fatura tem ${distintos.length} CPEs — escolha qual usar antes de continuar.`))
    return { ...base, estado: 'ESCOLHER_CPE' }
  }

  const linhas = opcoes.cpeEscolhido ? restringirAoCpe(todas, opcoes.cpeEscolhido) : todas
  const textoFoco = linhas.map((l) => l.texto).join('\n')

  if (opcoes.cpeEscolhido) {
    const v = validos.find((x) => x.cpe === opcoes.cpeEscolhido)
    base.cpe = { valor: opcoes.cpeEscolhido, confianca: v?.alta ? 'ALTA' : 'MEDIA', pagina: v?.pagina ?? 1 }
  } else if (distintos.length === 1) {
    const v = [...validos].sort((a, b) => Number(b.alta) - Number(a.alta) || prioridadePagina(a.pagina) - prioridadePagina(b.pagina))[0]!
    base.cpe = { valor: v.cpe, confianca: v.alta ? 'ALTA' : 'MEDIA', pagina: v.pagina }
  } else if (duvidoso) {
    base.cpeDuvidoso = duvidoso
    base.avisos.push(aviso('CPE_ILEGIVEL', `Possível CPE com leitura duvidosa: "${duvidoso}" — confirme e escreva-o manualmente.`))
  }

  // Fatura noutro idioma / vocabulário irreconhecível → não adivinhar por posição.
  const reconhece = [RE.potenciaGenerica, RE.periodoFaturacao, RE.tar, RE.cpeRotulo, /energia|consumo|eletricidade|electricidade|fatura/i].some((r) =>
    r.test(textoFoco),
  ) || PERIODOS_RE.some(([, r]) => r.test(textoFoco))
  if (!reconhece) {
    base.avisos.push(aviso('VOCABULARIO_DESCONHECIDO', 'Não foi possível reconhecer o vocabulário desta fatura — preencha manualmente.'))
    base.qualidadeBaixa = meta.origem === 'OCR' && (meta.confiancaOcr ?? 100) < 70
    return base
  }

  base.potenciaKva = extrairPotencia(linhas)
  base.segmento = extrairSegmento(linhas)

  const pares = extrairParesPorPeriodo(linhas)
  const { consumo, preco } = agregarPorPeriodo(pares)
  base.consumoPeriodo = consumo
  base.precoPeriodo = preco
  base.esquema = extrairEsquema(linhas, new Set(Object.keys(consumo) as Periodo[]))

  if (Object.keys(consumo).length === 0) {
    // Sem detalhe por período: guardar o total (só informativo), deixar os períodos em branco.
    for (const l of linhas) {
      if (!linhaDeEnergia(l.texto) || !/consumo|energia/i.test(l.texto)) continue
      const n = numerosKwh(l.texto)[0]
      if (n !== undefined) {
        base.consumoTotal = { valor: n, confianca: 'MEDIA', pagina: l.pagina }
        break
      }
    }
    base.avisos.push(aviso('SEM_PERIODOS', 'Fatura sem detalhe por período — preencha manualmente se necessário.'))
  }

  const datas = extrairDatas(linhas)
  if (datas.melhor) {
    base.dataInicio = datas.melhor.inicio
    base.dataFim = datas.melhor.fim
    base.diasFaturados = {
      valor: diasInclusivos(datas.melhor.inicio, datas.melhor.fim),
      confianca: datas.melhor.confianca,
      pagina: datas.melhor.pagina,
    }
  } else {
    base.avisos.push(aviso('DIAS_NAO_ENCONTRADOS', 'Datas do período não encontradas — os dias faturados não vêm da fatura, confirme-os manualmente.'))
  }

  base.tar = extrairTar(linhas)
  if (base.tar.estado === 'PROVAVELMENTE_INCLUIDA') {
    base.avisos.push(aviso('TAR_PROVAVELMENTE_INCLUIDA', 'TAR provavelmente incluída no preço — confirme manualmente.'))
  }

  // Leitura estimada/real — só conta perto da tabela de consumo (linha com kWh/consumo/leitura).
  const perto = (re: RegExp) => linhas.some((l, i) => re.test(l.texto) && /kWh|consumo|leitura/i.test(l.texto + ' ' + (linhas[i + 1]?.texto ?? '')))
  if (perto(RE.estimado)) {
    base.leitura = 'ESTIMADA'
    base.avisos.push(aviso('CONSUMO_ESTIMADO', 'Consumo estimado, não é leitura real.'))
  } else if (perto(RE.real)) base.leitura = 'REAL'

  if (RE.acerto.test(textoFoco)) {
    base.avisos.unshift(
      aviso('ACERTO', 'Esta fatura parece ser um acerto referente a período(s) anteriores — confirme se os valores correspondem ao período atual antes de usar.'),
    )
  }

  const comercializadoras = COMERCIALIZADORAS.filter((c) => new RegExp(`\\b${c.replace(/\s+/g, '\\s+')}\\b`, 'i').test(textoFoco))
  if (comercializadoras.length >= 2 && datas.distintos >= 2) {
    base.avisos.push(
      aviso(
        'TROCA_COMERCIALIZADORA',
        `Esta fatura parece cobrir uma troca de comercializadora a meio do período (${comercializadoras.join(', ')}) — reveja com atenção qual a parte relevante.`,
      ),
    )
  }

  // Confiança geral do documento (secção 6).
  const principais = [
    base.cpe,
    base.potenciaKva,
    (Object.keys(consumo) as Periodo[]).some((p) => consumo[p] && preco[p]) ? true : undefined,
  ].filter(Boolean).length
  const ocrFraco = meta.origem === 'OCR' && (meta.confiancaOcr ?? 100) < 70
  base.qualidadeBaixa = ocrFraco || principais < 1.5
  if (base.qualidadeBaixa) {
    base.avisos.unshift(
      aviso('QUALIDADE_BAIXA', 'Qualidade de leitura baixa — reveja todos os campos com atenção, ou tente carregar uma fatura com melhor qualidade.'),
    )
  }
  return base
}
