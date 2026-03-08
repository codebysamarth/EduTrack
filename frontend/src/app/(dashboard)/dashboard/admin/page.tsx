'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  GraduationCap,
  Users,
  Building2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Loader2,
  UserPlus,
  UserCheck,
  FolderOpen,
  ArrowRight,
  Shield,
  Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'

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

interface UserData {
  id: string; name: string; email: string; prnNo?: string
  roles: string[]; isApproved: boolean
  studentProfile?: { year?: string; division?: string; departmentId?: string } | null
  facultyProfile?: { designation?: string; departmentId?: string; prnNo?: string } | null
}

interface DeptData {
  id: string; name: string; code: string
  hod?: { id: string; name: string; prnNo?: string } | null
  coordinators?: { id: string; name: string; prnNo?: string; year?: string }[]
  guides?: { id: string; name: string; prnNo?: string }[]
  _count?: { groups: number; studentProfiles: number }
}

interface FacultyData {
  id: string; name: string; email: string; prnNo?: string; designation?: string
  roles: string[]; isApproved: boolean
}

type Year = 'FY' | 'SY' | 'TY' | 'FINAL'
const YEARS: Year[] = ['FY', 'SY', 'TY', 'FINAL']
const ROLE_NAMES = ['GUIDE', 'COORDINATOR'] as const

