/**
 * Validadores puros para feedback em tempo real nos formulários (ver `Input`/`Select` em
 * components/ui/Field.tsx e o hook `useFieldFeedback`).
 *
 * Convenção de retorno — `ValidationResult`:
 *  - `{ status: 'valid' }`             → valor preenchido e correto (✓ verde no campo)
 *  - `{ status: 'error', message }`    → valor inválido (bloqueia o submit onde o formulário o verificar)
 *  - `{ status: 'warning', message }`  → valor aceitável mas invulgar (nunca bloqueia)
 *  - `{}`                              → nada a dizer (campo opcional vazio)
 */
import type { Segmento } from '@/types/database'

export type FieldStatus = 'valid' | 'error' | 'warning'

export interface ValidationResult {
  status?: FieldStatus
  message?: string
}

const VALID: ValidationResult = { status: 'valid' }
const NONE: ValidationResult = {}
const error = (message: string): ValidationResult => ({ status: 'error', message })
const warning = (message: string): ValidationResult => ({ status: 'warning', message })

/** true se algum resultado é erro — útil para desativar o botão de submit. */
export function temErros(...resultados: ValidationResult[]): boolean {
  return resultados.some((r) => r.status === 'error')
}

function vazio(v: string | number | null | undefined): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && Number.isNaN(v))
}

// ---------------------------------------------------------------------------
// Texto genérico
// ---------------------------------------------------------------------------

export function validarObrigatorio(valor: string | null | undefined, rotulo = 'Campo'): ValidationResult {
  return vazio(valor) ? error(`${rotulo} obrigatório`) : VALID
}

/** Nome de cliente/produto: obrigatório, pelo menos 2 caracteres visíveis. */
export function validarNome(nome: string | null | undefined, { obrigatorio = true } = {}): ValidationResult {
  if (vazio(nome)) return obrigatorio ? error('Nome obrigatório') : NONE
  if (nome!.trim().length < 2) return error('Nome demasiado curto')
  return VALID
}

// ---------------------------------------------------------------------------
// NIF (Número de Identificação Fiscal, Portugal)
// ---------------------------------------------------------------------------

/** Prefixos válidos do NIF português (1.º dígito, ou 2 primeiros quando o 1.º é 4/7/9). */
const NIF_PREFIXO_1 = new Set(['1', '2', '3', '5', '6', '8'])
const NIF_PREFIXO_2 = new Set(['45', '70', '71', '72', '74', '75', '77', '78', '79', '90', '91', '98', '99'])

export function normalizarNIF(nif: string): string {
  return nif.replace(/\s+/g, '').replace(/^PT/i, '')
}

/**
 * NIF português: 9 dígitos, prefixo válido e dígito de controlo mod 11
 * (pesos 9..2 nos 8 primeiros dígitos; controlo = 11 − soma mod 11, e 0 se der 10 ou 11).
 * Aceita espaços e prefixo "PT". Vazio → sem feedback, exceto se `obrigatorio`.
 */
export function validarNIF(nif: string | null | undefined, { obrigatorio = false } = {}): ValidationResult {
  if (vazio(nif)) return obrigatorio ? error('NIF obrigatório') : NONE
  const n = normalizarNIF(nif!)
  if (!/^\d+$/.test(n)) return error('O NIF só pode ter dígitos')
  if (n.length !== 9) return error(`O NIF tem 9 dígitos (tem ${n.length})`)
  if (!NIF_PREFIXO_1.has(n[0]) && !NIF_PREFIXO_2.has(n.slice(0, 2))) return error('Prefixo de NIF inválido')
  let soma = 0
  for (let i = 0; i < 8; i++) soma += Number(n[i]) * (9 - i)
  const resto = soma % 11
  const controlo = resto < 2 ? 0 : 11 - resto
  if (controlo !== Number(n[8])) return error('NIF inválido (dígito de controlo não confere)')
  return VALID
}

// ---------------------------------------------------------------------------
// Contacto / email
// ---------------------------------------------------------------------------

export function validarEmail(email: string | null | undefined, { obrigatorio = false } = {}): ValidationResult {
  if (vazio(email)) return obrigatorio ? error('Email obrigatório') : NONE
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email!.trim()) ? VALID : error('Email inválido')
}

/**
 * Campo "Contacto" livre: aceita email ou telefone. Com "@" valida como email (erro se mal
 * formado); caso contrário, telefone PT (9 dígitos a começar por 2 ou 9, com ou sem +351/00351)
 * ou internacional (+ e 7–15 dígitos). Outro formato → aviso (não bloqueia: pode ser um nome).
 */
export function validarContacto(contacto: string | null | undefined): ValidationResult {
  if (vazio(contacto)) return NONE
  const c = contacto!.trim()
  if (c.includes('@')) return validarEmail(c)
  const tel = c.replace(/[\s().-]/g, '')
  const nacional = tel.replace(/^(\+351|00351)/, '')
  if (/^[29]\d{8}$/.test(nacional)) return VALID
  if (/^\+\d{7,15}$/.test(tel)) return VALID
  return warning('Formato não reconhecido — use email ou telefone')
}

