'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Filter,
  Building2,
  GraduationCap,
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

interface StudentUser {
  id: string; name: string; email: string; prnNo?: string
  roles: string[]; isApproved: boolean
  studentProfile?: {
    enrollmentNo?: string; year?: string; division?: string
    departmentId?: string; groupId?: string
    group?: { id: string; name: string; project?: { title: string; status: string } | null } | null
  } | null
}

interface DeptData {
  id: string; name: string; code: string
}

type Year = 'FY' | 'SY' | 'TY' | 'FINAL'
const YEARS: Year[] = ['FY', 'SY', 'TY', 'FINAL']
const PAGE_SIZE = 20

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentUser[]>([])
  const [departments, setDepartments] = useState<DeptData[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterYear, setFilterYear] = useState<Year | ''>('')
  const [page, setPage] = useState(1)

  // Detail dialog
  const [detailStudent, setDetailStudent] = useState<StudentUser | null>(null)

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/departments')
      setDepartments(Array.isArray(res.data) ? res.data : [])
    } catch { /* */ }
  }, [])

  const fetchStudents = useCallback(async () => {
    if (!filterDept) { setStudents([]); setLoading(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ departmentId: filterDept })
      if (filterYear) params.set('year', filterYear)
      const res = await api.get(`/users/students?${params.toString()}`)
      setStudents(Array.isArray(res.data) ? res.data : [])
    } catch { /* */ }
    setLoading(false)
  }, [filterDept, filterYear])

  useEffect(() => { fetchDepts() }, [fetchDepts])
  useEffect(() => { fetchStudents() }, [fetchStudents])

  // Search filter
  const filtered = students.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) ||
      (s.prnNo ?? '').toLowerCase().includes(q) ||
      (s.studentProfile?.enrollmentNo ?? '').toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterDept, filterYear])

  const handleExport = () => {
    const rows = filtered.map(s => ({
      Name: s.name,
      Email: s.email,
      PRN: s.prnNo ?? '',
      EnrollmentNo: s.studentProfile?.enrollmentNo ?? '',
      Year: s.studentProfile?.year ?? '',
      Division: s.studentProfile?.division ?? '',
      Department: departments.find(d => d.id === s.studentProfile?.departmentId)?.name ?? '',
      Group: s.studentProfile?.group?.name ?? '',
      Project: s.studentProfile?.group?.project?.title ?? '',
      ProjectStatus: s.studentProfile?.group?.project?.status ?? '',
    }))
    downloadAsExcel(rows, 'students')
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none transition-all duration-200'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">Student Management</h1>
          <p className="text-sm text-[#7A8BAF] mt-1">{filterDept ? `${filtered.length} students` : 'Select a department to view students'}</p>
        </div>
        {filterDept && filtered.length > 0 && (
          <button onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] rounded-xl text-sm transition-all duration-200">
            <Download size={14} /> Export Excel
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Building2 size={12} className="text-[#4A5B7A]" />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className={`${inputCls} w-auto min-w-[180px]`}>
            <option value="">Select Department *</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setFilterYear('')}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${filterYear === '' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
            All Years
          </button>
          {YEARS.map(y => (
            <button key={y} onClick={() => setFilterYear(y)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${filterYear === y ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
              {y}
            </button>
          ))}
        </div>
        {filterDept && (
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, PRN, enrollment..."
              className={`${inputCls} pl-9`} />
          </div>
        )}
      </div>

      {/* Empty state */}
      {!filterDept ? (
        <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-12 text-center">
          <GraduationCap size={40} className="text-[#2A3A5C] mx-auto mb-3" />
          <p className="text-sm text-[#7A8BAF]">Select a department to view students</p>
          <p className="text-xs text-[#4A5B7A] mt-1">Students are organized by department</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A3A5C]">
                    {['Name', 'PRN', 'Enrollment', 'Year', 'Division', 'Group', 'Project Status', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs text-[#4A5B7A] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-sm text-[#4A5B7A]">No students found</td></tr>
                  ) : paginated.map(s => {
                    const sp = s.studentProfile
                    const proj = sp?.group?.project
                    return (
                      <tr key={s.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <span className="text-[#EEF2FF] font-medium">{s.name}</span>
                            <p className="text-[10px] text-[#4A5B7A]">{s.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">{s.prnNo ? <PrnBadge prn={s.prnNo} /> : '—'}</td>
                        <td className="py-3 px-4 text-[#7A8BAF] text-xs font-mono">{sp?.enrollmentNo ?? '—'}</td>
                        <td className="py-3 px-4">
                          {sp?.year && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{sp.year}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#7A8BAF] text-xs">{sp?.division ?? '—'}</td>
                        <td className="py-3 px-4 text-[#7A8BAF] text-xs">{sp?.group?.name ?? '—'}</td>
                        <td className="py-3 px-4">
                          {proj ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              proj.status === 'PUBLISHED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                              proj.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              proj.status === 'SUBMITTED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                              'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'
                            }`}>{proj.status}</span>
                          ) : (
                            <span className="text-[10px] text-[#4A5B7A]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => setDetailStudent(s)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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
        </>
      )}

      {/* Student Detail Dialog */}
      <AnimatePresence>
        {detailStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDetailStudent(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Student Details</h3>
                <button onClick={() => setDetailStudent(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Name', value: detailStudent.name },
                  { label: 'Email', value: detailStudent.email },
                  { label: 'PRN', value: detailStudent.prnNo ?? '—' },
                  { label: 'Enrollment No', value: detailStudent.studentProfile?.enrollmentNo ?? '—' },
                  { label: 'Year', value: detailStudent.studentProfile?.year ?? '—' },
                  { label: 'Division', value: detailStudent.studentProfile?.division ?? '—' },
                  { label: 'Department', value: departments.find(d => d.id === detailStudent.studentProfile?.departmentId)?.name ?? '—' },
                  { label: 'Group', value: detailStudent.studentProfile?.group?.name ?? '—' },
                  { label: 'Project', value: detailStudent.studentProfile?.group?.project?.title ?? '—' },
                  { label: 'Project Status', value: detailStudent.studentProfile?.group?.project?.status ?? '—' },
                ].map(row => (
                  <div key={row.label} className="flex items-start justify-between py-2 border-b border-[#2A3A5C]/50">
                    <span className="text-xs text-[#7A8BAF]">{row.label}</span>
                    <span className="text-sm text-[#EEF2FF] text-right max-w-[60%]">{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
