import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { EnergyItLogo } from '@/components/ui/EnergyItLogo'
import { LanguageToggle } from '@/components/layout/LanguageToggle'

export function RegisterPage() {
  const { user, signUp } = useAuth()
  const { t } = useLanguage()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signUp(email, password, nome)
    setLoading(false)
    if (error) setError(error)
    else setSuccess(true)
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
          <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{t.register.title}</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.register.subtitle}</p>

          {success ? (
            <Alert tone="success" title={t.register.confirmEmailTitle}>
              {t.register.confirmEmailBody(email)}
            </Alert>
          ) : (
            <>
              {error && (
                <div className="mb-4">
                  <Alert tone="danger">{error}</Alert>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nome">{t.register.name}</Label>
                  <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">{t.register.email}</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password">{t.register.password}</Label>
                  <PasswordInput
                    id="password"
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.register.submitting : t.register.submit}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.register.hasAccount}{' '}
            <Link to="/login" className="font-medium text-brand hover:underline dark:text-savings-dark">
              {t.register.loginLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