// ---------------------------------------------------------------------------
// CPE (Código de Ponto de Entrega)
// ---------------------------------------------------------------------------

export function normalizarCPE(cpe: string): string {
  return cpe.replace(/\s+/g, '').toUpperCase()
}

/**
 * CPE de eletricidade: "PT" + 16 dígitos + 2 letras de controlo (20 caracteres), p.ex.
 * PT0002000012345678AB. Aceita espaços e minúsculas, e um sufixo opcional de 2 caracteres
 * (dígito + letra, p.ex. "1P"), usado em alguns documentos. As letras de controlo não são
 * recalculadas — só o formato.
 */
export function validarCPE(cpe: string | null | undefined, { obrigatorio = false } = {}): ValidationResult {
  if (vazio(cpe)) return obrigatorio ? error('CPE obrigatório') : NONE
  const c = normalizarCPE(cpe!)
  if (!c.startsWith('PT')) return error('O CPE começa por "PT"')
  if (/^PT\d{16}[A-Z]{2}(\d[A-Z])?$/.test(c)) return VALID
  if (c.length !== 20 && c.length !== 22) return error(`O CPE tem 20 caracteres: PT + 16 dígitos + 2 letras (tem ${c.length})`)
  return error('Formato de CPE inválido: PT + 16 dígitos + 2 letras')
}

// ---------------------------------------------------------------------------
// Potência contratada
// ---------------------------------------------------------------------------

/** Limite superior da BTN / inferior da BTE (kVA). */
export const LIMITE_BTN_KVA = 41.4
/** Menor escalão de potência BTN normalizado (kVA). */
export const MIN_BTN_KVA = 1.15

/**
 * Potência contratada (kVA), coerente com o segmento:
 *  - ≤ 0 / vazio → erro
 *  - BTN > 41,4 kVA → erro (acima disso é BTE); BTN < 1,15 kVA → aviso
 *  - BTE/MT ≤ 41,4 kVA → aviso (normalmente seria BTN)
 */
export function validarPotencia(kva: number | null | undefined, segmento?: Segmento | null): ValidationResult {
  if (kva === null || kva === undefined || Number.isNaN(kva)) return error('Indique a potência contratada')
  if (!Number.isFinite(kva) || kva <= 0) return error('A potência tem de ser superior a 0')
  if (segmento === 'BTN') {
    if (kva > LIMITE_BTN_KVA) return error('BTN vai até 41,4 kVA — acima disso é BTE')
    if (kva < MIN_BTN_KVA) return warning('Abaixo do menor escalão BTN (1,15 kVA)')
  } else if (segmento === 'BTE' || segmento === 'MT') {
    if (kva <= LIMITE_BTN_KVA) return warning(`Potência típica de BTN — confirme o segmento ${segmento}`)
  }
  return VALID
}

// ---------------------------------------------------------------------------
// Consumos
// ---------------------------------------------------------------------------

/** Consumo de um período (kWh): não pode ser negativo. Vazio/0 → sem feedback. */
export function validarConsumoPeriodo(kwh: number | null | undefined): ValidationResult {
  if (kwh === null || kwh === undefined || Number.isNaN(kwh) || kwh === 0) return NONE
  if (kwh < 0) return error('O consumo não pode ser negativo')
  return VALID
}

/**
 * Consumo médio diário "típico alto" por segmento (kWh/dia). ⚠️ ESTIMATIVA NÃO VALIDADA: não há
 * referência real no catálogo nem nos dados do negócio, é só uma heurística conservadora, à espera de
 * confirmação com os valores reais de referência:
 *  - BTN ≈ 30 kWh/dia (~11 MWh/ano — topo de uma casa grande / pequeno comércio)
 *  - BTE ≈ 800 kWh/dia (~300 MWh/ano)
 *  - MT  ≈ 8 000 kWh/dia (~3 GWh/ano)
 * O aviso só dispara acima de 3× este valor (`FATOR_FORA_DO_NORMAL`) e nunca bloqueia o preenchimento —
 * a mensagem mostrada ao consultor deixa isso explícito ("estimativa").
 */
export const CONSUMO_DIARIO_TIPICO_MAX: Partial<Record<Segmento, number>> = { BTN: 30, BTE: 800, MT: 8000 }
export const FATOR_FORA_DO_NORMAL = 3

/**
 * Aviso (nunca erro) quando o consumo do período faturado parece fora do normal — típico de
 * um engano de unidades (Wh vs kWh) ou de um zero a mais:
 *  - consumo médio diário > 3× o topo típico do segmento; ou
 *  - consumo médio diário > potência × 24h (mais energia do que a potência contratada permite
 *    fisicamente a 100% o dia inteiro).
 * Sem consumo, dias ou segmento → sem feedback.
 */