export default function AdminPage() {
  const [studentCount, setStudentCount] = useState(0)
  const [facultyCount, setFacultyCount] = useState(0)
  const [departments, setDepartments] = useState<DeptData[]>([])
  const [publishedCount, setPublishedCount] = useState(0)
  const [pendingFaculty, setPendingFaculty] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create department
  const [showCreateDept, setShowCreateDept] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '', code: '' })
  const [deptLoading, setDeptLoading] = useState(false)

  // Assign HOD
  const [assignHodDept, setAssignHodDept] = useState<DeptData | null>(null)
  const [hodUserId, setHodUserId] = useState('')
  const [allFaculty, setAllFaculty] = useState<UserData[]>([])

  // Role management dialog
  const [roleMgmtDept, setRoleMgmtDept] = useState<DeptData | null>(null)
  const [roleMgmtTab, setRoleMgmtTab] = useState<'current' | 'assign'>('current')
  const [roleMgmtFaculty, setRoleMgmtFaculty] = useState<FacultyData[]>([])
  const [assignTarget, setAssignTarget] = useState('')
  const [assignRole, setAssignRole] = useState<typeof ROLE_NAMES[number]>('GUIDE')
  const [assignYear, setAssignYear] = useState<Year | ''>('')
  const [roleLoading, setRoleLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [sRes, fRes, dRes, pRes] = await Promise.all([
        api.get('/users?role=STUDENT&limit=1'),
        api.get('/users?limit=1'),
        api.get('/departments'),
        api.get('/projects?status=PUBLISHED'),
      ])
      setStudentCount(sRes.data.pagination?.total ?? 0)
      const allUsers: UserData[] = fRes.data.users ?? []
      const fac = allUsers.filter(u => u.facultyProfile || u.roles.some(r => r !== 'STUDENT'))
      setAllFaculty(fac)
      setFacultyCount(fac.filter(u => u.isApproved).length)
      setPendingFaculty(fac.filter(u => !u.isApproved))
      setDepartments(Array.isArray(dRes.data) ? dRes.data : [])
      setPublishedCount(Array.isArray(pRes.data) ? pRes.data.length : 0)
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApprove = async (userId: string) => {
    setActionLoading(userId)
    try {
      await api.patch(`/users/${userId}/approve`, { isApproved: true })
      await fetchData()
    } catch { /* */ }
    setActionLoading(null)
  }

  const handleReject = async (userId: string) => {
    setActionLoading(userId)
    try {
      await api.patch(`/users/${userId}/approve`, { isApproved: false })
      await fetchData()
    } catch { /* */ }
    setActionLoading(null)
  }

  const handleCreateDept = async () => {
    setDeptLoading(true)
    try {
      await api.post('/departments', deptForm)
      setShowCreateDept(false)
      setDeptForm({ name: '', code: '' })
      await fetchData()
    } catch { /* */ }
    setDeptLoading(false)
  }

  const handleAssignHod = async () => {
    if (!assignHodDept || !hodUserId) return
    setActionLoading(assignHodDept.id)
    try {
      await api.patch(`/departments/${assignHodDept.id}/assign-hod`, { userId: hodUserId })
      setAssignHodDept(null)
      setHodUserId('')
      await fetchData()
    } catch { /* */ }
    setActionLoading(null)
  }

  // Role management
  const openRoleMgmt = async (dept: DeptData) => {
    setRoleMgmtDept(dept)
    setRoleMgmtTab('current')
    try {
      const [dRes, fRes] = await Promise.all([
        api.get(`/departments/${dept.id}`),
        api.get(`/users/faculty?departmentId=${dept.id}`),
      ])
      setRoleMgmtDept(dRes.data)
      setRoleMgmtFaculty(fRes.data)
    } catch { /* */ }
  }

  const handleRemoveRole = async (userId: string, roleName: string) => {
    if (!roleMgmtDept) return
    setRoleLoading(userId + roleName)
    try {
      await api.delete('/users/remove-role', { data: { userId, roleName, departmentId: roleMgmtDept.id } })
      const dRes = await api.get(`/departments/${roleMgmtDept.id}`)
      setRoleMgmtDept(dRes.data)
      await fetchData()
    } catch { /* */ }
    setRoleLoading(null)
  }

  const handleAssignDeptRole = async () => {
    if (!roleMgmtDept || !assignTarget) return
    setRoleLoading('assign')
    try {
      await api.post('/users/assign-role', {
        userId: assignTarget,
        roleName: assignRole,
        departmentId: roleMgmtDept.id,
        year: assignRole === 'COORDINATOR' ? assignYear || undefined : undefined,
      })
      const dRes = await api.get(`/departments/${roleMgmtDept.id}`)
      setRoleMgmtDept(dRes.data)
      setAssignTarget('')
      await fetchData()
    } catch { /* */ }
    setRoleLoading(null)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none transition-all duration-200'

  const statCards = [
    { label: 'Total Students', value: studentCount, sub: 'students', icon: GraduationCap, tint: 'bg-blue-500/10 border-blue-500/20 text-blue-400', link: '/dashboard/admin/students' },
    { label: 'Total Faculty', value: facultyCount, sub: 'faculty', icon: UserCheck, tint: 'bg-green-500/10 border-green-500/20 text-green-400', link: '/dashboard/admin/faculty' },
    { label: 'Departments', value: departments.length, sub: 'departments', icon: Building2, tint: 'bg-purple-500/10 border-purple-500/20 text-purple-400', link: '' },
    { label: 'Published Projects', value: publishedCount, sub: 'published', icon: Sparkles, tint: 'bg-amber-500/10 border-amber-500/20 text-amber-400', link: '/dashboard/admin/projects' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* ═══ Header ═══ */}
      <div>
        <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">Admin Dashboard</h1>
        <p className="text-sm text-[#7A8BAF] mt-1">College-wide management</p>
      </div>

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <div key={c.label} className={`rounded-2xl p-5 border ${c.tint.split(' ').slice(0, 2).join(' ')}`}>
            <div className="flex items-center gap-2 mb-3">
              <c.icon size={16} className={c.tint.split(' ')[2]} />
              <span className="text-xs text-[#7A8BAF]">{c.label}</span>
            </div>
            <p className="font-[var(--font-sora)] text-3xl font-bold text-[#EEF2FF]">{c.value}</p>
            <p className="text-xs text-[#4A5B7A] mt-1">{c.sub}</p>
            {c.link && (
              <Link href={c.link} className="text-xs text-amber-400 hover:text-amber-300 mt-3 inline-flex items-center gap-1 transition-colors">
                View All <ArrowRight size={12} />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* ═══ Pending Faculty Approvals ═══ */}
      <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Pending Faculty Approvals</h3>
          {pendingFaculty.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {pendingFaculty.length} pending
            </span>
          )}
        </div>
        {pendingFaculty.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 size={32} className="text-green-500/30 mx-auto mb-2" />
            <p className="text-sm text-[#7A8BAF]">All faculty approved ✓</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A3A5C]">
                  {['Name', 'Email', 'PRN', 'Department', 'Designation', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-[#4A5B7A] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingFaculty.map(f => (
                  <tr key={f.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                    <td className="py-3 px-3 text-[#EEF2FF] font-medium">{f.name}</td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{f.email}</td>
                    <td className="py-3 px-3">{f.prnNo ? <PrnBadge prn={f.prnNo} /> : '—'}</td>
                    <td className="py-3 px-3 text-[#7A8BAF] text-xs">{f.facultyProfile?.departmentId ? departments.find(d => d.id === f.facultyProfile?.departmentId)?.name ?? '—' : '—'}</td>
                    <td className="py-3 px-3 text-[#7A8BAF] text-xs">{f.facultyProfile?.designation ?? '—'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApprove(f.id)} disabled={actionLoading === f.id}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50">
                          {actionLoading === f.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Approve
                        </button>
                        <button onClick={() => handleReject(f.id)} disabled={actionLoading === f.id}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50">
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ Departments ═══ */}
      <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Departments</h3>
          <button onClick={() => setShowCreateDept(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all duration-200">
            <Plus size={14} /> Create Department
          </button>
        </div>
        {departments.length === 0 ? (
          <p className="text-sm text-[#7A8BAF] text-center py-6">No departments yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(d => (
              <div key={d.id} className="bg-[#1A2540] border border-[#2A3A5C] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-[#EEF2FF]">{d.name}</p>
                    <p className="text-xs text-[#7A8BAF] font-mono">{d.code}</p>
                  </div>
                  <Building2 size={16} className="text-[#4A5B7A]" />
                </div>
                <div className="flex items-center gap-2 text-xs text-[#7A8BAF] mb-3">
                  {d._count && (
                    <>
                      <span>{d._count.studentProfiles} students</span>
                      <span className="text-[#2A3A5C]">·</span>
                      <span>{d._count.groups} groups</span>
                    </>
                  )}
                </div>
                <div className="text-xs mb-3">
                  {d.hod ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-[#7A8BAF]">HOD:</span>
                      <span className="text-[#EEF2FF]">{d.hod.name}</span>
                      {d.hod.prnNo && <PrnBadge prn={d.hod.prnNo} />}
                    </span>
                  ) : (
                    <span className="text-[#4A5B7A]">No HOD assigned</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setAssignHodDept(d); setHodUserId('') }}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                    <UserPlus size={12} /> Assign HOD
                  </button>
                  <button onClick={() => openRoleMgmt(d)}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                    <Shield size={12} /> Manage Roles
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Quick Links ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Manage Faculty', desc: 'View, approve, assign roles', href: '/dashboard/admin/faculty', icon: UserCheck },
          { label: 'Manage Students', desc: 'View all students across departments', href: '/dashboard/admin/students', icon: GraduationCap },
          { label: 'All Groups', desc: 'Create and manage all groups', href: '/dashboard/admin/groups', icon: Users },
          { label: 'All Projects', desc: 'Track projects across departments', href: '/dashboard/admin/projects', icon: FolderOpen },
        ].map(q => (
          <Link key={q.href} href={q.href}
            className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-5 hover:border-amber-500/30 hover:bg-[#1A2540] transition-all duration-200 group">
            <q.icon size={20} className="text-amber-400 mb-3" />
            <p className="text-sm font-semibold text-[#EEF2FF] group-hover:text-amber-400 transition-colors">{q.label} →</p>
            <p className="text-xs text-[#4A5B7A] mt-1">{q.desc}</p>
          </Link>
        ))}
      </div>

      {/* ═══ Create Department Dialog ═══ */}
      <AnimatePresence>
        {showCreateDept && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateDept(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Create Department</h3>
                <button onClick={() => setShowCreateDept(false)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Department Name *</label>
                  <input type="text" value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Computer Science" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Code *</label>
                  <input type="text" value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))} className={inputCls} placeholder="CS" />
                </div>
              </div>
              <button onClick={handleCreateDept} disabled={!deptForm.name || !deptForm.code || deptLoading}
                className="w-full mt-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                {deptLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Assign HOD Dialog ═══ */}
      <AnimatePresence>
        {assignHodDept && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAssignHodDept(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Assign HOD</h3>
                <button onClick={() => setAssignHodDept(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>
              <p className="text-sm text-[#7A8BAF] mb-4">Assign HOD for <span className="text-[#EEF2FF] font-medium">{assignHodDept.name}</span></p>
              <div>
                <label className="block text-xs text-[#7A8BAF] mb-1.5">Select Faculty</label>
                <select value={hodUserId} onChange={e => setHodUserId(e.target.value)} className={inputCls}>
                  <option value="">Choose...</option>
                  {allFaculty.filter(f => f.isApproved).map(f => (
                    <option key={f.id} value={f.id}>{f.name} {f.prnNo ? `(${f.prnNo})` : ''}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleAssignHod} disabled={!hodUserId || actionLoading === assignHodDept.id}
                className="w-full mt-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                {actionLoading === assignHodDept.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Role Management Dialog ═══ */}
      <AnimatePresence>
        {roleMgmtDept && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRoleMgmtDept(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Manage Roles — {roleMgmtDept.name}</h3>
                <button onClick={() => setRoleMgmtDept(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-5">
                {(['current', 'assign'] as const).map(tab => (
                  <button key={tab} onClick={() => setRoleMgmtTab(tab)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${roleMgmtTab === tab ? 'bg-amber-500 text-black' : 'bg-[#1A2540] text-[#7A8BAF] hover:text-[#EEF2FF]'}`}>
                    {tab === 'current' ? 'Current Roles' : 'Assign Role'}
                  </button>
                ))}
              </div>

              {roleMgmtTab === 'current' ? (
                <div className="space-y-4">
                  {/* Coordinators */}
                  <div>
                    <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Coordinators</h4>
                    {(roleMgmtDept.coordinators ?? []).length === 0 ? (
                      <p className="text-xs text-[#4A5B7A] italic">None assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {roleMgmtDept.coordinators!.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#EEF2FF]">{c.name}</span>
                              {c.prnNo && <PrnBadge prn={c.prnNo} />}
                              {c.year && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{c.year}</span>}
                            </div>
                            <button onClick={() => handleRemoveRole(c.id, 'COORDINATOR')} disabled={roleLoading === c.id + 'COORDINATOR'}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 disabled:opacity-50">
                              {roleLoading === c.id + 'COORDINATOR' ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Guides */}
                  <div>
                    <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Guides</h4>
                    {(roleMgmtDept.guides ?? []).length === 0 ? (
                      <p className="text-xs text-[#4A5B7A] italic">None assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {roleMgmtDept.guides!.map(g => (
                          <div key={g.id} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#EEF2FF]">{g.name}</span>
                              {g.prnNo && <PrnBadge prn={g.prnNo} />}
                            </div>
                            <button onClick={() => handleRemoveRole(g.id, 'GUIDE')} disabled={roleLoading === g.id + 'GUIDE'}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 disabled:opacity-50">
                              {roleLoading === g.id + 'GUIDE' ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Select Faculty</label>
                    <select value={assignTarget} onChange={e => setAssignTarget(e.target.value)} className={inputCls}>
                      <option value="">Choose faculty...</option>
                      {roleMgmtFaculty.filter(f => f.isApproved).map(f => (
                        <option key={f.id} value={f.id}>{f.name} {f.prnNo ? `(${f.prnNo})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Role</label>
                    <div className="flex gap-2">
                      {ROLE_NAMES.map(r => (
                        <button key={r} onClick={() => setAssignRole(r)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${assignRole === r ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  {assignRole === 'COORDINATOR' && (
                    <div>
                      <label className="block text-xs text-[#7A8BAF] mb-1.5">Year (optional)</label>
                      <div className="flex gap-2">
                        <button onClick={() => setAssignYear('')}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${assignYear === '' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'}`}>
                          All
                        </button>
                        {YEARS.map(y => (
                          <button key={y} onClick={() => setAssignYear(y)}
                            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${assignYear === y ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'}`}>
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={handleAssignDeptRole} disabled={!assignTarget || roleLoading === 'assign'}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                    {roleLoading === 'assign' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
