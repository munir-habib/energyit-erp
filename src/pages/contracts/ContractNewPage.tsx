import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSimulation, useUpdateSimulation } from '@/hooks/useSimulations'
import { useClient } from '@/hooks/useClients'
import { useCreateContract } from '@/hooks/useContracts'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input, FormRow, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatEur, formatGo } from '@/lib/format'
import { precosCongeladosDaSimulacao } from '@/lib/contractLine'

export function ContractNewPage() {
  const [params] = useSearchParams()
  const simulationId = params.get('simulacao') ?? undefined
  const navigate = useNavigate()
  const { data: simulation } = useSimulation(simulationId)
  const { data: client } = useClient(simulation?.client_id ?? undefined)
  const createContract = useCreateContract()
  const updateSimulation = useUpdateSimulation()

  // Linha exata escolhida (Produto + Variante) — nunca só o produto, que pode ter várias variantes.
  const congelado = simulation ? precosCongeladosDaSimulacao(simulation) : null
  const linha = congelado?.precos

  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [duracaoMeses, setDuracaoMeses] = useState(12)
  const [potencia, setPotencia] = useState<number | ''>('')

  if (!simulation || !client || !linha) {
    return (
      <Alert tone="warning">
        Selecione primeiro um produto numa simulação para poder gerar o contrato.
      </Alert>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const dataFim = new Date(dataInicio)
    dataFim.setMonth(dataFim.getMonth() + duracaoMeses)

    const id = await createContract.mutateAsync({
      client_id: simulation!.client_id!,
      simulation_id: simulation!.id,
      product_id: congelado!.productId,
      precos_congelados: congelado!.precos,
      potencia_contratada_kva: potencia === '' ? null : potencia,
      data_inicio: dataInicio,
      data_fim: dataFim.toISOString().slice(0, 10),
      estado: 'ATIVO',
    })
    await updateSimulation.mutateAsync({ id: simulation!.id, values: { estado: 'CONVERTIDA' } })
    navigate(`/contratos/${id}`)
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Novo contrato</h1>

      <Card>
        <CardHeader title="Resumo" subtitle={client.nome} />
        <CardBody className="space-y-1 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Produto:{' '}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {linha.produto_nome}
              {linha.variant_label ? ` (${linha.variant_label})` : ''}
            </span>
          </p>
          {linha.tipo !== 'FECHADO' && (
            <p className="text-slate-600 dark:text-slate-300">
              GO: <span className="font-numeric">{formatGo(linha.go_override)}</span>
            </p>
          )}
          <p className="text-slate-600 dark:text-slate-300">
            Custo de energia do período: <span className="font-numeric">{formatEur(linha.custo_energia_periodo)}</span>
          </p>
          <p className="text-savings dark:text-savings-dark">
            Poupança estimada: <span className="font-numeric font-semibold">{formatEur(linha.poupanca_eur_ano)} / ano</span>
          </p>
        </CardBody>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Detalhes do contrato" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Data de início">
                <Input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </FormRow>
              <FormRow label="Duração">
                <Select value={duracaoMeses} onChange={(e) => setDuracaoMeses(Number(e.target.value))}>
                  <option value={12}>12 meses</option>
                  <option value={18}>18 meses</option>
                  <option value={24}>24 meses</option>
                </Select>
              </FormRow>
            </div>
            <FormRow label="Potência contratada (kVA)">
              <Input
                type="number"
                step="0.01"
                numeric
                value={potencia}
                onChange={(e) => setPotencia(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </FormRow>
          </CardBody>
        </Card>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createContract.isPending}>
            {createContract.isPending ? 'A criar…' : 'Criar contrato'}
          </Button>
        </div>
      </form>
    </div>
  )
}
