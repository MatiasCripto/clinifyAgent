'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization, Clinic, UserRole } from '@/lib/types'

export interface AuthUser {
  user: User
  profile: Profile | null
  organization: Organization | null
  clinics: Clinic[]
  currentClinicId: string | null
  role: UserRole | null
}

interface AuthContextValue {
  authUser: AuthUser | null
  loading: boolean
  currentClinic: Clinic | null
  setCurrentClinic: (id: string) => void
  updateOrgName: (name: string) => void
  updateCurrentClinic: (updates: Partial<Clinic>) => void
  updateAvatarUrl: (url: string) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading]   = useState(true)
  const supabase = createClient()

  const loadUserData = useCallback(async (user: User) => {
    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const profile = profileRes.data as Profile | null

    const orgRes = profile?.organization_id
      ? await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
      : { data: null }
    const org = (orgRes.data as Organization | null) ?? null

    let clinics: Clinic[] = []
    if (org) {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('name')
      clinics = (data as Clinic[]) ?? []
    }

    const stored = typeof window !== 'undefined' ? localStorage.getItem('oc-current-clinic') : null
    const currentClinicId = (stored && clinics.find(c => c.id === stored))
      ? stored
      : clinics[0]?.id ?? null

    setAuthUser({ user, profile, organization: org, clinics, currentClinicId, role: profile?.role ?? null })
  }, [supabase])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUserData(session.user).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadUserData(session.user)
        if (event === 'SIGNED_IN') {
          fetch('/api/auth/log-session', { method: 'POST' }).catch(() => {})
        }
      } else {
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserData, supabase.auth])

  const setCurrentClinic = useCallback((clinicId: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('oc-current-clinic', clinicId)
    setAuthUser(prev => prev ? { ...prev, currentClinicId: clinicId } : prev)
  }, [])

  const updateOrgName = useCallback((name: string) => {
    setAuthUser(prev => prev?.organization
      ? { ...prev, organization: { ...prev.organization, name } }
      : prev)
  }, [])

  const updateAvatarUrl = useCallback((url: string) => {
    setAuthUser(prev => prev?.profile
      ? { ...prev, profile: { ...prev.profile, avatar_url: url } }
      : prev)
  }, [])

  const updateCurrentClinic = useCallback((updates: Partial<Clinic>) => {
    setAuthUser(prev => {
      if (!prev) return prev
      const id = prev.currentClinicId ?? prev.clinics[0]?.id
      return { ...prev, clinics: prev.clinics.map(c => c.id === id ? { ...c, ...updates } : c) }
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('oc-current-clinic')
      window.location.href = '/login'
    }
  }, [supabase.auth])

  const currentClinic = authUser?.clinics.find(c => c.id === authUser.currentClinicId)
    ?? authUser?.clinics[0]
    ?? null

  return (
    <AuthContext.Provider value={{ authUser, loading, currentClinic, setCurrentClinic, updateOrgName, updateCurrentClinic, updateAvatarUrl, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