export function validarConsumoForaDoNormal({
  consumoTotalKwh,
  diasFaturados,
  segmento,
  potenciaKva,
}: {
  consumoTotalKwh: number
  diasFaturados: number
  segmento: Segmento | null | undefined
  potenciaKva?: number | null
}): ValidationResult {
  if (!segmento || !(consumoTotalKwh > 0) || !(diasFaturados > 0)) return NONE
  const diario = consumoTotalKwh / diasFaturados
  if (potenciaKva && potenciaKva > 0 && diario > potenciaKva * 24) {
    return warning(`Consumo médio de ${Math.round(diario)} kWh/dia excede o máximo possível com ${potenciaKva} kVA — confirme as unidades`)
  }
  const tipico = CONSUMO_DIARIO_TIPICO_MAX[segmento]
  if (tipico !== undefined && diario > tipico * FATOR_FORA_DO_NORMAL) {
    return warning(`Consumo médio de ${Math.round(diario)} kWh/dia parece alto para ${segmento} (estimativa, a confirmar) — reveja os valores`)
  }
  return NONE
}

/** Consumo anual (kWh) de um ponto de consumo: negativo → erro; fora do normal → aviso (estimativa). */
export function validarConsumoAnual(kwh: number | null | undefined, potenciaKva?: number | null): ValidationResult {
  if (kwh === null || kwh === undefined || Number.isNaN(kwh)) return NONE
  if (kwh < 0) return error('O consumo não pode ser negativo')
  if (kwh === 0) return NONE
  if (potenciaKva && potenciaKva > 0 && kwh > potenciaKva * 24 * 365) {
    return warning(`Excede o máximo possível com ${potenciaKva} kVA (estimativa, a confirmar) — confirme as unidades`)
  }
  return VALID
}

/** Dias faturados: ≥ 1 (erro); > 62 é invulgar para uma fatura (aviso). */
export function validarDiasFaturados(dias: number | null | undefined): ValidationResult {
  if (dias === null || dias === undefined || Number.isNaN(dias) || dias < 1) return error('Mínimo 1 dia')
  if (!Number.isInteger(dias)) return error('Use um número inteiro de dias')
  if (dias > 62) return warning('Período de faturação invulgarmente longo')
  return VALID
}

// ---------------------------------------------------------------------------
// Catálogo (Admin → Produtos)
// ---------------------------------------------------------------------------

/** Converte o valor em texto de um input numérico; '' → null. */
function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null
  const n = typeof v === 'number' ? v : Number(v.replace(',', '.'))
  return Number.isNaN(n) ? NaN : n
}

/**
 * Preço em €/kWh (preço-limite, preços do catálogo). Opcional. ≤ 0 → erro; > 1 €/kWh → aviso
 * (quase de certeza introduzido em €/MWh).
 */
export function validarPrecoKwh(v: string | number | null | undefined): ValidationResult {
  const n = num(v)
  if (n === null) return NONE
  if (Number.isNaN(n)) return error('Valor numérico inválido')
  if (n <= 0) return error('O preço tem de ser superior a 0')
  if (n > 1) return warning('Acima de 1 €/kWh — estará em €/MWh?')
  return VALID
}

/**
 * GO em €/MWh. O GO não tem um "valor normal" — é um número que o consultor/Admin ajusta de propósito
 * para equilibrar poupança do cliente e comissão, por isso não há aqui nenhum limite de "GO fora do
 * normal": o único aviso relevante sobre o GO é o já calculado no motor (`alertaGo`, quando o GO torna
 * o preço final pouco competitivo face ao preço-limite do produto) — não um limite arbitrário sobre o
 * próprio número. Este validador só confirma que o que foi escrito é mesmo um número.
 */
export function validarGo(v: string | number | null | undefined): ValidationResult {
  const n = num(v)
  if (n === null) return NONE
  if (Number.isNaN(n)) return error('Valor numérico inválido')
  return VALID
}

/** Margem em €/kWh sobre o índice. Opcional. Negativa → aviso; > 0,1 €/kWh → aviso (unidades?). */
export function validarMargem(v: string | number | null | undefined): ValidationResult {
  const n = num(v)
  if (n === null) return NONE
  if (Number.isNaN(n)) return error('Valor numérico inválido')
  if (n < 0) return warning('Margem negativa — confirme')
  if (n > 0.1) return warning('Margem acima de 0,1 €/kWh — estará em €/MWh?')
  return VALID
}

/** Valor opcional que não pode ser negativo (comissão fixa, prioridade…). */
export function validarNaoNegativo(v: string | number | null | undefined, { inteiro = false } = {}): ValidationResult {
  const n = num(v)
  if (n === null) return NONE
  if (Number.isNaN(n)) return error('Valor numérico inválido')
  if (n < 0) return error('Não pode ser negativo')
  if (inteiro && !Number.isInteger(n)) return error('Use um número inteiro')
  return VALID
}
