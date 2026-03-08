'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
  Download,
  X,
  Shield,
  Trash2,
  Filter,
} from 'lucide-react'
import { api } from '@/lib/api'
import { downloadAsExcel } from '@/lib/exportExcel'

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

interface FacultyUser {
  id: string; name: string; email: string; prnNo?: string
  roles: string[]; isApproved: boolean
  facultyProfile?: { designation?: string; departmentId?: string; prnNo?: string } | null
}

interface DeptData {
  id: string; name: string; code: string
  coordinators?: { id: string; name: string; prnNo?: string; year?: string }[]
  guides?: { id: string; name: string; prnNo?: string }[]
}

interface FacultyListItem {
  id: string; name: string; email: string; prnNo?: string
  designation?: string; roles: string[]; isApproved: boolean
}

type Year = 'FY' | 'SY' | 'TY' | 'FINAL'
const YEARS: Year[] = ['FY', 'SY', 'TY', 'FINAL']
const ROLE_NAMES = ['GUIDE', 'COORDINATOR'] as const
const PAGE_SIZE = 20

export default function AdminFacultyPage() {
  const [faculty, setFaculty] = useState<FacultyUser[]>([])
  const [departments, setDepartments] = useState<DeptData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all')
  const [page, setPage] = useState(1)

  // Role management dialog
  const [roleFaculty, setRoleFaculty] = useState<FacultyUser | null>(null)
  const [roleMgmtTab, setRoleMgmtTab] = useState<'current' | 'assign'>('current')
  const [roleDept, setRoleDept] = useState('')
  const [assignRole, setAssignRole] = useState<typeof ROLE_NAMES[number]>('GUIDE')
  const [assignYear, setAssignYear] = useState<Year | ''>('')
  const [roleLoading, setRoleLoading] = useState<string | null>(null)
  const [deptRoles, setDeptRoles] = useState<DeptData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [fRes, dRes] = await Promise.all([
        api.get('/users?limit=9999'),
        api.get('/departments'),
      ])
      const allUsers: FacultyUser[] = fRes.data.users ?? []
      setFaculty(allUsers.filter(u => u.facultyProfile || u.roles.some(r => r !== 'STUDENT')))
      setDepartments(Array.isArray(dRes.data) ? dRes.data : [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtered + paginated
  const filtered = faculty.filter(f => {
    if (search) {
      const s = search.toLowerCase()
      if (!f.name.toLowerCase().includes(s) && !(f.prnNo ?? '').toLowerCase().includes(s) && !f.email.toLowerCase().includes(s)) return false
    }
    if (filterDept && f.facultyProfile?.departmentId !== filterDept) return false
    if (filterStatus === 'approved' && !f.isApproved) return false
    if (filterStatus === 'pending' && f.isApproved) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterDept, filterStatus])

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

  const handleExport = () => {
    const rows = filtered.map(f => ({
      Name: f.name,
      Email: f.email,
      PRN: f.prnNo ?? '',
      Department: departments.find(d => d.id === f.facultyProfile?.departmentId)?.name ?? '',
      Designation: f.facultyProfile?.designation ?? '',
      Roles: f.roles.join(', '),
      Status: f.isApproved ? 'Approved' : 'Pending',
    }))
    downloadAsExcel(rows, 'faculty')
  }

  // Role management
  const openRoleMgmt = async (fac: FacultyUser) => {
    setRoleFaculty(fac)
    setRoleMgmtTab('current')
    setRoleDept('')
    setDeptRoles(null)
  }

  const loadDeptRoles = async (deptId: string) => {
    setRoleDept(deptId)
    if (!deptId) { setDeptRoles(null); return }
    try {
      const res = await api.get(`/departments/${deptId}`)
      setDeptRoles(res.data)
    } catch { /* */ }
  }

  const handleRemoveRole = async (userId: string, roleName: string) => {
    if (!roleDept) return
    setRoleLoading(userId + roleName)
    try {
      await api.delete('/users/remove-role', { data: { userId, roleName, departmentId: roleDept } })
      await loadDeptRoles(roleDept)
      await fetchData()
    } catch { /* */ }
    setRoleLoading(null)
  }

  const handleAssignRole = async () => {
    if (!roleFaculty || !roleDept) return
    setRoleLoading('assign')
    try {
      await api.post('/users/assign-role', {
        userId: roleFaculty.id,
        roleName: assignRole,
        departmentId: roleDept,
        year: assignRole === 'COORDINATOR' ? assignYear || undefined : undefined,
      })
      await loadDeptRoles(roleDept)
      await fetchData()
    } catch { /* */ }
    setRoleLoading(null)
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none transition-all duration-200'

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">Faculty Management</h1>
          <p className="text-sm text-[#7A8BAF] mt-1">{filtered.length} faculty members</p>
        </div>
        <button onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] rounded-xl text-sm transition-all duration-200">
          <Download size={14} /> Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, PRN..."
            className={`${inputCls} pl-9`} />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-[#4A5B7A]" />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className={`${inputCls} w-auto min-w-[160px]`}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          {(['all', 'approved', 'pending'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${filterStatus === s ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
              {s === 'all' ? 'All' : s === 'approved' ? 'Approved' : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A3A5C]">
                {['Name', 'PRN', 'Department', 'Designation', 'Roles', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-[#4A5B7A] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-[#4A5B7A]">No faculty found</td></tr>
              ) : paginated.map(f => (
                <tr key={f.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <span className="text-[#EEF2FF] font-medium">{f.name}</span>
                      <p className="text-[10px] text-[#4A5B7A]">{f.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">{f.prnNo ? <PrnBadge prn={f.prnNo} /> : '—'}</td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{departments.find(d => d.id === f.facultyProfile?.departmentId)?.name ?? '—'}</td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{f.facultyProfile?.designation ?? '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {f.roles.map(r => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {f.isApproved ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Approved</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {!f.isApproved && (
                        <>
                          <button onClick={() => handleApprove(f.id)} disabled={actionLoading === f.id}
                            className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50 flex items-center gap-1">
                            {actionLoading === f.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Approve
                          </button>
                          <button onClick={() => handleReject(f.id)} disabled={actionLoading === f.id}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 flex items-center gap-1">
                            <XCircle size={10} /> Reject
                          </button>
                        </>
                      )}
                      <button onClick={() => openRoleMgmt(f)}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <Shield size={10} /> Roles
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2A3A5C]">
            <span className="text-xs text-[#4A5B7A]">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] disabled:opacity-30 transition-all">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] disabled:opacity-30 transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Role Management Dialog ═══ */}
      <AnimatePresence>
        {roleFaculty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRoleFaculty(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Manage Roles</h3>
                <button onClick={() => setRoleFaculty(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>
              <p className="text-sm text-[#7A8BAF] mb-4">
                {roleFaculty.name} {roleFaculty.prnNo && <PrnBadge prn={roleFaculty.prnNo} />}
              </p>

              {/* Department selector */}
              <div className="mb-4">
                <label className="block text-xs text-[#7A8BAF] mb-1.5">Department context</label>
                <select value={roleDept} onChange={e => loadDeptRoles(e.target.value)} className={inputCls}>
                  <option value="">Select department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {roleDept && (
                <>
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
                      {/* Show this faculty's roles within the selected department */}
                      <div>
                        <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Coordinators in this dept</h4>
                        {(deptRoles?.coordinators ?? []).filter(c => c.id === roleFaculty.id).length === 0 ? (
                          <p className="text-xs text-[#4A5B7A] italic">Not a coordinator here</p>
                        ) : (
                          deptRoles!.coordinators!.filter(c => c.id === roleFaculty.id).map(c => (
                            <div key={c.id + 'coord'} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-[#EEF2FF]">COORDINATOR</span>
                                {c.year && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{c.year}</span>}
                              </div>
                              <button onClick={() => handleRemoveRole(roleFaculty.id, 'COORDINATOR')} disabled={roleLoading === roleFaculty.id + 'COORDINATOR'}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                                {roleLoading === roleFaculty.id + 'COORDINATOR' ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Guide in this dept</h4>
                        {(deptRoles?.guides ?? []).filter(g => g.id === roleFaculty.id).length === 0 ? (
                          <p className="text-xs text-[#4A5B7A] italic">Not a guide here</p>
                        ) : (
                          deptRoles!.guides!.filter(g => g.id === roleFaculty.id).map(g => (
                            <div key={g.id + 'guide'} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl mb-2">
                              <span className="text-sm text-[#EEF2FF]">GUIDE</span>
                              <button onClick={() => handleRemoveRole(roleFaculty.id, 'GUIDE')} disabled={roleLoading === roleFaculty.id + 'GUIDE'}
                                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                                {roleLoading === roleFaculty.id + 'GUIDE' ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
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
                      <button onClick={handleAssignRole} disabled={roleLoading === 'assign'}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                        {roleLoading === 'assign' ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign Role
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
