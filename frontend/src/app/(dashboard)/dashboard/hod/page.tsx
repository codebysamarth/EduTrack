'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Building2,
  Users,
  LayoutGrid,
  BookOpen,
  Shield,
  UserCheck,
  FolderOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

function PrnBadge({ prn }: { prn: string }) {
  return (
    <span className="font-mono text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/20">
      {prn}
    </span>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2540] ${className}`} />
}

interface DeptData {
  id: string; name: string; code: string
  hod: { id: string; name: string; prnNo?: string } | null
  coordinators: { id: string; name: string; prnNo?: string; year?: string }[]
  guides: { id: string; name: string; prnNo?: string }[]
  _count: { groups: number; studentProfiles: number }
}
interface FacultyData {
  id: string; name: string; roles: string[]
}
interface ProjectData {
  id: string; title: string; status: string; domain?: string; sdgGoals?: number[]
  createdAt: string
}

export default function HodPage() {
  const { user } = useAuth()
  const deptId = user?.facultyProfile?.departmentId ?? ''

  const [dept, setDept] = useState<DeptData | null>(null)
  const [faculty, setFaculty] = useState<FacultyData[]>([])
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!deptId) return
    try {
      const [d, f, p] = await Promise.all([
        api.get(`/departments/${deptId}`),
        api.get(`/users/faculty?departmentId=${deptId}`),
        api.get('/projects'),
      ])
      setDept(d.data)
      setFaculty(f.data)
      setProjects(Array.isArray(p.data) ? p.data : [])
    } catch { /* */ }
    setLoading(false)
  }, [deptId])

  useEffect(() => { fetchData() }, [fetchData])

  const publishedCount = projects.filter(p => p.status === 'PUBLISHED').length
  const activeCount = projects.filter(p => p.status !== 'PUBLISHED').length

  const domainData = useMemo(() => {
    const counts: Record<string, number> = {}
    projects.forEach(p => { const d = p.domain || 'Other'; counts[d] = (counts[d] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [projects])

  const submissionData = useMemo(() => {
    const byMonth: Record<string, number> = {}
    projects.forEach(p => {
      const m = new Date(p.createdAt).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })
      byMonth[m] = (byMonth[m] || 0) + 1
    })
    return Object.entries(byMonth).map(([month, count]) => ({ month, count })).slice(-8)
  }, [projects])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const statCards = [
    { label: 'Total Faculty', value: faculty.length, tint: 'bg-green-500/10 border-green-500/20 text-green-400', icon: UserCheck, link: '/dashboard/hod/faculty' },
    { label: 'Total Groups', value: dept?._count.groups ?? 0, tint: 'bg-blue-500/10 border-blue-500/20 text-blue-400', icon: Users, link: '/dashboard/hod/groups' },
    { label: 'Active Projects', value: activeCount, tint: 'bg-purple-500/10 border-purple-500/20 text-purple-400', icon: LayoutGrid, link: '/dashboard/hod/projects' },
    { label: 'Published Projects', value: publishedCount, tint: 'bg-amber-500/10 border-amber-500/20 text-amber-400', icon: BookOpen, link: '/dashboard/hod/projects?filter=published' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* ═══ SECTION 1 — Department Hero ═══ */}
      {dept && (
        <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Building2 size={22} className="text-amber-400" />
            </div>
            <div>
              <h1 className="font-[var(--font-sora)] text-3xl font-bold text-[#EEF2FF]">{dept.name}</h1>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10 inline-block mt-1">{dept.code}</span>
            </div>
          </div>
          {dept.hod && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-[#7A8BAF]">HOD:</span>
              <span className="text-sm font-medium text-[#EEF2FF]">{dept.hod.name}</span>
              {dept.hod.prnNo && <PrnBadge prn={dept.hod.prnNo} />}
            </div>
          )}
        </div>
      )}

      {/* ═══ SECTION 2 — Stats ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <div key={c.label} className={`rounded-2xl p-5 border ${c.tint.split(' ').slice(0, 2).join(' ')}`}>
            <div className="flex items-center gap-2 mb-3">
              <c.icon size={16} className={c.tint.split(' ')[2]} />
              <span className="text-xs text-[#7A8BAF]">{c.label}</span>
            </div>
            <p className="font-[var(--font-sora)] text-3xl font-bold text-[#EEF2FF]">{c.value}</p>
            <Link href={c.link} className="text-xs text-amber-400 hover:text-amber-300 mt-3 inline-flex items-center gap-1 transition-colors">
              View <ArrowRight size={12} />
            </Link>
          </div>
        ))}
      </div>

      {/* ═══ SECTION 3 — Coordinators ═══ */}
      {dept && (
        <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4 flex items-center gap-2">
            <Shield size={16} className="text-amber-400" /> Coordinators
          </h3>
          {dept.coordinators.length === 0 ? (
            <p className="text-sm text-[#7A8BAF] text-center py-4">No coordinators assigned</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dept.coordinators.map(c => (
                <div key={c.id} className="bg-[#1A2540] border border-[#2A3A5C] rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-sm font-semibold">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#EEF2FF]">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.prnNo && <PrnBadge prn={c.prnNo} />}
                        {c.year && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{c.year}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ SECTION 4 — Charts ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-[var(--font-sora)] text-sm font-semibold text-[#EEF2FF] mb-4">Submissions Over Time</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={submissionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3A5C" />
                <XAxis dataKey="month" tick={{ fill: '#7A8BAF', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7A8BAF', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0F1729', border: '1px solid #2A3A5C', borderRadius: 12, color: '#EEF2FF' }} />
                <Line type="monotone" dataKey="count" stroke="#F5A623" strokeWidth={2} dot={{ fill: '#F5A623', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-[var(--font-sora)] text-sm font-semibold text-[#EEF2FF] mb-4">Projects by Domain</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3A5C" />
                <XAxis type="number" tick={{ fill: '#7A8BAF', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#7A8BAF', fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={{ background: '#0F1729', border: '1px solid #2A3A5C', borderRadius: 12, color: '#EEF2FF' }} />
                <Bar dataKey="value" fill="#F5A623" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 5 — Quick Links ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Manage Faculty', desc: 'View, assign roles, export', href: '/dashboard/hod/faculty', icon: UserCheck },
          { label: 'View All Groups', desc: 'Create and manage groups', href: '/dashboard/hod/groups', icon: Users },
          { label: 'View Projects', desc: 'Track projects and publish', href: '/dashboard/hod/projects', icon: FolderOpen },
          { label: 'Project Showcase', desc: 'Browse published projects', href: '/dashboard/showcase', icon: Sparkles },
        ].map(q => (
          <Link key={q.href} href={q.href}
            className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-5 hover:border-amber-500/30 hover:bg-[#1A2540] transition-all duration-200 group">
            <q.icon size={20} className="text-amber-400 mb-3" />
            <p className="text-sm font-semibold text-[#EEF2FF] group-hover:text-amber-400 transition-colors">{q.label} →</p>
            <p className="text-xs text-[#4A5B7A] mt-1">{q.desc}</p>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}
