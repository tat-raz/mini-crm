import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [profileState, setProfileState] = useState<{ userId: string; profile: Profile | null } | null>(null)

  // Подписка на вход/выход. Первое событие приходит сразу с текущей сессией
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setInitialized(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Загружаем профиль (роль, имя) для вошедшего пользователя
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error(error)
        setProfileState({ userId, profile: (data as Profile) ?? null })
      })
    return () => { cancelled = true }
  }, [userId])

  const profile = userId && profileState?.userId === userId ? profileState.profile : null
  const loading = !initialized || (!!userId && profileState?.userId !== userId)

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useProfile(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('No profile')
  return profile
}