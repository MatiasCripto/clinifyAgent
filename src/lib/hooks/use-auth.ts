'use client'

import { useAuthContext } from './auth-context'
import type { UserRole } from '@/lib/types'

export type { AuthUser } from './auth-context'

export function useAuth() {
  return useAuthContext()
}

export function useRole() {
  const { authUser } = useAuthContext()
  const role: UserRole | null = authUser?.role ?? null
  return {
    role,
    isOwner:  role === 'superadmin' || role === 'owner',
    isAdmin:  role === 'superadmin' || role === 'owner' || role === 'admin',
    isStaff:  role === 'superadmin' || role === 'owner' || role === 'admin' || role === 'staff',
    isViewer: !!role,
  }
}
