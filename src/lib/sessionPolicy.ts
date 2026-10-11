/**
 * Política de duração da sessão escolhida no login:
 *  - "manter ligado": a sessão vale 30 dias a partir do login; depois faz logout automático.
 *  - sem a opção: a sessão acaba ao fechar o browser (marcador em sessionStorage).
 * Sem política guardada (sessões antigas, login Google) nada é forçado.
 * Tudo em try/catch: com o armazenamento bloqueado a app funciona, só sem esta regra.
 */
const KEEP_UNTIL = 'energyit-keep-until'
const SESSION_ONLY = 'energyit-session-only'
const ALIVE = 'energyit-session-alive'
const REMEMBER_EMAIL = 'energyit-remember-email'
const LAST_EMAIL = 'energyit-last-email'
const KEEP_CHOICE = 'energyit-keep-choice'

export const KEEP_SIGNED_IN_MS = 30 * 24 * 60 * 60 * 1000

function get(storage: 'local' | 'session', key: string): string | null {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key)
  } catch {
    return null
  }
}
function set(storage: 'local' | 'session', key: string, value: string | null) {
  try {
    const s = storage === 'local' ? localStorage : sessionStorage
    if (value === null) s.removeItem(key)
    else s.setItem(key, value)
  } catch {
    /* armazenamento indisponível */
  }
}

/** Chamado depois de um login com password bem-sucedido. */
export function applySessionPolicy(keepSignedIn: boolean) {
  set('local', KEEP_CHOICE, keepSignedIn ? '1' : '0')
  if (keepSignedIn) {
    set('local', KEEP_UNTIL, String(Date.now() + KEEP_SIGNED_IN_MS))
    set('local', SESSION_ONLY, null)
  } else {
    set('local', KEEP_UNTIL, null)
    set('local', SESSION_ONLY, '1')
    set('session', ALIVE, '1')
  }
}

/** true se a sessão atual já não é válida pela política escolhida e deve terminar. */
export function sessionExpired(): boolean {
  const until = Number(get('local', KEEP_UNTIL))
  if (until && Date.now() > until) return true
  if (get('local', SESSION_ONLY) === '1' && get('session', ALIVE) !== '1') return true
  return false
}

export function clearSessionPolicy() {
  set('local', KEEP_UNTIL, null)
  set('local', SESSION_ONLY, null)
  set('session', ALIVE, null)
}

/** Preferências do formulário de login — a última opção usada neste computador. */
export function loadLoginPrefs(): { rememberEmail: boolean; email: string; keepSignedIn: boolean } {
  const rememberEmail = get('local', REMEMBER_EMAIL) !== '0'
  return {
    rememberEmail,
    email: rememberEmail ? (get('local', LAST_EMAIL) ?? '') : '',
    keepSignedIn: get('local', KEEP_CHOICE) === '1',
  }
}

export function saveLoginPrefs(rememberEmail: boolean, email: string) {
  set('local', REMEMBER_EMAIL, rememberEmail ? '1' : '0')
  set('local', LAST_EMAIL, rememberEmail ? email : null)
}
