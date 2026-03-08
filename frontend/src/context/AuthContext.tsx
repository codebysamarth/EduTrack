'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { User, RoleName } from '@/types'

const ROLE_PRIORITY: RoleName[] = ['ADMIN', 'HOD', 'COORDINATOR', 'GUIDE', 'STUDENT']

interface AuthContextValue {
  user: User | null
  roles: RoleName[]
  prnNo: string | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<string[]>
  logout: () => void
  hasRole: (role: RoleName) => boolean
  isStudent: () => boolean
  isFaculty: () => boolean
  highestRole: () => RoleName
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function extractPrn(user: User | null): string | null {
  if (!user) return null
  return user.studentProfile?.prnNo ?? user.facultyProfile?.prnNo ?? user.prnNo ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const roles = user?.roles ?? []
  const prnNo = extractPrn(user)

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('college_token')
    if (!token) {
      setIsLoading(false)
      return
    }

    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user ?? res.data))
      .catch(() => localStorage.removeItem('college_token'))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(
    async (identifier: string, password: string): Promise<string[]> => {
      const { data } = await api.post('/auth/login', { identifier, password })
      localStorage.setItem('college_token', data.token)
      setUser(data.user)
      return data.user?.roles ?? []
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('college_token')
    setUser(null)
    router.push('/login')
  }, [router])

  const hasRole = useCallback(
    (role: RoleName) => roles.includes(role),
    [roles],
  )

  const isStudent = useCallback(() => roles.includes('STUDENT'), [roles])

  const isFaculty = useCallback(
    () =>
      roles.some((r) =>
        (['GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'] as RoleName[]).includes(r),
      ),
    [roles],
  )

  const highestRole = useCallback((): RoleName => {
    for (const r of ROLE_PRIORITY) {
      if (roles.includes(r)) return r
    }
    return 'STUDENT'
  }, [roles])

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        prnNo,
        isLoading,
        login,
        logout,
        hasRole,
        isStudent,
        isFaculty,
        highestRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
