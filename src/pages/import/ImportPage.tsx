import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useClients } from '@/hooks/useClients'
import { useCatalog } from '@/hooks/useCatalog'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { parseSpreadsheet, type ParsedSheet } from '@/lib/importParser'
import { autoMapColumns, validateRow, CLIENT_FIELDS, CONTRACT_FIELDS, type FieldDef } from '@/lib/importValidation'

type Entity = 'clients' | 'contracts'

const FIELDS: Record<Entity, FieldDef[]> = { clients: CLIENT_FIELDS, contracts: CONTRACT_FIELDS }

export function ImportPage() {
  const qc = useQueryClient()
  const { data: clients } = useClients()
  const { data: catalog } = useCatalog()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [entity, setEntity] = useState<Entity>('clients')
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<Record<number, string | null>>({})
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<{ ok: number; falhas: { linha: number; erro: string }[] } | null>(null)
  const [importing, setImporting] = useState(false)

  const fields = FIELDS[entity]

  async function handleFile(file: File) {
    const sheet = await parseSpreadsheet(file)
    setParsed(sheet)
    setMapping(autoMapColumns(sheet.headers, fields))
    setExcluded(new Set())
    setResult(null)
  }

  function handleEntityChange(next: Entity) {
    setEntity(next)
    if (parsed) setMapping(autoMapColumns(parsed.headers, FIELDS[next]))
    setResult(null)
  }

  const validated = useMemo(() => {
    if (!parsed) return []
    return parsed.rows.map((row) => validateRow(row, mapping, fields))
  }, [parsed, mapping, fields])

  const validCount = validated.filter((r, i) => r.valid && !excluded.has(i)).length

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    const falhas: { linha: number; erro: string }[] = []
    let ok = 0

    for (let i = 0; i < validated.length; i++) {
      if (excluded.has(i) || !validated[i].valid) continue
      const { values } = validated[i]
      try {
        if (entity === 'clients') {
          const { error } = await supabase.from('clients').insert({
            nome: values.nome,
            nif: values.nif || null,
            morada: values.morada || null,
            contacto: values.contacto || null,
            cpe: values.cpe || null,
            cui: values.cui || null,
            segmento_principal: (values.segmento_principal || 'BTN').toUpperCase(),
          })
          if (error) throw error
        } else {
          const cliente = (clients ?? []).find(
            (c) => (c.nif && c.nif === values.cliente_ref) || c.nome.toLowerCase() === values.cliente_ref.toLowerCase(),
          )
          if (!cliente) throw new Error('cliente não encontrado')
          const produto = values.produto_nome
            ? catalog?.products.find((p) => p.nome.toLowerCase() === values.produto_nome.toLowerCase())
            : undefined
          const { error } = await supabase.from('contracts').insert({
            client_id: cliente.id,
            product_id: produto?.id ?? null,
            data_inicio: values.data_inicio,
            data_fim: values.data_fim || null,
            potencia_contratada_kva: values.potencia_contratada_kva ? Number(values.potencia_contratada_kva) : null,
            estado: (values.estado || 'ATIVO').toUpperCase(),
          })
          if (error) throw error
        }
        ok++
      } catch (e) {
        falhas.push({ linha: i + 2, erro: e instanceof Error ? e.message : 'erro desconhecido' })
      }
    }

    setResult({ ok, falhas })
    setImporting(false)
    qc.invalidateQueries({ queryKey: [entity] })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Importar dados</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Traga clientes ou contratos existentes de um ficheiro Excel/CSV. Linhas com erro ficam assinaladas mas não
          impedem a importação das restantes.
        </p>
      </div>

      <Card>
        <CardHeader title="1. Ficheiro" />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">O que está a importar?</label>
            <Select value={entity} onChange={(e) => handleEntityChange(e.target.value as Entity)} className="w-48">
              <option value="clients">Clientes</option>
              <option value="contracts">Contratos</option>
            </Select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Escolher ficheiro (.xlsx / .csv)
            </Button>
          </div>
        </CardBody>
      </Card>

      {parsed && (
        <>
          <Card>
            <CardHeader
              title="2. Mapeamento de colunas"
              subtitle="Cada coluna do ficheiro é sugerida automaticamente — corrija se necessário"
            />
            <CardBody>
              <div className="flex flex-wrap gap-3">
                {parsed.headers.map((h, i) => (
                  <div key={i} className="w-52">
                    <p className="mb-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400" title={h}>
                      {h || `Coluna ${i + 1}`}
                    </p>
                    <Select
                      value={mapping[i] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value || null }))}
                    >
                      <option value="">— ignorar —</option>
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? ' *' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="3. Pré-visualização"
              subtitle={`${validCount} de ${parsed.rows.length} linhas prontas para importar`}
            />
            <CardBody className="space-y-3">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200/70 uppercase tracking-wide text-slate-400 dark:border-white/5">
                    <tr>
                      <th className="px-2 py-2">Incluir</th>
                      {fields.map((f) => (
                        <th key={f.key} className="px-2 py-2 font-medium">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {validated.map((r, i) => (
                      <tr key={i} className={r.valid ? '' : 'bg-danger/5'}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={!excluded.has(i)}
                            onChange={(e) =>
                              setExcluded((s) => {
                                const next = new Set(s)
                                if (e.target.checked) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }
                          />
                        </td>
                        {fields.map((f) => (
                          <td key={f.key} className="px-2 py-1.5">
                            {r.values[f.key] ?? ''}
                            {r.errors[f.key] && <p className="text-danger">{r.errors[f.key]}</p>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button onClick={() => void handleImport()} disabled={importing || validCount === 0}>
                {importing ? 'A importar…' : `Importar ${validCount} linhas válidas`}
              </Button>

              {result && (
                <Alert tone={result.falhas.length === 0 ? 'success' : 'warning'}>
                  {result.ok} registo(s) importado(s) com sucesso.
                  {result.falhas.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                      {result.falhas.map((f, i) => (
                        <li key={i}>
                          Linha {f.linha}: {f.erro}
                        </li>
                      ))}
                    </ul>
                  )}
                </Alert>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
