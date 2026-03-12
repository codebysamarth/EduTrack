'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Sparkles,
  Users,
  FolderOpen,
  Lightbulb,
  LogOut,
  MessageCircle,
  UserCheck,
  GraduationCap,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { RoleName } from '@/types'
import ChatPanel from '@/components/chat/ChatPanel'

// ─── Role badge component ──────────────────────────────
const ROLE_COLORS: Record<RoleName, string> = {
  STUDENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  GUIDE: 'bg-green-500/20 text-green-400 border-green-500/30',
  COORDINATOR: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  HOD: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
}

function RoleBadge({ role }: { role: RoleName }) {
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}
    >
      {role}
    </span>
  )
}

// ─── Nav items per role ────────────────────────────────
function getNavItems(highestRole: RoleName): { href: string; label: string; icon: React.ElementType }[] {
  const items: { href: string; label: string; icon: React.ElementType }[] = []

  switch (highestRole) {
    case 'ADMIN':
      items.push({ href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard })
      items.push({ href: '/dashboard/admin/faculty', label: 'Faculty', icon: UserCheck })
      items.push({ href: '/dashboard/admin/students', label: 'Students', icon: GraduationCap })
      items.push({ href: '/dashboard/admin/groups', label: 'Groups', icon: Users })
      items.push({ href: '/dashboard/admin/projects', label: 'Projects', icon: FolderOpen })
      break
    case 'HOD':
      items.push({ href: '/dashboard/hod', label: 'Dashboard', icon: LayoutDashboard })
      items.push({ href: '/dashboard/hod/faculty', label: 'Faculty', icon: UserCheck })
      items.push({ href: '/dashboard/hod/groups', label: 'Groups', icon: Users })
      items.push({ href: '/dashboard/hod/projects', label: 'Projects', icon: FolderOpen })
      break
    case 'COORDINATOR':
      items.push({ href: '/dashboard/coordinator', label: 'Dashboard', icon: LayoutDashboard })
      items.push({ href: '/dashboard/coordinator/projects', label: 'All Projects', icon: FolderOpen })
      items.push({ href: '/dashboard/coordinator/bulk-upload', label: 'Bulk Upload', icon: Upload })
      break
    case 'GUIDE':
      items.push({ href: '/dashboard/guide', label: 'Dashboard', icon: LayoutDashboard })
      items.push({ href: '/dashboard/guide/projects', label: 'All Projects', icon: FolderOpen })
      items.push({ href: '/dashboard/guide/bulk-upload', label: 'Bulk Upload', icon: Upload })
      break
    default:
      items.push({ href: '/dashboard/student', label: 'Dashboard', icon: LayoutDashboard })
      items.push({ href: '/dashboard/my-group', label: 'My Group', icon: Users })
      items.push({ href: '/dashboard/my-project', label: 'My Project', icon: FolderOpen })
      items.push({ href: '/dashboard/project-ideas', label: 'Project Ideas', icon: Lightbulb })
      break
  }

  items.push({ href: '/dashboard/showcase', label: 'Showcase', icon: Sparkles })
  return items
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, roles, prnNo, isLoading, logout, highestRole } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [chatOpen, setChatOpen] = useState(false)
  const [hasUnread] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('college_token') : null
      if (!token) router.push('/login')
    }
  }, [isLoading, user, router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#080D1A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const visibleNav = getNavItems(highestRole())

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-[#080D1A] flex">
      {/* ───── Sidebar ───── */}
      <aside
        className="fixed top-0 left-0 h-screen w-[260px] border-r border-[#2A3A5C] flex flex-col z-40"
        style={{
          background: '#080D1A',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
        }}
      >
        {/* Logo */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <h1 className="font-[var(--font-sora)] text-xl font-bold text-[#EEF2FF] tracking-tight">
              <span className="text-amber-500">E</span>duTrack
            </h1>
            <span className="text-[10px] text-[#4A5B7A] border border-[#2A3A5C] rounded px-1.5 py-0.5">
              v1.0
            </span>
          </div>
        </div>

        {/* User section */}
        <div className="px-6 py-4 border-t border-b border-[#2A3A5C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-[var(--font-sora)] text-sm font-semibold text-[#EEF2FF] truncate">
                {user.name}
              </p>
              {prnNo && (
                <span className="font-mono text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded inline-block mt-1">
                  {prnNo}
                </span>
              )}
            </div>
          </div>
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {roles.map((r) => (
                <RoleBadge key={r} role={r} />
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#1A2540] text-amber-400 border-l-2 border-amber-500'
                    : 'text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] border-l-2 border-transparent'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-6">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#7A8BAF] hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* ───── Main content ───── */}
      <main className="ml-[260px] flex-1 min-h-screen p-8">{children}</main>

      {/* ───── Chat bubble ───── */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #F5A623, #F97316)',
          boxShadow: '0 0 20px rgba(245,166,35,0.3)',
        }}
        title="AI Assistant"
      >
        <MessageCircle size={24} className="text-white" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#080D1A]" />
        )}
      </button>

      {/* Pulse ring animation */}
      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 166, 35, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(245, 166, 35, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 166, 35, 0);
          }
        }
      `}</style>

      {/* ───── Chat panel ───── */}
      <AnimatePresence>
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          userRole={roles[0] ?? 'STUDENT'}
          user={user}
        />
      </AnimatePresence>
    </div>
  )
}
