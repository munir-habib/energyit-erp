import { Input } from '@/components/ui/Field'

/**
 * Controlo de GO — valor inteiro livre, sem limite pré-definido. O slider cobre um intervalo prático
 * de arrasto (0–100), mas o campo numérico aceita qualquer inteiro maior ou igual a 0. O campo
 * numérico fica sempre dentro de uma caixa de largura fixa (`w-20 shrink-0`) — nunca a competir por
 * espaço com o slider via classes de largura conflituosas (`Input` já tem `w-full` por omissão;
 * sobrepor isso com outra classe de largura não é fiável, o vencedor depende da ordem em que o
 * Tailwind gera as classes, não da ordem em que aparecem aqui — por isso o número podia ficar
 * espremido/invisível quando este controlo era colocado num espaço apertado, ver correção do GO
 * "sempre visível na linha").
 */
export function GoSlider({
  value,
  onChange,
  sliderMax = 100,
}: {
  value: number
  onChange: (value: number) => void
  sliderMax?: number
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={1}
        value={Math.min(value, sliderMax)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 min-w-[3.5rem] flex-1 cursor-pointer accent-accent"
      />
      <div className="w-20 shrink-0">
        <Input
          type="number"
          step={1}
          min={0}
          numeric
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        />
      </div>
    </div>
  )
}
