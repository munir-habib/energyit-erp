import { useRef, useState, type DragEvent } from 'react'
import clsx from 'clsx'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { extrairDadosFatura, type ResultadoExtracao } from '@/lib/invoiceExtraction'
import { ACCEPT_FATURA, lerDocumento, tipoDoFicheiro, type DocumentoLido } from '@/lib/invoiceReader'

/**
 * Estados do quadro — cada um com o seu contorno:
 *  ESPERA          → gradiente azul/verde/vermelho a rodar (único estado animado)
 *  A_LER           → azul sólido, com o progresso da leitura
 *  ESCOLHER_CPE    → azul sólido, à espera que o consultor escolha o CPE
 *  SUCESSO         → verde sólido
 *  NOVA_TENTATIVA  → azul sólido, à espera de novo ficheiro ("Carregar outra fatura")
 *  ERRO            → vermelho sólido, mensagem por baixo do quadro
 */
type EstadoUpload = 'ESPERA' | 'A_LER' | 'ESCOLHER_CPE' | 'SUCESSO' | 'NOVA_TENTATIVA' | 'ERRO'

const CONTORNO: Record<Exclude<EstadoUpload, 'ESPERA'>, string> = {
  A_LER: 'bg-accent',
  ESCOLHER_CPE: 'bg-accent',
  NOVA_TENTATIVA: 'bg-accent',
  SUCESSO: 'bg-savings dark:bg-savings-dark',
  ERRO: 'bg-danger',
}

