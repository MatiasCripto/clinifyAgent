'use client'

import type { ReactNode } from 'react'
import { useRole } from '@/lib/hooks/use-auth'
import type { UserRole } from '@/lib/types'

interface RoleGuardProps {
  children: ReactNode
  minRole: UserRole
  fallback?: ReactNode
}

const ROLE_RANK: Record<UserRole, number> = { viewer: 0, staff: 1, admin: 2, owner: 3, superadmin: 99 }

export function RoleGuard({ children, minRole, fallback = null }: RoleGuardProps) {
  const { role } = useRole()
  if (!role) return <>{fallback}</>
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) return <>{fallback}</>
  return <>{children}</>
}

// HOC version — wraps a component, renders null if insufficient role
export function withRole<T extends object>(Component: React.ComponentType<T>, minRole: UserRole) {
  return function ProtectedComponent(props: T) {
    return (
      <RoleGuard minRole={minRole}>
        <Component {...props} />
      </RoleGuard>
    )
  }
}
