import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Isolamento por conta (RLS) — teste REAL contra o Supabase do projeto, só com a anon key de .env.
 *
 * Opt-in: só corre com RUN_RLS_TESTS=1 (ex: `RUN_RLS_TESTS=1 npx vitest run src/test/rls.test.ts`),
 * para a suite normal nunca depender de rede nem criar contas.
 *
 * Cria 2 contas NOVAS e descartáveis (qa-rls-<timestamp>-a/b@<RLS_TEST_EMAIL_DOMAIN, por omissão example.com>). Nunca usa a conta Admin
 * real nem nenhuma service role key, e só lê/escreve dados criados pelas próprias contas de teste.
 * No fim apaga os dados que criou (as contas em si só podem ser apagadas no painel do Supabase —
 * os emails são impressos na consola para isso).
 */
const env = import.meta.env as Record<string, string | undefined>
const ativo = env.RUN_RLS_TESTS === '1'
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

// RLS_TEST_RUN_ID + RLS_TEST_PASSWORD (opcionais) reutilizam as mesmas 2 contas numa 2ª execução — para
// projetos com "Confirm email" ligado: 1ª execução cria as contas (o Supabase envia os emails de
// confirmação), o utilizador confirma-as no inbox, e a 2ª execução com o mesmo id/password entra com
// signInWithPassword. Nunca usa service role nem contorna a confirmação.
const stamp = env.RLS_TEST_RUN_ID ?? String(Date.now())
// O Supabase rejeita @example.com como "invalid" — RLS_TEST_EMAIL_DOMAIN permite usar um domínio descartável seu.
// RLS_TEST_EMAIL_LOCAL (opcional) usa plus-addressing numa caixa real (ex: diogo → diogo+rls<ts>a@dominio),
// para os emails de confirmação chegarem a um inbox em vez de fazerem bounce. Sufixo único por execução.
const dominio = env.RLS_TEST_EMAIL_DOMAIN ?? 'example.com'
const local = env.RLS_TEST_EMAIL_LOCAL
const emailA = local ? `${local}+rls${stamp}a@${dominio}` : `qa-rls-${stamp}-a@${dominio}`
const emailB = local ? `${local}+rls${stamp}b@${dominio}` : `qa-rls-${stamp}-b@${dominio}`
const password = env.RLS_TEST_PASSWORD ?? `Qa-${stamp}-${Math.random().toString(36).slice(2)}!`

function novoCliente(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Cria a conta (ou entra nela, se já existir e estiver confirmada). null = conta criada mas ainda por confirmar. */
async function criarOuEntrar(email: string): Promise<SupabaseClient | null> {
  const sb = novoCliente()
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error && !/already registered/i.test(error.message)) throw new Error(`signUp de ${email} falhou: ${error.message}`)
  if (data?.session) return sb
  const login = await sb.auth.signInWithPassword({ email, password })
  if (login.data.session) return sb
  return null
}

async function criarContas(): Promise<[SupabaseClient, SupabaseClient]> {
  const [ca, cb] = [await criarOuEntrar(emailA), await criarOuEntrar(emailB)]
  if (!ca || !cb) {
    const porConfirmar = [ca ? null : emailA, cb ? null : emailB].filter(Boolean).join(', ')
    throw new Error(
      `O projeto exige confirmação por email — por confirmar: ${porConfirmar}. ` +
        'Ou (a) confirme estas contas pelos links enviados para o inbox e volte a correr com ' +
        `RLS_TEST_RUN_ID=${stamp} RLS_TEST_PASSWORD='${password}' (mesmas contas), ` +
        'ou (b) desative "Confirm email" em Authentication → Providers → Email.',
    )
  }
  return [ca, cb]
}

describe.skipIf(!ativo)('RLS — isolamento entre contas (Supabase real, contas descartáveis)', () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let clienteId: string | null = null
  let simulacaoId: string | null = null

  beforeAll(async () => {
    if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY em falta no .env')
    console.info(`[RLS] contas de teste: ${emailA}, ${emailB}`)
    ;[a, b] = await criarContas()

    const cli = await a.from('clients').insert({ nome: `QA RLS ${stamp}`, segmento_principal: 'BTE' }).select('id').single()
    if (cli.error) throw new Error(`conta A não conseguiu criar cliente: ${cli.error.message}`)
    clienteId = cli.data.id as string

    const sim = await a
      .from('simulations')
      .insert({ client_id: clienteId, segmento: 'BTE', esquema_horario: 'TETRA_HORARIO', consumo_periodo: { PONTA: 1 }, resultados: [] })
      .select('id')
      .single()
    if (sim.error) throw new Error(`conta A não conseguiu criar simulação: ${sim.error.message}`)
    simulacaoId = sim.data.id as string
  }, 60_000)

  afterAll(async () => {
    if (a && simulacaoId) await a.from('simulations').delete().eq('id', simulacaoId)
    if (a && clienteId) await a.from('clients').delete().eq('id', clienteId)
  })

  it('a conta A vê os seus próprios dados', async () => {
    const { data, error } = await a.from('clients').select('id').eq('id', clienteId!)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a conta B não consegue ler o cliente nem a simulação da conta A', async () => {
    const cli = await b.from('clients').select('id').eq('id', clienteId!)
    const sim = await b.from('simulations').select('id').eq('id', simulacaoId!)
    expect(cli.error).toBeNull()
    expect(cli.data).toEqual([])
    expect(sim.error).toBeNull()
    expect(sim.data).toEqual([])
  })

  it('a conta B não vê nenhum cliente da conta A numa listagem geral', async () => {
    const { data, error } = await b.from('clients').select('id')
    expect(error).toBeNull()
    expect((data ?? []).map((r) => r.id)).not.toContain(clienteId)
  })

  it('a conta B não consegue alterar nem apagar dados da conta A', async () => {
    const upd = await b.from('clients').update({ nome: 'alterado por B' }).eq('id', clienteId!).select('id')
    expect(upd.data ?? []).toEqual([])
    const del = await b.from('clients').delete().eq('id', clienteId!).select('id')
    expect(del.data ?? []).toEqual([])
    const { data } = await a.from('clients').select('nome').eq('id', clienteId!).single()
    expect(data?.nome).toBe(`QA RLS ${stamp}`)
  })
})
