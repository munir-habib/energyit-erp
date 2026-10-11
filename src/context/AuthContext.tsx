import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import type { Profile } from '@/types/database'
import { applySessionPolicy, clearSessionPolicy, sessionExpired } from '@/lib/sessionPolicy'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signInWithPassword: (email: string, password: string, keepSignedIn?: boolean) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>
  /** true/false se o email tem conta; null se não foi possível verificar. */
  emailRegistered: (email: string) => Promise<boolean | null>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data as Profile | null)
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data.session && sessionExpired()) {
        clearSessionPolicy()
        await supabase.auth.signOut()
        if (mounted) setLoading(false)
        return
      }
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    // Sessão deixada aberta: verifica de minuto a minuto se o mês expirou.
    const timer = setInterval(() => {
      if (sessionExpired()) {
        clearSessionPolicy()
        void supabase.auth.signOut()
      }
    }, 60_000)

    return () => {
      mounted = false
      clearInterval(timer)
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      async signInWithGoogle() {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
      },
      async signInWithPassword(email, password, keepSignedIn = false) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (!error) applySessionPolicy(keepSignedIn)
        // Erro do servidor (5xx) não é "password errada": não deixar o utilizador achar que se enganou.
        if (error && (error.status ?? 0) >= 500) {
          return { error: 'Erro no servidor de autenticação (não é a sua password). Contacte o suporte.' }
        }
        return { error: error?.message ?? null }
      },
      async signUp(email, password, nome) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: nome } },
        })
        return { error: error?.message ?? null }
      },
      async emailRegistered(email) {
        const { data, error } = await supabase.rpc('email_registered', { p_email: email })
        return error ? null : Boolean(data)
      },
      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/redefinir-password',
        })
        return { error: error?.message ?? null }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        return { error: error?.message ?? null }
      },
      async signOut() {
        clearSessionPolicy()
        await supabase.auth.signOut()
      },
      async refreshProfile() {
        if (session?.user) await loadProfile(session.user.id)
      },
    }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
