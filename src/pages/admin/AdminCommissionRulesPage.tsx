import { useState, type FormEvent } from 'react'
import { useCatalogTable } from '@/hooks/useAdminCatalog'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input, FormRow } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import type { CommissionRule } from '@/types/database'

type RuleDraft = {
  nome: string
  go_min: string
  go_max: string
  multiplicador: string
  valido_desde: string
  valido_ate: string
}

const emptyDraft: RuleDraft = {
  nome: '',
  go_min: '',
  go_max: '',
  multiplicador: '',
  valido_desde: new Date().toISOString().slice(0, 10),
  valido_ate: '',
}

export function AdminCommissionRulesPage() {
  const rules = useCatalogTable<CommissionRule>('commission_rules', 'valido_desde')
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await rules.insert.mutateAsync({
      nome: draft.nome,
      go_min: draft.go_min === '' ? null : Number(draft.go_min),
      go_max: draft.go_max === '' ? null : Number(draft.go_max),
      multiplicador: Number(draft.multiplicador),
      valido_desde: draft.valido_desde,
      valido_ate: draft.valido_ate === '' ? null : draft.valido_ate,
    })
    setDraft(emptyDraft)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Regras de Comissão</h1>

      <Card>
        <CardHeader title="Nova regra" subtitle="Comissão = Consumo Anual × (GO / 1000) × Multiplicador" />
        <CardBody>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <FormRow label="Nome">
              <Input required value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} />
            </FormRow>
            <FormRow label="GO mín.">
              <Input type="number" step="0.1" numeric value={draft.go_min} onChange={(e) => setDraft((d) => ({ ...d, go_min: e.target.value }))} />
            </FormRow>
            <FormRow label="GO máx.">
              <Input type="number" step="0.1" numeric value={draft.go_max} onChange={(e) => setDraft((d) => ({ ...d, go_max: e.target.value }))} />
            </FormRow>
            <FormRow label="Multiplicador">
              <Input
                type="number"
                step="0.001"
                required
                numeric
                value={draft.multiplicador}
                onChange={(e) => setDraft((d) => ({ ...d, multiplicador: e.target.value }))}
              />
            </FormRow>
            <FormRow label="Válido desde">
              <Input type="date" required value={draft.valido_desde} onChange={(e) => setDraft((d) => ({ ...d, valido_desde: e.target.value }))} />
            </FormRow>
            <FormRow label="Válido até (opcional)">
              <Input type="date" value={draft.valido_ate} onChange={(e) => setDraft((d) => ({ ...d, valido_ate: e.target.value }))} />
            </FormRow>
            <div className="col-span-2 flex items-end sm:col-span-1">
              <Button type="submit" disabled={rules.insert.isPending}>
                Criar
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">GO mín.</th>
                <th className="px-4 py-3 font-medium">GO máx.</th>
                <th className="px-4 py-3 font-medium">Multiplicador</th>
                <th className="px-4 py-3 font-medium">Vigência</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {(rules.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-medium">{r.nome}</td>
                  <td className="px-4 py-2.5 font-numeric">{r.go_min ?? '—'}</td>
                  <td className="px-4 py-2.5 font-numeric">{r.go_max ?? '—'}</td>
                  <td className="px-4 py-2.5 font-numeric">{r.multiplicador}</td>
                  <td className="px-4 py-2.5">
                    {formatDate(r.valido_desde)} — {r.valido_ate ? formatDate(r.valido_ate) : 'indeterminado'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="text-xs font-medium text-danger hover:underline"
                      onClick={() => confirm(`Eliminar a regra "${r.nome}"?`) && rules.remove.mutate(r.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {(rules.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma regra criada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
