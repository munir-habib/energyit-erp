/**
 * Leitura do ficheiro da fatura no browser → texto por página, pronto para as heurísticas de
 * invoiceExtraction.ts. 100% local: PDF com pdfjs-dist, OCR com tesseract.js a partir dos ficheiros
 * servidos pela própria app em /ocr/ (scripts/copy-ocr-assets.mjs) — nenhuma chamada a APIs externas.
 *
 * Pipeline: PDF → texto nativo primeiro; se tiver menos de 100 caracteres ou mais de 10% de
 * caracteres não imprimíveis, é tratado como digitalizado → rasterizar cada página + OCR (por).
 * Imagens (JPG/PNG) → OCR direto. As bibliotecas só são carregadas quando são mesmo precisas.
 */
import type { MetaLeitura } from './invoiceExtraction'

export type TipoFicheiro = 'PDF' | 'IMAGEM'

export const ACCEPT_FATURA = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

/** Tipo do ficheiro pela extensão/MIME — null = não suportado (ex: .docx, .heic). */
export function tipoDoFicheiro(nome: string, mime: string): TipoFicheiro | null {
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF'
  if (['image/jpeg', 'image/png'].includes(mime) || ['jpg', 'jpeg', 'png'].includes(ext)) return 'IMAGEM'
  return null
}

/** true se o texto nativo do PDF não serve (PDF digitalizado sem camada de texto). */
export function textoInsuficiente(texto: string): boolean {
  const semEspacos = texto.replace(/\s/g, '')
  if (semEspacos.length < 100) return true
  const naoImprimiveis = [...semEspacos].filter((c) => !/[\p{L}\p{N}\p{P}\p{S}]/u.test(c)).length
  return naoImprimiveis / semEspacos.length > 0.1
}

export interface DocumentoLido {
  paginas: string[]
  meta: MetaLeitura
}

/** Máximo de páginas lidas por OCR — as faturas relevantes estão no início (resumo nas 2 primeiras). */
const MAX_PAGINAS_OCR = 6

function urlDaApp(caminho: string): string {
  return new URL(`${import.meta.env.BASE_URL}${caminho}`, window.location.origin).href
}

async function carregarPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

/** Reconstrói as linhas de uma página a partir das posições dos fragmentos de texto do PDF. */
function linhasDaPagina(items: { str: string; transform: number[] }[]): string {
  const frags = items
    .filter((i) => i.str.trim() !== '')
    .map((i) => ({ str: i.str, x: i.transform[4] ?? 0, y: i.transform[5] ?? 0 }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const linhas: { y: number; partes: { x: number; str: string }[] }[] = []
  for (const f of frags) {
    const atual = linhas[linhas.length - 1]
    if (atual && Math.abs(atual.y - f.y) <= 3) atual.partes.push(f)
    else linhas.push({ y: f.y, partes: [f] })
  }
  return linhas.map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ')).join('\n')
}

async function criarOcr(onProgresso: (msg: string) => void) {
  const { createWorker, OEM } = await import('tesseract.js')
  onProgresso('A preparar o reconhecimento de texto (OCR)…')
  return createWorker('por', OEM.LSTM_ONLY, {
    workerPath: urlDaApp('ocr/worker.min.js'),
    corePath: urlDaApp('ocr/core'),
    langPath: urlDaApp('ocr/lang'),
    gzip: true,
  })
}

export async function lerDocumento(file: File, onProgresso: (msg: string) => void = () => {}): Promise<DocumentoLido> {
  const tipo = tipoDoFicheiro(file.name, file.type)
  if (!tipo) throw new Error('Formato não suportado — use PDF, JPG ou PNG.')

  if (tipo === 'IMAGEM') {
    const ocr = await criarOcr(onProgresso)
    try {
      onProgresso('A ler a imagem (OCR)…')
      const { data } = await ocr.recognize(file)
      return { paginas: [data.text], meta: { origem: 'OCR', confiancaOcr: data.confidence } }
    } finally {
      await ocr.terminate()
    }
  }

  onProgresso('A ler o PDF…')
  const pdfjs = await carregarPdfjs()
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await tarefa.promise
  try {
    const paginas: string[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const content = await page.getTextContent()
      paginas.push(linhasDaPagina(content.items.filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i)))
    }
    if (!textoInsuficiente(paginas.join('\n'))) return { paginas, meta: { origem: 'TEXTO' } }

    // PDF digitalizado: rasterizar cada página e correr OCR.
    const ocr = await criarOcr(onProgresso)
    try {
      const total = Math.min(pdf.numPages, MAX_PAGINAS_OCR)
      const textos: string[] = []
      const confiancas: number[] = []
      for (let n = 1; n <= total; n++) {
        onProgresso(`A ler a página ${n} de ${total} (OCR)…`)
        const page = await pdf.getPage(n)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        await page.render({ canvas, viewport }).promise
        const { data } = await ocr.recognize(canvas)
        textos.push(data.text)
        confiancas.push(data.confidence)
      }
      const media = confiancas.reduce((s, c) => s + c, 0) / Math.max(1, confiancas.length)
      return { paginas: textos, meta: { origem: 'OCR', confiancaOcr: media } }
    } finally {
      await ocr.terminate()
    }
  } finally {
    await tarefa.destroy()
  }
}
