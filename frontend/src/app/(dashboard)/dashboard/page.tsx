'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function DashboardRedirect() {
  const { roles, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (roles.includes('ADMIN')) router.replace('/dashboard/admin')
    else if (roles.includes('HOD')) router.replace('/dashboard/hod')
    else if (roles.includes('COORDINATOR')) router.replace('/dashboard/coordinator')
    else if (roles.includes('GUIDE')) router.replace('/dashboard/guide')
    else if (roles.includes('STUDENT')) router.replace('/dashboard/student')
    else router.replace('/login')
  }, [roles, isLoading, router])

  return (
    <div className="flex items-center justify-center h-screen bg-[#080D1A]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[#7A8BAF] text-sm">Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
