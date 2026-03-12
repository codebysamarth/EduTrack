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
  Plus,
  Loader2,
  Eye,
  Pencil,
  Users,
  UserPlus,
  UserMinus,
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

interface GroupData {
  id: string; name: string; year: string; division: string
  academicYear?: string; semester?: number
  guide?: { id: string; name: string; prnNo?: string } | null
  coordinator?: { id: string; name: string } | null
  membersCount?: number
  project?: { id: string; title: string; status: string } | null
  departmentId?: string
  department?: { id: string; name: string; code: string } | null
  status?: string
}

const GROUP_STATUS_LABELS: Record<string, string> = { FORMING: 'Forming', PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved' }
const GROUP_STATUS_COLORS: Record<string, string> = { FORMING: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30', APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }

interface GroupDetail {
  id: string; name: string; year: string; division: string
  academicYear?: string; semester?: number
  guide?: { id: string; name: string; prnNo?: string } | null
  coordinator?: { id: string; name: string } | null
  members?: { id: string; student: { id: string; name: string; prnNo?: string; email: string }; isLeader: boolean }[]
  project?: { id: string; title: string; status: string; domain?: string } | null
  department?: { id: string; name: string } | null
}

interface DeptData { id: string; name: string; code: string }
interface FacultyItem { id: string; name: string; prnNo?: string }
interface StudentItem { id: string; name: string; prnNo?: string }

type Year = 'FY' | 'SY' | 'TY' | 'FINAL'
const YEARS: Year[] = ['FY', 'SY', 'TY', 'FINAL']
const PAGE_SIZE = 20

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<GroupData[]>([])
  const [departments, setDepartments] = useState<DeptData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterYear, setFilterYear] = useState<Year | ''>('')
  const [page, setPage] = useState(1)

  // View dialog
  const [viewGroup, setViewGroup] = useState<GroupDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Edit dialog
  const [editGroup, setEditGroup] = useState<GroupDetail | null>(null)
  const [editGuideId, setEditGuideId] = useState('')
  const [editFacultyList, setEditFacultyList] = useState<FacultyItem[]>([])
  const [addStudentIds, setAddStudentIds] = useState<string[]>([])
  const [removeStudentIds, setRemoveStudentIds] = useState<string[]>([])
  const [deptStudents, setDeptStudents] = useState<StudentItem[]>([])
  const [addStudentSearch, setAddStudentSearch] = useState('')

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', departmentId: '', year: 'TY' as Year, division: '',
    academicYear: '', semester: 1, guideId: '',
  })
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([])
  const [createFaculty, setCreateFaculty] = useState<FacultyItem[]>([])
  const [createStudents, setCreateStudents] = useState<StudentItem[]>([])
  const [createStudentSearch, setCreateStudentSearch] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [gRes, dRes] = await Promise.all([
        api.get('/groups'),
        api.get('/departments'),
      ])
      setGroups(Array.isArray(gRes.data) ? gRes.data : [])
      setDepartments(Array.isArray(dRes.data) ? dRes.data : [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtered + paginated
  const filtered = groups.filter(g => {
    if (search) {
      const q = search.toLowerCase()
      if (!g.name.toLowerCase().includes(q) && !(g.guide?.name ?? '').toLowerCase().includes(q) &&
        !(g.project?.title ?? '').toLowerCase().includes(q)) return false
    }
    if (filterDept && (g.departmentId ?? g.department?.id) !== filterDept) return false
    if (filterYear && g.year !== filterYear) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterDept, filterYear])

  const handleExport = async () => {
    try {
      const res = await api.get('/export/groups')
      downloadAsExcel(res.data, 'groups')
    } catch { /* */ }
  }

  // View
  const openView = async (g: GroupData) => {
    setViewLoading(true)
    setViewGroup(null)
    try {
      const res = await api.get(`/groups/${g.id}`)
      setViewGroup(res.data)
    } catch { /* */ }
    setViewLoading(false)
  }

  // Edit
  const openEdit = async (g: GroupData) => {
    try {
      const [gRes, fRes, sRes] = await Promise.all([
        api.get(`/groups/${g.id}`),
        api.get(`/users/faculty?departmentId=${g.departmentId ?? g.department?.id ?? ''}`),
        api.get(`/users/students?departmentId=${g.departmentId ?? g.department?.id ?? ''}`),
      ])
      setEditGroup(gRes.data)
      setEditGuideId(gRes.data.guide?.id ?? '')
      setEditFacultyList(fRes.data)
      setDeptStudents(sRes.data)
      setAddStudentIds([])
      setRemoveStudentIds([])
      setAddStudentSearch('')
    } catch { /* */ }
  }

  const handleSaveEdit = async () => {
    if (!editGroup) return
    setActionLoading(true)
    try {
      const body: Record<string, unknown> = {}
      if (editGuideId && editGuideId !== editGroup.guide?.id) body.guideId = editGuideId
      if (addStudentIds.length > 0) body.addStudentIds = addStudentIds
      if (removeStudentIds.length > 0) body.removeStudentIds = removeStudentIds
      await api.patch(`/groups/${editGroup.id}`, body)
      setEditGroup(null)
      await fetchData()
    } catch { /* */ }
    setActionLoading(false)
  }

  // Create
  const openCreate = () => {
    setShowCreate(true)
    setCreateForm({ name: '', departmentId: '', year: 'TY', division: '', academicYear: '', semester: 1, guideId: '' })
    setCreateStudentIds([])
    setCreateFaculty([])
    setCreateStudents([])
    setCreateStudentSearch('')
  }

  const onCreateDeptChange = async (deptId: string) => {
    setCreateForm(p => ({ ...p, departmentId: deptId }))
    if (!deptId) { setCreateFaculty([]); setCreateStudents([]); return }
    try {
      const [fRes, sRes] = await Promise.all([
        api.get(`/users/faculty?departmentId=${deptId}`),
        api.get(`/users/students?departmentId=${deptId}`),
      ])
      setCreateFaculty(fRes.data)
      setCreateStudents(sRes.data)
    } catch { /* */ }
  }

  const handleCreate = async () => {
    setActionLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: createForm.name,
        departmentId: createForm.departmentId,
        year: createForm.year,
        division: createForm.division,
        academicYear: createForm.academicYear,
        semester: createForm.semester,
        studentIds: createStudentIds,
      }
      if (createForm.guideId) body.guideId = createForm.guideId
      await api.post('/groups', body)
      setShowCreate(false)
      await fetchData()
    } catch { /* */ }
    setActionLoading(false)
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

  const existingMemberIds = new Set(editGroup?.members?.map(m => m.student.id) ?? [])

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">Groups Management</h1>
          <p className="text-sm text-[#7A8BAF] mt-1">{filtered.length} groups</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] rounded-xl text-sm transition-all duration-200">
            <Download size={14} /> Export Excel
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all duration-200">
            <Plus size={14} /> Create Group
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search group, guide, project..."
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
      </div>

      {/* Table */}
      <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A3A5C]">
                {['Group', 'Dept', 'Year', 'Division', 'Guide', 'Students', 'Group Status', 'Project', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-[#4A5B7A] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-sm text-[#4A5B7A]">No groups found</td></tr>
              ) : paginated.map(g => (
                <tr key={g.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                  <td className="py-3 px-4 text-[#EEF2FF] font-medium">{g.name}</td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{g.department?.code ?? departments.find(d => d.id === g.departmentId)?.code ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{g.year}</span>
                  </td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{g.division}</td>
                  <td className="py-3 px-4">
                    {g.guide ? (
                      <div>
                        <span className="text-xs text-[#EEF2FF]">{g.guide.name}</span>
                        {g.guide.prnNo && <div><PrnBadge prn={g.guide.prnNo} /></div>}
                      </div>
                    ) : <span className="text-xs text-[#4A5B7A]">—</span>}
                  </td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{g.membersCount ?? 0}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${GROUP_STATUS_COLORS[g.status ?? 'APPROVED'] ?? 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'}`}>
                      {GROUP_STATUS_LABELS[g.status ?? 'APPROVED'] ?? g.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs max-w-[150px] truncate">{g.project?.title ?? '—'}</td>
                  <td className="py-3 px-4">
                    {g.project ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        g.project.status === 'PUBLISHED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        g.project.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        g.project.status === 'SUBMITTED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'
                      }`}>{g.project.status}</span>
                    ) : <span className="text-[10px] text-[#4A5B7A]">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openView(g)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                        <Eye size={10} /> View
                      </button>
                      <button onClick={() => openEdit(g)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <Pencil size={10} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* ═══ View Group Dialog ═══ */}
      <AnimatePresence>
        {(viewGroup || viewLoading) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setViewGroup(null); setViewLoading(false) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {viewLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-32" />
                </div>
              ) : viewGroup && (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">{viewGroup.name}</h3>
                    <button onClick={() => setViewGroup(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
                  </div>
                  <div className="space-y-3 mb-5">
                    {[
                      { label: 'Department', value: viewGroup.department?.name ?? '—' },
                      { label: 'Year / Division', value: `${viewGroup.year} / ${viewGroup.division}` },
                      { label: 'Academic Year', value: viewGroup.academicYear ?? '—' },
                      { label: 'Semester', value: viewGroup.semester?.toString() ?? '—' },
                      { label: 'Guide', value: viewGroup.guide?.name ?? '—' },
                      { label: 'Project', value: viewGroup.project?.title ?? '—' },
                      { label: 'Project Status', value: viewGroup.project?.status ?? '—' },
                    ].map(r => (
                      <div key={r.label} className="flex items-start justify-between py-2 border-b border-[#2A3A5C]/50">
                        <span className="text-xs text-[#7A8BAF]">{r.label}</span>
                        <span className="text-sm text-[#EEF2FF] text-right">{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Members ({viewGroup.members?.length ?? 0})</h4>
                  <div className="space-y-2">
                    {(viewGroup.members ?? []).map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#EEF2FF]">{m.student.name}</span>
                          {m.student.prnNo && <PrnBadge prn={m.student.prnNo} />}
                          {m.isLeader && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Leader</span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#4A5B7A]">{m.student.email}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Edit Group Dialog ═══ */}
      <AnimatePresence>
        {editGroup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditGroup(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Edit {editGroup.name}</h3>
                <button onClick={() => setEditGroup(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              {/* Change guide */}
              <div className="mb-5">
                <label className="block text-xs text-[#7A8BAF] mb-1.5">Guide</label>
                <select value={editGuideId} onChange={e => setEditGuideId(e.target.value)} className={inputCls}>
                  <option value="">No guide</option>
                  {editFacultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.name} {f.prnNo ? `(${f.prnNo})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Current members */}
              <div className="mb-5">
                <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Current Members</h4>
                <div className="space-y-2">
                  {(editGroup.members ?? []).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#EEF2FF]">{m.student.name}</span>
                        {m.student.prnNo && <PrnBadge prn={m.student.prnNo} />}
                        {m.isLeader && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Leader</span>}
                      </div>
                      <button onClick={() => setRemoveStudentIds(prev =>
                        prev.includes(m.student.id) ? prev.filter(x => x !== m.student.id) : [...prev, m.student.id]
                      )} className={`text-xs flex items-center gap-1 transition-colors ${removeStudentIds.includes(m.student.id) ? 'text-red-400' : 'text-[#4A5B7A] hover:text-red-400'}`}>
                        <UserMinus size={10} /> {removeStudentIds.includes(m.student.id) ? 'Will remove' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add students */}
              <div className="mb-5">
                <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Add Students</h4>
                <input type="text" value={addStudentSearch} onChange={e => setAddStudentSearch(e.target.value)} placeholder="Search students..."
                  className={`${inputCls} mb-2`} />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {deptStudents
                    .filter(s => !existingMemberIds.has(s.id))
                    .filter(s => !addStudentSearch || s.name.toLowerCase().includes(addStudentSearch.toLowerCase()) || (s.prnNo ?? '').toLowerCase().includes(addStudentSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(s => (
                      <button key={s.id} onClick={() => setAddStudentIds(prev =>
                        prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                      )} className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-all ${addStudentIds.includes(s.id) ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-[#1A2540] border border-transparent hover:border-[#2A3A5C]'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[#EEF2FF]">{s.name}</span>
                          {s.prnNo && <PrnBadge prn={s.prnNo} />}
                        </div>
                        {addStudentIds.includes(s.id) && <UserPlus size={12} className="text-amber-400" />}
                      </button>
                    ))}
                </div>
              </div>

              <button onClick={handleSaveEdit} disabled={actionLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Save Changes
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Create Group Dialog ═══ */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Create Group</h3>
                <button onClick={() => setShowCreate(false)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Group Name *</label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Group A1" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Department *</label>
                  <select value={createForm.departmentId} onChange={e => onCreateDeptChange(e.target.value)} className={inputCls}>
                    <option value="">Select department...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Year *</label>
                    <select value={createForm.year} onChange={e => setCreateForm(p => ({ ...p, year: e.target.value as Year }))} className={inputCls}>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Division *</label>
                    <input type="text" value={createForm.division} onChange={e => setCreateForm(p => ({ ...p, division: e.target.value }))} className={inputCls} placeholder="A" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Academic Year</label>
                    <input type="text" value={createForm.academicYear} onChange={e => setCreateForm(p => ({ ...p, academicYear: e.target.value }))} className={inputCls} placeholder="2024-25" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Semester</label>
                    <input type="number" value={createForm.semester} onChange={e => setCreateForm(p => ({ ...p, semester: parseInt(e.target.value) || 1 }))} className={inputCls} min={1} max={8} />
                  </div>
                </div>
                {createForm.departmentId && (
                  <>
                    <div>
                      <label className="block text-xs text-[#7A8BAF] mb-1.5">Guide (optional)</label>
                      <select value={createForm.guideId} onChange={e => setCreateForm(p => ({ ...p, guideId: e.target.value }))} className={inputCls}>
                        <option value="">No guide</option>
                        {createFaculty.map(f => <option key={f.id} value={f.id}>{f.name} {f.prnNo ? `(${f.prnNo})` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#7A8BAF] mb-1.5">Students</label>
                      <input type="text" value={createStudentSearch} onChange={e => setCreateStudentSearch(e.target.value)} placeholder="Search students..."
                        className={`${inputCls} mb-2`} />
                      {createStudentIds.length > 0 && (
                        <p className="text-xs text-amber-400 mb-2">{createStudentIds.length} selected</p>
                      )}
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {createStudents
                          .filter(s => !createStudentSearch || s.name.toLowerCase().includes(createStudentSearch.toLowerCase()) || (s.prnNo ?? '').toLowerCase().includes(createStudentSearch.toLowerCase()))
                          .slice(0, 20)
                          .map(s => (
                            <button key={s.id} onClick={() => setCreateStudentIds(prev =>
                              prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                            )} className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-all ${createStudentIds.includes(s.id) ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-[#1A2540] border border-transparent hover:border-[#2A3A5C]'}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-[#EEF2FF]">{s.name}</span>
                                {s.prnNo && <PrnBadge prn={s.prnNo} />}
                              </div>
                              {createStudentIds.includes(s.id) && <Users size={12} className="text-amber-400" />}
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button onClick={handleCreate} disabled={!createForm.name || !createForm.departmentId || !createForm.division || actionLoading}
                className="w-full mt-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Group
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