export function InvoiceUploadCard({
  onExtraido,
  camposPreenchidos,
  dadosConfirmados,
}: {
  /** Chamado com o resultado de uma extração utilizável (estado OK) e o ficheiro de origem. */
  onExtraido: (resultado: ResultadoExtracao, ficheiro: File) => void
  /** Quantos campos do formulário foram preenchidos a partir da última fatura (para o resumo). */
  camposPreenchidos: number
  /** true depois de o consultor carregar em "Confirmar dados e calcular". */
  dadosConfirmados: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<EstadoUpload>('ESPERA')
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [arrastar, setArrastar] = useState(false)
  const [ficheiro, setFicheiro] = useState<File | null>(null)
  const [documento, setDocumento] = useState<DocumentoLido | null>(null)
  const [resultado, setResultado] = useState<ResultadoExtracao | null>(null)

  function abrirSeletor() {
    inputRef.current?.click()
  }

  function carregarOutra() {
    setErro(null)
    setEstado('NOVA_TENTATIVA')
    abrirSeletor()
  }

  function concluir(r: ResultadoExtracao, f: File) {
    setResultado(r)
    setEstado('SUCESSO')
    onExtraido(r, f)
  }

  async function processar(f: File) {
    setErro(null)
    setFicheiro(f)
    setResultado(null)
    if (!tipoDoFicheiro(f.name, f.type)) {
      const ext = f.name.includes('.') ? `.${f.name.split('.').pop()}` : f.type || 'desconhecido'
      setErro(`Formato não suportado (${ext}) — use PDF, JPG ou PNG.`)
      setEstado('ERRO')
      return
    }
    setEstado('A_LER')
    setProgresso('A ler a fatura…')
    try {
      const doc = await lerDocumento(f, setProgresso)
      setDocumento(doc)
      const r = extrairDadosFatura(doc.paginas, doc.meta)
      if (r.estado === 'RECUSADA') {
        setErro(r.motivoRecusa ?? 'Fatura não suportada.')
        setEstado('ERRO')
      } else if (r.estado === 'ESCOLHER_CPE') {
        setResultado(r)
        setEstado('ESCOLHER_CPE')
      } else concluir(r, f)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível ler este ficheiro — tente outra fatura ou preencha os campos manualmente.')
      setEstado('ERRO')
    }
  }

  function escolherCpe(cpe: string) {
    if (!documento || !ficheiro) return
    concluir(extrairDadosFatura(documento.paginas, documento.meta, { cpeEscolhido: cpe }), ficheiro)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setArrastar(false)
    const f = e.dataTransfer.files[0]
    if (f) void processar(f)
  }

  const animado = estado === 'ESPERA'
  const mostrarZona = estado === 'ESPERA' || estado === 'NOVA_TENTATIVA' || estado === 'ERRO'

  return (
    <div>
      <div
        data-estado={estado}
        className={clsx(
          'relative overflow-hidden rounded-card p-[3px] transition-colors duration-500',
          animado ? 'bg-slate-200' : CONTORNO[estado as Exclude<EstadoUpload, 'ESPERA'>],
        )}
      >
        <div
          aria-hidden
          className={clsx(
            'invoice-border-gradient transition-opacity duration-500',
            animado ? 'invoice-border-spin opacity-100' : 'opacity-0',
          )}
        />
        <div className="relative rounded-[11px] bg-surface-card p-5 dark:bg-surface-dark-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fazer upload da fatura</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Carregue o PDF ou foto da fatura atual do cliente para pré-preencher os campos abaixo
              </p>
            </div>
            {(estado === 'SUCESSO' || estado === 'ESCOLHER_CPE') && (
              <Button type="button" size="sm" variant="secondary" onClick={carregarOutra}>
                Carregar outra fatura
              </Button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_FATURA}
            className="hidden"
            data-testid="fatura-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = '' // permite voltar a escolher o mesmo ficheiro
              if (f) void processar(f)
            }}
          />

          {mostrarZona && (
            <button
              type="button"
              onClick={abrirSeletor}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastar(true)
              }}
              onDragLeave={() => setArrastar(false)}
              onDrop={onDrop}
              className={clsx(
                'mt-4 flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
                arrastar
                  ? 'border-accent bg-accent/5 dark:bg-accent/10'
                  : 'border-slate-300 hover:bg-surface-muted dark:border-white/15 dark:hover:bg-white/5',
              )}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-slate-400">
                <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Clique para escolher o ficheiro ou arraste-o para aqui</span>
              <span className="text-xs text-slate-400">PDF, JPG ou PNG · lido localmente, sem enviar para nenhum serviço externo</span>
            </button>
          )}

          {estado === 'A_LER' && (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              {progresso} <span className="text-slate-400">{ficheiro?.name}</span>
            </p>
          )}

          {estado === 'ESCOLHER_CPE' && resultado && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Esta fatura tem {resultado.cpesEncontrados.length} CPEs. Escolha qual usar para continuar a leitura:
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.cpesEncontrados.map((cpe) => (
                  <Button key={cpe} type="button" size="sm" variant="secondary" onClick={() => escolherCpe(cpe)}>
                    <span className="font-numeric">{cpe}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {estado === 'SUCESSO' && resultado && (
            <div className="mt-4 space-y-3">
              <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="text-savings dark:text-savings-dark">✓</span>
                <span className="truncate font-medium">{ficheiro?.name}</span>
                <span className="text-slate-400">
                  · {resultado.origem === 'OCR' ? `lido por OCR (${Math.round(resultado.confiancaOcr ?? 0)}% confiança)` : 'texto do PDF'}
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {dadosConfirmados
                  ? 'Dados da fatura confirmados pelo consultor.'
                  : camposPreenchidos > 0
                    ? `${camposPreenchidos} ${camposPreenchidos === 1 ? 'campo preenchido' : 'campos preenchidos'} a partir da fatura — verde = confiança alta, âmbar = confirmar com atenção. Reveja-os abaixo antes de calcular.`
                    : 'Não foi possível preencher nenhum campo automaticamente — preencha-os manualmente.'}
              </p>
              {resultado.avisos.map((a) => (
                <Alert key={a.codigo} tone="warning">
                  {a.mensagem}
                </Alert>
              ))}
            </div>
          )}
        </div>
      </div>
      {estado === 'ERRO' && erro && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <span aria-hidden>●</span> {erro}
        </p>
      )}
    </div>
  )
}
