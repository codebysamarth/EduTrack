'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Download,
  X,
  Loader2,
  UserPlus,
  Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
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

interface FacultyData {
  id: string; name: string; email: string; prnNo?: string; designation?: string
  roles: string[]; isApproved: boolean
}

interface DeptData {
  id: string; name: string; code: string
}

type Year = 'FY' | 'SY' | 'TY' | 'FINAL'
const YEARS: Year[] = ['FY', 'SY', 'TY', 'FINAL']
const ROLE_NAMES = ['GUIDE', 'COORDINATOR'] as const
type RoleFilter = 'all' | 'GUIDE' | 'COORDINATOR' | 'none'

export default function HodFacultyPage() {
  const { user } = useAuth()
  const deptId = user?.facultyProfile?.departmentId ?? ''

  const [faculty, setFaculty] = useState<FacultyData[]>([])
  const [dept, setDept] = useState<DeptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  // Assign role dialog
  const [assignTarget, setAssignTarget] = useState<FacultyData | null>(null)
  const [assignRole, setAssignRole] = useState<typeof ROLE_NAMES[number]>('GUIDE')
  const [assignYear, setAssignYear] = useState<Year | ''>('')

  // Remove role dialog
  const [removeTarget, setRemoveTarget] = useState<{ faculty: FacultyData; role: string } | null>(null)

  const fetchData = useCallback(async () => {
    if (!deptId) return
    try {
      const [fRes, dRes] = await Promise.all([
        api.get(`/users/faculty?departmentId=${deptId}`),
        api.get(`/departments/${deptId}`),
      ])
      setFaculty(fRes.data)
      setDept(dRes.data)
    } catch { /* */ }
    setLoading(false)
  }, [deptId])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = faculty.filter(f => {
    if (search) {
      const q = search.toLowerCase()
      if (!f.name.toLowerCase().includes(q) && !(f.prnNo ?? '').toLowerCase().includes(q)) return false
    }
    if (roleFilter === 'none' && f.roles.some(r => r === 'GUIDE' || r === 'COORDINATOR')) return false
    if (roleFilter === 'GUIDE' && !f.roles.includes('GUIDE')) return false
    if (roleFilter === 'COORDINATOR' && !f.roles.includes('COORDINATOR')) return false
    return true
  })

  const handleAssignRole = async () => {
    if (!assignTarget) return
    setRoleLoading(assignTarget.id)
    try {
      await api.post('/users/assign-role', {
        userId: assignTarget.id,
        roleName: assignRole,
        departmentId: deptId,
        year: assignRole === 'COORDINATOR' ? assignYear || undefined : undefined,
      })
      setAssignTarget(null)
      await fetchData()
    } catch { /* */ }
    setRoleLoading(null)
  }

  const handleRemoveRole = async () => {
    if (!removeTarget) return
    setRoleLoading(removeTarget.faculty.id)
    try {
      await api.delete('/users/remove-role', {
        data: { userId: removeTarget.faculty.id, roleName: removeTarget.role, departmentId: deptId },
      })
      setRemoveTarget(null)
      await fetchData()
    } catch { /* */ }
    setRoleLoading(null)
  }

  const handleExport = () => {
    const rows = filtered.map(f => ({
      Name: f.name,
      PRN: f.prnNo ?? '',
      Email: f.email,
      Designation: f.designation ?? '',
      Roles: f.roles.join(', '),
    }))
    downloadAsExcel(rows, 'department_faculty_export')
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
          <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">
            Faculty {dept ? `— ${dept.name}` : ''}
          </h1>
          <p className="text-sm text-[#7A8BAF] mt-1">
            <span className="px-2 py-0.5 rounded-full bg-[#1A2540] border border-[#2A3A5C] text-xs">{filtered.length} members</span>
          </p>
        </div>
        <button onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] rounded-xl text-sm transition-all duration-200">
          <Download size={14} /> Export Faculty
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['all', 'GUIDE', 'COORDINATOR', 'none'] as const).map(f => (
            <button key={f} onClick={() => setRoleFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${roleFilter === f ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
              {f === 'all' ? 'All' : f === 'none' ? 'No Role' : f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or PRN..."
            className={`${inputCls} pl-9`} />
        </div>
      </div>

      {/* Faculty Table */}
      <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A3A5C]">
                {['Name', 'PRN', 'Designation', 'Roles', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-[#4A5B7A] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-sm text-[#4A5B7A]">No faculty found</td></tr>
              ) : filtered.map(f => (
                <tr key={f.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-semibold shrink-0">
                        {f.name.charAt(0)}
                      </div>
                      <div>
                        <span className="text-[#EEF2FF] font-medium">{f.name}</span>
                        <p className="text-[10px] text-[#4A5B7A]">{f.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{f.prnNo ? <PrnBadge prn={f.prnNo} /> : '—'}</td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-sm">{f.designation || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {f.roles.filter(r => r === 'GUIDE' || r === 'COORDINATOR').length === 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2540] text-[#4A5B7A] border border-[#2A3A5C]">No Role</span>
                      ) : f.roles.filter(r => r === 'GUIDE' || r === 'COORDINATOR').map(r => (
                        <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          r === 'GUIDE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setAssignTarget(f); setAssignRole('GUIDE'); setAssignYear('') }}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all">
                        <UserPlus size={10} /> Assign Role
                      </button>
                      {f.roles.some(r => r === 'GUIDE' || r === 'COORDINATOR') && (
                        <button onClick={() => setRemoveTarget({ faculty: f, role: f.roles.find(r => r === 'GUIDE' || r === 'COORDINATOR')! })}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#2A3A5C] text-red-400/70 hover:text-red-400 hover:border-red-500/30 transition-all">
                          <Trash2 size={10} /> Remove Role
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Assign Role Dialog ═══ */}
      <AnimatePresence>
        {assignTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAssignTarget(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Assign Role</h3>
                <button onClick={() => setAssignTarget(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-[#EEF2FF] font-medium">{assignTarget.name}</span>
                {assignTarget.prnNo && <PrnBadge prn={assignTarget.prnNo} />}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-2">Role</label>
                  <div className="flex gap-2">
                    {ROLE_NAMES.map(r => (
                      <button key={r} onClick={() => setAssignRole(r)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-200 ${assignRole === r ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {assignRole === 'COORDINATOR' && (
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-2">Year (optional)</label>
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
              </div>

              <button onClick={handleAssignRole} disabled={roleLoading === assignTarget.id}
                className="w-full mt-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                {roleLoading === assignTarget.id ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Assign
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Remove Role Dialog ═══ */}
      <AnimatePresence>
        {removeTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRemoveTarget(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Remove Role</h3>
                <button onClick={() => setRemoveTarget(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              <p className="text-sm text-[#7A8BAF] mb-3">
                Remove role from <span className="text-[#EEF2FF] font-medium">{removeTarget.faculty.name}</span>
              </p>

              {/* Let them pick which role to remove if they have multiple */}
              <div className="space-y-2 mb-5">
                {removeTarget.faculty.roles.filter(r => r === 'GUIDE' || r === 'COORDINATOR').map(r => (
                  <button key={r} onClick={() => setRemoveTarget(prev => prev ? { ...prev, role: r } : null)}
                    className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium border text-left transition-all duration-200 ${removeTarget.role === r ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
                    {r}
                  </button>
                ))}
              </div>

              <button onClick={handleRemoveRole} disabled={roleLoading === removeTarget.faculty.id}
                className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 border border-red-500/30 disabled:opacity-60 transition-all duration-200">
                {roleLoading === removeTarget.faculty.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
