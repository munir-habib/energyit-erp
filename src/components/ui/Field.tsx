import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'
import type { FieldStatus } from '@/lib/validators'

export type { FieldStatus }

/**
 * Props de validação opcionais, partilhadas por `Input` e `Select`. Sem elas (todas as call sites
 * antigas) o campo renderiza exatamente como antes.
 *  - `status`: 'valid' → contorno verde + ✓ dentro do campo (só Input);
 *              'error' → contorno vermelho + `message` por baixo (aria-invalid);
 *              'warning' → contorno âmbar + `message` por baixo (não bloqueia).
 *  - `message`: texto curto mostrado por baixo do campo (ignorado quando `status` é 'valid').
 * Use o hook `useFieldFeedback` (hooks/useFieldFeedback.ts) para decidir *quando* mostrar o
 * resultado de um validador de lib/validators.ts em tempo real (ao escrever / ao sair do campo).
 */
export interface FieldValidationProps {
  status?: FieldStatus
  message?: ReactNode
}

const fieldLayoutClasses =
  'w-full rounded-[10px] border bg-surface-card px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 dark:bg-surface-dark-muted dark:text-slate-100'

/** Cores de contorno/anel por estado — cada uma com o par `dark:` (tokens em index.css). */
const statusBorderClasses: Record<FieldStatus | 'neutral', string> = {
  neutral: 'border-slate-200 focus:border-brand focus:ring-brand/15 dark:border-white/10',
  valid:
    'border-field-valid focus:border-field-valid focus:ring-field-valid/20 dark:border-field-valid-dark dark:focus:border-field-valid-dark dark:focus:ring-field-valid-dark/25',
  error:
    'border-field-error ring-1 ring-field-error/30 focus:border-field-error focus:ring-field-error/25 dark:border-field-error-dark dark:ring-field-error-dark/40 dark:focus:ring-field-error-dark/30',
  warning:
    'border-field-warning ring-1 ring-field-warning/30 focus:border-field-warning focus:ring-field-warning/25 dark:border-field-warning-dark dark:ring-field-warning-dark/40 dark:focus:ring-field-warning-dark/30',
}

function fieldClasses(status: FieldStatus | undefined) {
  return clsx(fieldLayoutClasses, statusBorderClasses[status ?? 'neutral'])
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
      {children}
    </label>
  )
}

/**
 * Mensagem curta de validação por baixo de um campo (ou de um grupo de campos). Aceita o texto
 * como `children` ou `message`, para se poder espalhar diretamente um ValidationResult:
 * `<FieldMessage {...validarConsumoForaDoNormal(…)} />`.
 */
export function FieldMessage({
  status,
  message,
  children,
  id,
}: {
  status?: FieldStatus
  message?: ReactNode
  children?: ReactNode
  id?: string
}) {
  const texto = children ?? message
  if (!texto || !status || status === 'valid') return null
  return (
    <p
      id={id}
      role={status === 'error' ? 'alert' : undefined}
      className={clsx(
        'mt-1 flex items-start gap-1 text-xs font-medium',
        status === 'error' ? 'text-field-error dark:text-field-error-dark' : 'text-field-warning dark:text-field-warning-dark',
      )}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0">
        {status === 'error' ? (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 8.5a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M8.26 3.1c.77-1.34 2.7-1.34 3.47 0l6.03 10.45c.77 1.33-.19 3-1.73 3H3.97c-1.54 0-2.5-1.67-1.73-3L8.26 3.1zM10 7a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 8a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z"
            clipRule="evenodd"
          />
        )}
      </svg>
      <span>{texto}</span>
    </p>
  )
}

/*
 * Input/Select devolvem sempre um Fragment com o campo como 1.º filho: assim o elemento do
 * campo nunca é remontado quando a mensagem aparece/desaparece (o foco não se perde a meio da
 * escrita) e não há wrapper extra — os layouts existentes (grid/flex, className no campo) ficam
 * iguais. O ✓ do estado válido é um background-image (classe .field-icon-valid em index.css).
 */

export function Input({
  className,
  numeric,
  status,
  message,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { numeric?: boolean } & FieldValidationProps) {
  const autoId = useId()
  const showMessage = !!message && (status === 'error' || status === 'warning')
  const messageId = `${rest.id ?? autoId}-msg`
  return (
    <>
      <input
        className={clsx(fieldClasses(status), numeric && 'font-numeric', status === 'valid' && 'field-icon-valid', className)}
        aria-invalid={status === 'error' ? true : undefined}
        aria-describedby={showMessage ? messageId : rest['aria-describedby']}
        {...rest}
      />
      {showMessage && (
        <FieldMessage status={status} id={messageId}>
          {message}
        </FieldMessage>
      )}
    </>
  )
}

export function Select({ className, children, status, message, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & FieldValidationProps) {
  const autoId = useId()
  const showMessage = !!message && (status === 'error' || status === 'warning')
  const messageId = `${rest.id ?? autoId}-msg`
  return (
    <>
      <select
        className={clsx(fieldClasses(status), className)}
        aria-invalid={status === 'error' ? true : undefined}
        aria-describedby={showMessage ? messageId : rest['aria-describedby']}
        {...rest}
      >
        {children}
      </select>
      {showMessage && (
        <FieldMessage status={status} id={messageId}>
          {message}
        </FieldMessage>
      )}
    </>
  )
}

export function FormRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
