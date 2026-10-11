import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { EnergyItLogo } from '@/components/ui/EnergyItLogo'

const BG = { background: 'linear-gradient(135deg,#0F2A1D 0%,#16543A 45%,#2E6B4A 75%,#C9A24B 130%)' }

export function ForgotPasswordPage() {
  const { resetPassword, emailRegistered } = useAuth()
  const [notRegistered, setNotRegistered] = useState(false)
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // Só envia o link se o email tiver conta; se a verificação falhar (null) segue em frente na mesma.
    const registered = await emailRegistered(email)
    if (registered === false) {
      setLoading(false)
      setNotRegistered(true)
      return
    }
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={BG}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <EnergyItLogo light />
        </div>
        <div className="rounded-card border border-slate-200 bg-surface-card p-6 shadow-lg dark:bg-surface-dark-card">
          <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{t.forgot.title}</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{t.forgot.subtitle}</p>
          {sent ? (
            <Alert tone="success">{t.forgot.sent(email)}</Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              {notRegistered && (
                <Alert tone="warning">
                  {t.forgot.notRegistered}{' '}
                  <Link to="/registar" className="font-medium underline">
                    {t.forgot.createAccount}
                  </Link>
                </Alert>
              )}
              <div>
                <Label htmlFor="email">{t.login.email}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setNotRegistered(false)
                  }}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t.forgot.submitting : t.forgot.submit}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-medium text-brand hover:underline dark:text-savings-dark">
              {t.forgot.backToLogin}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
