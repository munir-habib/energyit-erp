import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Alert } from '@/components/ui/Alert'
import { EnergyItLogo } from '@/components/ui/EnergyItLogo'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { loadLoginPrefs, saveLoginPrefs } from '@/lib/sessionPolicy'

export function LoginPage() {
  const { user, signInWithPassword, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()
  const [prefs] = useState(loadLoginPrefs)
  const [email, setEmail] = useState(prefs.email)
  const [rememberEmail, setRememberEmail] = useState(prefs.rememberEmail)
  const [keepSignedIn, setKeepSignedIn] = useState(prefs.keepSignedIn)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    const from = (location.state as { from?: string })?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signInWithPassword(email, password, keepSignedIn)
    setLoading(false)
    if (error) setError(error)
    else saveLoginPrefs(rememberEmail, email.trim())
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#0F2A1D 0%,#16543A 45%,#2E6B4A 75%,#C9A24B 130%)' }}
    >
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <EnergyItLogo light />
        </div>
        <div className="rounded-card border border-slate-200 bg-surface-card p-6 shadow-lg dark:bg-surface-dark-card">
          <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{t.login.title}</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.login.subtitle}</p>

          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-surface-card px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-surface-muted dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-200 dark:hover:bg-white/10"
          >
            <GoogleIcon />
            {t.login.googleButton}
          </button>

          <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            {t.login.or}
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t.login.email}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t.login.password}</Label>
              <PasswordInput
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="mt-1.5 text-right">
                <Link to="/recuperar-password" className="text-xs font-medium text-brand hover:underline dark:text-savings-dark">
                  {t.login.forgotPassword}
                </Link>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={rememberEmail} onChange={(e) => setRememberEmail(e.target.checked)} />
                {t.login.rememberEmail}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                {t.login.keepSignedIn}
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.login.submitting : t.login.submit}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.login.noAccount}{' '}
            <Link to="/registar" className="font-medium text-brand hover:underline dark:text-savings-dark">
              {t.login.registerLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
