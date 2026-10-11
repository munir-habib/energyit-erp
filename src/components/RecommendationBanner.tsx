import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { pickRecomendacao } from '@/lib/recommendation'
import { formatEur, formatPct } from '@/lib/format'
import type { NormalizedRow } from '@/pages/simulations/ResultsTable'

/** Banner informativo com o melhor tarifário e eventuais alternativas muito próximas — nunca fecha nada sozinho. */
export function RecommendationBanner({
  rows,
  onMarcarEscolhida,
}: {
  rows: NormalizedRow[]
  /** Quando presente, mostra "Marcar como escolhida" para a linha recomendada (sem sair do ecrã). */
  onMarcarEscolhida?: (lineKey: string) => void
}) {
  if (rows.length > 0 && rows.every((r) => r.custoAtualIndefinido)) {
    return (
      <Alert tone="warning" title="Sem comparação disponível">
        Insira o custo atual pago pelo cliente para calcular a poupança e ver o tarifário recomendado.
      </Alert>
    )
  }

  const { melhor, alternativas } = pickRecomendacao(rows)
  if (!melhor) return null

  return (
    <Alert tone="info" title="Melhor tarifário recomendado">
      <p>
        <strong>
          {melhor.comercializadora} — {melhor.nome}
        </strong>
        , poupança estimada de {formatEur(melhor.poupancaEurAno)}/ano ({formatPct(melhor.poupancaPct)})
      </p>
      {onMarcarEscolhida &&
        (melhor.escolhida ? (
          <p className="mt-1.5 text-xs font-medium text-savings dark:text-savings-dark">✓ Marcada como escolhida</p>
        ) : (
          <Button size="sm" className="mt-2" onClick={() => onMarcarEscolhida(melhor.lineKey)}>
            ✓ Marcar como escolhida
          </Button>
        ))}
      {alternativas.map((alt) => (
        <p key={alt.productId} className="mt-1 text-slate-600 dark:text-slate-300">
          Também compensa considerar <strong>{alt.comercializadora} — {alt.nome}</strong>, poupança muito semelhante
          ({formatEur(alt.poupancaEurAno)}/ano · {formatPct(alt.poupancaPct)}).
        </p>
      ))}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A decisão final é sempre sua — o sistema nunca fecha nada sozinho.</p>
    </Alert>
  )
}
