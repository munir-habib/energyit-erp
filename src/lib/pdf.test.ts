import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, PontoConsumo } from '../types/database'
import { linha, simulacao } from '../test/fixtures'

/**
 * jsPDF/autoTable substituídos por um "documento" falso que só regista o texto escrito (e em que
 * página) — assim testa-se o conteúdo real dos documentos gerados por pdf.ts sem gerar PDF nenhum.
 */
const registo = vi.hoisted(() => ({
  textos: [] as { pagina: number; texto: string }[],
  tabelas: [] as { pagina: number; celulas: string[] }[],
  guardados: [] as string[],
}))

vi.mock('jspdf', () => {
  class FakeJsPdf {
    pagina = 1
    paginas = 1
    lastAutoTable = { finalY: 0 }
    constructor() {
      return new Proxy(this, {
        get(target, prop, receiver) {
          if (prop in target) return Reflect.get(target, prop, receiver)
          return () => receiver // setFont, setFillColor, rect, line, addImage… — sem efeito
        },
      })
    }
    text(t: string | string[]) {
      for (const s of Array.isArray(t) ? t : [t]) registo.textos.push({ pagina: this.pagina, texto: s })
      return this
    }
    splitTextToSize(t: string) {
      return [t]
    }
    addPage() {
      this.paginas += 1
      this.pagina = this.paginas
      return this
    }
    setPage(n: number) {
      this.pagina = n
      return this
    }
    getNumberOfPages() {
      return this.paginas
    }
    save(nome: string) {
      registo.guardados.push(nome)
    }
  }
  return { jsPDF: FakeJsPdf }
})

vi.mock('jspdf-autotable', () => ({
  default: (doc: { pagina: number; lastAutoTable: { finalY: number } }, opts: { startY?: number; head?: unknown[][]; body?: unknown[][] }) => {
    const celulas = [...(opts.head ?? []), ...(opts.body ?? [])].flat().map((c) => String(c))
    registo.tabelas.push({ pagina: doc.pagina, celulas })
    doc.lastAutoTable = { finalY: (opts.startY ?? 0) + 10 }
  },
}))

vi.mock('@/lib/logo', () => ({ carregarLogo: async () => null, LOGO_NOME: 'VIKSA Group' }))

const { gerarDocumentoAprovacaoInterna, gerarPropostaPdf } = await import('./pdf')

const client: Client = {
  id: 'c1',
  owner_id: 'o',
  nome: 'Empresa Teste Lda',
  nif: '500000000',
  morada: 'Rua A',
  contacto: null,
  cpe: null,
  cui: null,
  segmento_principal: 'BTE',
  consultor_responsavel: 'Consultor QA',
  grupo_id: null,
  created_at: '',
  updated_at: '',
}

function cpe(id: string, codigo: string): PontoConsumo {
  return {
    id,
    owner_id: 'o',
    client_id: 'c1',
    cpe: codigo,
    cliente: client.nome,
    nif: null,
    morada: 'Rua A',
    estado: 'Ativo',
    potencia_contratada: null,
    consumo_anual: null,
    data_ativacao: null,
    data_fim_contrato: null,
    num_periodos: 1,
    created_at: '',
    updated_at: '',
  }
}

const comercializadoraNome = (productId: string) => (productId.startsWith('sn') ? 'SuperNova' : 'EZU')
const tarTables = { tarEnergiaBtn: [], tarEnergiaBteMt: [] }

