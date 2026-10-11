export interface FieldDef {
  key: string
  label: string
  required?: boolean
  synonyms: string[]
  type: 'text' | 'number' | 'date' | 'enum'
  enumValues?: string[]
}

export const CLIENT_FIELDS: FieldDef[] = [
  { key: 'nome', label: 'Nome', required: true, synonyms: ['nome', 'cliente', 'nome cliente', 'name'], type: 'text' },
  { key: 'nif', label: 'NIF', synonyms: ['nif', 'contribuinte'], type: 'text' },
  { key: 'morada', label: 'Morada', synonyms: ['morada', 'endereco', 'endereço', 'address'], type: 'text' },
  { key: 'contacto', label: 'Contacto', synonyms: ['contacto', 'telefone', 'email', 'contact'], type: 'text' },
  { key: 'cpe', label: 'CPE', synonyms: ['cpe'], type: 'text' },
  { key: 'cui', label: 'CUI', synonyms: ['cui'], type: 'text' },
  {
    key: 'segmento_principal',
    label: 'Segmento',
    synonyms: ['segmento', 'segmento_principal', 'segment'],
    type: 'enum',
    enumValues: ['BTN', 'BTE', 'MT', 'GAS'],
  },
]

export const CONTRACT_FIELDS: FieldDef[] = [
  { key: 'cliente_ref', label: 'Cliente (NIF ou nome)', required: true, synonyms: ['cliente', 'nif', 'cliente_nif', 'nome cliente'], type: 'text' },
  { key: 'produto_nome', label: 'Produto (nome, opcional)', synonyms: ['produto', 'produto_nome', 'product'], type: 'text' },
  { key: 'data_inicio', label: 'Data de início', required: true, synonyms: ['data_inicio', 'inicio', 'data inicio', 'start'], type: 'date' },
  { key: 'data_fim', label: 'Data de fim', synonyms: ['data_fim', 'fim', 'data fim', 'end'], type: 'date' },
  { key: 'potencia_contratada_kva', label: 'Potência (kVA)', synonyms: ['potencia', 'potencia_contratada_kva', 'kva'], type: 'number' },
  {
    key: 'estado',
    label: 'Estado',
    synonyms: ['estado', 'status'],
    type: 'enum',
    enumValues: ['ATIVO', 'TERMINADO', 'CANCELADO'],
  },
]

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function autoMapColumns(headers: string[], fields: FieldDef[]): Record<number, string | null> {
  const mapping: Record<number, string | null> = {}
  headers.forEach((h, i) => {
    const norm = normalize(h)
    const match = fields.find((f) => f.synonyms.some((s) => normalize(s) === norm))
    mapping[i] = match?.key ?? null
  })
  return mapping
}

export interface RowValidationResult {
  values: Record<string, string>
  errors: Record<string, string>
  valid: boolean
}

export function validateRow(row: string[], mapping: Record<number, string | null>, fields: FieldDef[]): RowValidationResult {
  const values: Record<string, string> = {}
  row.forEach((cell, i) => {
    const key = mapping[i]
    if (key) values[key] = (cell ?? '').toString().trim()
  })

  const errors: Record<string, string> = {}
  for (const f of fields) {
    const v = values[f.key] ?? ''
    if (f.required && !v) {
      errors[f.key] = 'obrigatório'
      continue
    }
    if (!v) continue
    if (f.type === 'number' && Number.isNaN(Number(v.replace(',', '.')))) errors[f.key] = 'número inválido'
    if (f.type === 'date' && Number.isNaN(Date.parse(v))) errors[f.key] = 'data inválida'
    if (f.type === 'enum' && f.enumValues && !f.enumValues.includes(v.toUpperCase())) {
      errors[f.key] = `deve ser um de: ${f.enumValues.join(', ')}`
    }
  }
  return { values, errors, valid: Object.keys(errors).length === 0 }
}
