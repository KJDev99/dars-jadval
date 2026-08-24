import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, isAdminRole } from '../authStore'
import type { Role } from '../types'

/**
 * Himoyalangan bo'lim.
 * Seans bo'lmasa kirish sahifasiga, roli mos kelmasa o'z bo'limiga yo'naltiradi.
 */
export default function RequireAuth({
  children,
  need,
}: {
  children: ReactNode
  /** 'admin' — direktor yoki zavuch; aks holda aniq rol */
  need: 'admin' | Role
}) {
  const session = useAuth((s) => s.session)
  const location = useLocation()

  if (!session) {
    const to = need === 'teacher' ? '/kirish?rol=teacher' : '/kirish'
    return <Navigate to={to} replace state={{ from: location.pathname }} />
  }

  const ok = need === 'admin' ? isAdminRole(session.role) : session.role === need
  if (!ok) {
    return <Navigate to={session.role === 'teacher' ? '/kabinet' : '/boshqaruv'} replace />
  }

  return <>{children}</>
}