// Nomes de produto deliberadamente distintivos para se poderem procurar no texto do documento.
const bte = simulacao({
  id: 'sim-bte',
  segmento: 'BTE',
  consumo_periodo: { PONTA: 1000, CHEIA: 2000, VAZIO: 1500, SUPER_VAZIO: 500 },
  preco_atual_periodos: { PONTA: 0.2, CHEIA: 0.18, VAZIO: 0.15, SUPER_VAZIO: 0.14 },
  resultados: [
    linha({
      product_id: 'ezu-bte',
      produto_nome: 'ProdutoBTE-EzuGo',
      tipo: 'ABERTO_FIXO',
      variant_id: 'v27',
      variant_label: 'Set/Out26 → Jun27',
      precos_periodo: { PONTA: 0.16, CHEIA: 0.15, VAZIO: 0.17, SUPER_VAZIO: 0.16 },
      go_override: 12.5,
      go_fixado: true,
      candidata: true,
      escolhida: true,
    }),
    linha({
      product_id: 'ezu-bte',
      produto_nome: 'ProdutoBTE-EzuGo',
      tipo: 'ABERTO_FIXO',
      variant_id: 'v28',
      variant_label: 'Set/Out26 → Jun28',
      precos_periodo: { PONTA: 0.15, CHEIA: 0.14, VAZIO: 0.16, SUPER_VAZIO: 0.15 },
      go_override: 7,
      candidata: true,
    }),
    linha({
      product_id: 'sn-bte',
      produto_nome: 'ProdutoBTE-SuperNovaNaoCandidato',
      tipo: 'ABERTO_FIXO',
      variant_id: 'v18',
      variant_label: '18 meses',
      precos_periodo: { PONTA: 0.14, CHEIA: 0.13, VAZIO: 0.15, SUPER_VAZIO: 0.14 },
      go_override: 3,
    }),
  ],
})

const btn = simulacao({
  id: 'sim-btn',
  segmento: 'BTN',
  resultados: [
    linha({ product_id: 'ezu-z', produto_nome: 'ProdutoBTN-Z', tipo: 'FECHADO', candidata: true, escolhida: true }),
    linha({ product_id: 'sn-btn', produto_nome: 'ProdutoBTN-BtnGo', tipo: 'ABERTO_FIXO', variant_id: 'vb', variant_label: 'Set/Out26 → Jun27', go_override: 9, candidata: true }),
  ],
})

const todosOsNomesDeProduto = ['ProdutoBTE-EzuGo', 'ProdutoBTE-SuperNovaNaoCandidato', 'ProdutoBTN-Z', 'ProdutoBTN-BtnGo']

function todoOTexto(pagina?: number): string[] {
  return [
    ...registo.textos.filter((t) => pagina == null || t.pagina === pagina).map((t) => t.texto),
    ...registo.tabelas.filter((t) => pagina == null || t.pagina === pagina).flatMap((t) => t.celulas),
  ]
}

beforeEach(() => {
  registo.textos.length = 0
  registo.tabelas.length = 0
  registo.guardados.length = 0
})

describe('Documento do Cliente (gerarPropostaPdf)', () => {
  it('nunca mostra o nome do produto nem o GO — só a comercializadora e o prazo', async () => {
    await gerarPropostaPdf({
      client,
      simulacoes: [
        { simulation: bte, pontoConsumo: cpe('p1', 'PT-BTE-0001') },
        { simulation: btn, pontoConsumo: cpe('p2', 'PT-BTN-0002') },
      ],
      comercializadoraNome,
      tarTables,
    })
    const texto = todoOTexto()
    expect(registo.guardados).toHaveLength(1)
    for (const nome of todosOsNomesDeProduto) expect(texto.some((t) => t.includes(nome))).toBe(false)
    expect(texto.some((t) => /\bGO\b/.test(t))).toBe(false)
    expect(texto.some((t) => t.includes('€/MWh'))).toBe(false)
    expect(texto.some((t) => t.includes('12,5') || t.includes('12.5'))).toBe(false)
    // O que deve aparecer: a comercializadora e o prazo/período da linha escolhida.
    expect(texto).toContain('EZU')
    expect(texto).toContain('Período: Set/Out26 → Jun27')
  })

  it('usa a linha marcada Escolhida de cada CPE (nunca outra variante do mesmo produto)', async () => {
    await gerarPropostaPdf({ client, simulacoes: [{ simulation: bte, pontoConsumo: cpe('p1', 'PT-BTE-0001') }], comercializadoraNome, tarTables })
    const texto = todoOTexto()
    expect(texto).toContain('Período: Set/Out26 → Jun27')
    expect(texto).not.toContain('Período: Set/Out26 → Jun28')
  })

  it('bloqueia (sem gerar nada) quando uma CPE não tem linha Escolhida', async () => {
    const semEscolha = { ...bte, resultados: bte.resultados.map((l) => ({ ...l, escolhida: false })) }
    await expect(
      gerarPropostaPdf({ client, simulacoes: [{ simulation: semEscolha, pontoConsumo: cpe('p1', 'PT-BTE-0001') }], comercializadoraNome, tarTables }),
    ).rejects.toThrow(/PT-BTE-0001.*Escolhida/)
    expect(registo.guardados).toHaveLength(0)
  })
})

