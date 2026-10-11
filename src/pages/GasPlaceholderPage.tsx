import { Card, CardBody } from '@/components/ui/Card'

export function GasPlaceholderPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardBody className="space-y-2 py-10 text-center">
          <p className="text-4xl">🔥</p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Gás — em breve</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A simulação de Gás ainda não está disponível. Esta área será especificada e implementada numa próxima fase.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
