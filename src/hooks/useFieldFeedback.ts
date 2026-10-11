import { useCallback, useState } from 'react'
import type { FieldStatus, ValidationResult } from '@/lib/validators'

/**
 * Decide *quando* mostrar o resultado de um validador (lib/validators.ts) num campo, para o
 * feedback ser em tempo real sem "gritar" com o utilizador antes de ele começar:
 *  - assim que o campo tem valor → o resultado aparece a cada tecla (onChange);
 *  - campo vazio → só depois de sair dele (onBlur) ou de tentar submeter (`marcarSubmetido`),
 *    para que "obrigatório" não apareça num formulário acabado de abrir.
 *
 * Uso:
 *   const fb = useFieldFeedback()
 *   const nif = validarNIF(values.nif)
 *   <Input value={values.nif} onChange={…} {...fb('nif', values.nif, nif)} />
 *
 * `fb(...)` devolve `{ status, message, onBlur }` para espalhar em `Input`/`Select`. Se o campo
 * já tiver um `onBlur` próprio, passe-o depois do spread e chame também `fb.tocar(nome)`.
 */
export function useFieldFeedback() {
  const [tocados, setTocados] = useState<ReadonlySet<string>>(() => new Set())
  const [submetido, setSubmetido] = useState(false)

  const tocar = useCallback((nome: string) => {
    setTocados((s) => (s.has(nome) ? s : new Set(s).add(nome)))
  }, [])

  function fb(
    nome: string,
    valor: unknown,
    resultado: ValidationResult,
  ): { status: FieldStatus | undefined; message: string | undefined; onBlur: () => void } {
    const temValor = valor !== null && valor !== undefined && String(valor).trim() !== ''
    const mostrar = temValor || submetido || tocados.has(nome)
    return {
      status: mostrar ? resultado.status : undefined,
      message: mostrar ? resultado.message : undefined,
      onBlur: () => tocar(nome),
    }
  }

  fb.tocar = tocar
  /** Chamar no submit: passa a mostrar também os erros dos campos vazios ainda não visitados. */
  fb.marcarSubmetido = () => setSubmetido(true)
  return fb
}