describe('Documento Interno (gerarDocumentoAprovacaoInterna)', () => {
  it('mostra o GO de cada linha candidata (cada uma o seu) e nunca linhas não candidatas', async () => {
    await gerarDocumentoAprovacaoInterna({ client, simulacoes: [{ simulation: bte, pontoConsumo: cpe('p1', 'PT-BTE-0001') }], comercializadoraNome })
    const texto = todoOTexto()
    // Vírgula decimal pt-PT (formatGo), como o resto da app — nunca "12.5".
    expect(texto).toContain('GO utilizado: 12,5 €/MWh (fixado)')
    expect(texto.some((t) => t.includes('12.5'))).toBe(false)
    expect(texto).toContain('GO utilizado: 7 €/MWh')
    expect(texto.some((t) => t.includes('GO utilizado: 3'))).toBe(false)
    expect(texto.some((t) => t.includes('ProdutoBTE-SuperNovaNaoCandidato'))).toBe(false)
    expect(texto.some((t) => t.includes('ProdutoBTE-EzuGo (Set/Out26 → Jun27)'))).toBe(true)
    expect(texto.some((t) => t.includes('ProdutoBTE-EzuGo (Set/Out26 → Jun28)'))).toBe(true)
  })

  it('cada linha candidata Aberta tem exatamente 1 GO escrito; Fechados não têm GO', async () => {
    await gerarDocumentoAprovacaoInterna({ client, simulacoes: [{ simulation: btn, pontoConsumo: cpe('p2', 'PT-BTN-0002') }], comercializadoraNome })
    const gos = todoOTexto().filter((t) => t.startsWith('GO utilizado'))
    expect(gos).toEqual(['GO utilizado: 9 €/MWh'])
  })

  it('linha candidata Aberta sem GO gravado (simulação antiga) mostra "GO utilizado: —", nunca fica em branco', async () => {
    const antiga = simulacao({
      id: 'sim-antiga',
      segmento: 'BTE',
      resultados: [
        linha({ product_id: 'ezu-bte', produto_nome: 'ProdutoBTE-EzuGo', tipo: 'ABERTO_FIXO', variant_id: 'v27', go_override: null, go_fixado: false, candidata: true, escolhida: true }),
        linha({ product_id: 'ezu-z', produto_nome: 'ProdutoBTE-Fechado', tipo: 'FECHADO', go_override: null, candidata: true }),
      ],
    })
    await gerarDocumentoAprovacaoInterna({ client, simulacoes: [{ simulation: antiga, pontoConsumo: cpe('p1', 'PT-BTE-0001') }], comercializadoraNome })
    expect(todoOTexto().filter((t) => t.startsWith('GO utilizado'))).toEqual(['GO utilizado: —'])
  })

  it('CPE sem candidatas mostra o aviso em vez de ficar vazia', async () => {
    const semCandidatas = { ...bte, resultados: bte.resultados.map((l) => ({ ...l, candidata: false })) }
    await gerarDocumentoAprovacaoInterna({ client, simulacoes: [{ simulation: semCandidatas, pontoConsumo: cpe('p1', 'PT-BTE-0001') }], comercializadoraNome })
    expect(todoOTexto()).toContain('Nenhuma opção marcada como candidata para esta CPE.')
  })

  it('multi-CPE com segmentos diferentes: cada CPE na sua página, sem produtos de outro segmento', async () => {
    await gerarDocumentoAprovacaoInterna({
      client,
      simulacoes: [
        { simulation: bte, pontoConsumo: cpe('p1', 'PT-BTE-0001') },
        { simulation: btn, pontoConsumo: cpe('p2', 'PT-BTN-0002') },
      ],
      comercializadoraNome,
    })
    const pag1 = todoOTexto(1).join('\n')
    const pag2 = todoOTexto(2).join('\n')
    expect(pag1).toContain('Segmento: BTE')
    expect(pag1).toContain('ProdutoBTE-EzuGo')
    expect(pag1).not.toContain('ProdutoBTN')
    expect(pag2).toContain('Segmento: BTN')
    expect(pag2).toContain('ProdutoBTN-BtnGo')
    expect(pag2).not.toContain('ProdutoBTE')
  })
})
