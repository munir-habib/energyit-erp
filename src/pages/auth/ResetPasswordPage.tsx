import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Field'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Alert } from '@/components/ui/Alert'
import { EnergyItLogo } from '@/components/ui/EnergyItLogo'
import { FullPageSpinner } from '@/components/layout/RouteGuards'

const BG = { background: 'linear-gradient(135deg,#0F2A1D 0%,#16543A 45%,#2E6B4A 75%,#C9A24B 130%)' }

/** Destino do link de recuperação enviado por email: o Supabase abre uma sessão temporária e aqui define-se a nova password. */
export function ResetPasswordPage() {
  const { user, loading: authLoading, updatePassword } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (authLoading) return <FullPageSpinner />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) setError(/different from the old/i.test(error) ? t.reset.samePassword : error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={BG}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <EnergyItLogo light />
        </div>
        <div className="rounded-card border border-slate-200 bg-surface-card p-6 shadow-lg dark:bg-surface-dark-card">
          <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{t.reset.title}</h1>
          {user ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              <div>
                <Label htmlFor="password">{t.reset.newPassword}</Label>
                <PasswordInput id="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t.reset.submitting : t.reset.submit}
              </Button>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <Alert tone="warning">{t.reset.invalidLink}</Alert>
              <Link to="/recuperar-password" className="block text-center text-sm font-medium text-brand hover:underline dark:text-savings-dark">
                {t.reset.requestNew}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
