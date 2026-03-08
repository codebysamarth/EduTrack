'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  GraduationCap,
  UserCheck,
  LayoutGrid,
  Plus,
  X,
  Loader2,
  Crown,
  Download,
  Search,
  Pencil,
  Eye,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { api } from '@/lib/api'
import { downloadAsExcel } from '@/lib/exportExcel'
import { useAuth } from '@/context/AuthContext'
import type { Year } from '@/types'

// ─── Shared helpers ────────────────────────────────────
function PrnBadge({ prn }: { prn: string }) {
  return (
    <span className="font-mono text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/20">
      {prn}
    </span>
  )
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review',
  REJECTED: 'Rejected', APPROVED: 'Approved', COMPLETED: 'Completed', PUBLISHED: 'Published',
}
const STATUS_COLORS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  SUBMITTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  UNDER_REVIEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  COMPLETED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PUBLISHED: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
}
const PIE_COLORS: Record<string, string> = {
  DRAFT: '#6B7280', SUBMITTED: '#3B82F6', UNDER_REVIEW: '#F59E0B',
  REJECTED: '#EF4444', APPROVED: '#10B981', COMPLETED: '#A855F7', PUBLISHED: '#7C3AED',
}
const YEARS: Year[] = ['FY', 'SY', 'TY', 'FINAL']

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS_CLS[status] ?? STATUS_COLORS_CLS.DRAFT}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2540] ${className}`} />
}

interface GroupData {
  id: string; name: string; year: string; division: string; academicYear: string; semester: number
  guide?: { id: string; name: string; prnNo?: string }
  coordinator?: { id: string; name: string }
  membersCount?: number; members?: MemberData[]
  project?: { id: string; title: string; status: string; domain?: string; sdgGoals?: number[] }
}
interface MemberData {
  id: string; isLeader: boolean
  student: { id: string; name: string; prnNo?: string; enrollmentNo?: string; email?: string }
}
interface FacultyData {
  id: string; name: string; email: string; prnNo?: string; designation?: string
  roles?: string[]; isApproved: boolean
}
interface StudentData {
  id: string; name: string; email: string; prnNo?: string; enrollmentNo?: string
  year: string; division: string
  group?: { id: string; name: string; guideName?: string } | null
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function CoordinatorPage() {
  const { user } = useAuth()
  const deptId = user?.facultyProfile?.departmentId ?? user?.studentProfile?.departmentId ?? ''

  const [groups, setGroups] = useState<GroupData[]>([])
  const [students, setStudents] = useState<StudentData[]>([])
  const [faculty, setFaculty] = useState<FacultyData[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterYear, setFilterYear] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Create group dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', year: '' as Year | '', division: '', academicYear: '', semester: 1,
    guideId: '', studentIds: [] as string[],
  })
  const [guideSearch, setGuideSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // View dialog
  const [viewDetail, setViewDetail] = useState<GroupData | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Edit dialog
  const [editGroup, setEditGroup] = useState<GroupData | null>(null)
  const [editGuideId, setEditGuideId] = useState('')
  const [editMembers, setEditMembers] = useState<MemberData[]>([])
  const [addStudentIds, setAddStudentIds] = useState<string[]>([])
  const [removeStudentIds, setRemoveStudentIds] = useState<string[]>([])
  const [editStudentSearch, setEditStudentSearch] = useState('')
  const [editStudents, setEditStudents] = useState<StudentData[]>([])
  const [editLoading, setEditLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!deptId) return
    try {
      const [g, s, f] = await Promise.all([
        api.get('/groups'),
        api.get(`/users/students?departmentId=${deptId}`),
        api.get(`/users/faculty?departmentId=${deptId}`),
      ])
      setGroups(g.data)
      setStudents(s.data)
      setFaculty(f.data)
    } catch { /* */ }
    setLoading(false)
  }, [deptId])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (filterYear && g.year !== filterYear) return false
      if (filterDiv && g.division !== filterDiv) return false
      if (filterStatus) {
        if (!g.project && filterStatus !== 'NONE') return false
        if (g.project && g.project.status !== filterStatus) return false
      }
      return true
    })
  }, [groups, filterYear, filterDiv, filterStatus])

  const divisions = useMemo(() => [...new Set(groups.map(g => g.division))].sort(), [groups])

  // Stats
  const submittedPct = groups.length > 0
    ? Math.round((groups.filter(g => g.project && g.project.status !== 'DRAFT').length / groups.length) * 100)
    : 0
  const guidesCount = new Set(groups.filter(g => g.guide?.id).map(g => g.guide!.id)).size

  // Pie chart
  const statusCounts: Record<string, number> = {}
  groups.forEach(g => {
    const s = g.project?.status ?? 'NO_PROJECT'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  })
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({
    name: STATUS_LABELS[k] || 'No Project', value: v, key: k,
  }))

  // Available students (not in any group)
  const availableStudents = useMemo(() => {
    return students.filter(s => !s.group)
  }, [students])

  const filteredFaculty = useMemo(() => {
    const q = guideSearch.toLowerCase()
    return faculty.filter(f => f.isApproved && (
      f.name.toLowerCase().includes(q) || (f.prnNo ?? '').toLowerCase().includes(q)
    ))
  }, [faculty, guideSearch])

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase()
    return availableStudents.filter(s =>
      s.name.toLowerCase().includes(q) || (s.prnNo ?? '').toLowerCase().includes(q) || (s.enrollmentNo ?? '').toLowerCase().includes(q)
    )
  }, [availableStudents, studentSearch])

  const handleCreateGroup = async () => {
    setCreateLoading(true)
    try {
      await api.post('/groups', {
        name: createForm.name,
        departmentId: deptId,
        year: createForm.year,
        division: createForm.division,
        academicYear: createForm.academicYear,
        semester: createForm.semester,
        guideId: createForm.guideId || undefined,
        studentIds: createForm.studentIds,
      })
      setShowCreate(false)
      setCreateForm({ name: '', year: '', division: '', academicYear: '', semester: 1, guideId: '', studentIds: [] })
      await fetchData()
    } catch { /* */ }
    setCreateLoading(false)
  }

  const toggleStudent = (id: string) => {
    setCreateForm(p => ({
      ...p,
      studentIds: p.studentIds.includes(id) ? p.studentIds.filter(s => s !== id) : p.studentIds.length < 5 ? [...p.studentIds, id] : p.studentIds,
    }))
  }

  // View group
  const openView = async (g: GroupData) => {
    setViewLoading(true)
    setViewDetail(null)
    try {
      const res = await api.get(`/groups/${g.id}`)
      setViewDetail(res.data)
    } catch { /* */ }
    setViewLoading(false)
  }

  // Edit group
  const openEdit = async (g: GroupData) => {
    try {
      const [gRes, sRes] = await Promise.all([
        api.get(`/groups/${g.id}`),
        api.get(`/users/students?departmentId=${deptId}&year=${g.year}`),
      ])
      setEditGroup(gRes.data)
      setEditGuideId(gRes.data.guide?.id ?? '')
      setEditMembers(gRes.data.members ?? [])
      setEditStudents(sRes.data)
      setAddStudentIds([])
      setRemoveStudentIds([])
      setEditStudentSearch('')
    } catch { /* */ }
  }

  const handleSaveEdit = async () => {
    if (!editGroup) return
    setEditLoading(true)
    try {
      const body: Record<string, unknown> = {}
      const origGuideId = editGroup.guide?.id ?? ''
      if (editGuideId !== origGuideId) body.guideId = editGuideId || null
      if (addStudentIds.length > 0) body.addStudentIds = addStudentIds
      if (removeStudentIds.length > 0) body.removeStudentIds = removeStudentIds
      await api.patch(`/groups/${editGroup.id}`, body)
      setEditGroup(null)
      toast.success('Group updated')
      await fetchData()
    } catch { /* */ }
    setEditLoading(false)
  }

  const currentMemberCount = editMembers.length - removeStudentIds.length + addStudentIds.length

  const exportToExcel = async () => {
    try {
      const response = await api.get('/export/groups')
      downloadAsExcel(response.data, 'coordinator_groups_export')
    } catch { /* */ }
  }

  const exportProjects = async () => {
    try {
      const response = await api.get('/export/projects')
      downloadAsExcel(response.data, 'coordinator_projects_export')
    } catch { /* */ }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none transition-all duration-200'

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ═══ SECTION 1 — Stats ═══ */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Groups', value: groups.length, icon: LayoutGrid },
          { label: 'Total Students', value: students.length, icon: GraduationCap },
          { label: 'Submitted %', value: `${submittedPct}%`, icon: UserCheck },
          { label: 'Guides', value: guidesCount, icon: Users },
        ].map(c => (
          <div key={c.label} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={14} className="text-[#4A5B7A]" />
              <span className="text-xs text-[#7A8BAF]">{c.label}</span>
            </div>
            <p className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">{c.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ═══ SECTION 2 — Groups table ═══ */}
      <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Groups</h3>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all duration-200">
            <Plus size={14} /> Create Group
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
            <option value="">All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
            className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
            <option value="">All Divisions</option>
            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="text-center py-8">
            <LayoutGrid size={32} className="text-[#2A3A5C] mx-auto mb-2" />
            <p className="text-sm text-[#7A8BAF]">No groups found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A3A5C]">
                  {['Group', 'Year', 'Div', 'Guide', 'Students', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-[#4A5B7A] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map(g => (
                  <tr key={g.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                    <td className="py-3 px-3 text-[#EEF2FF] font-medium">{g.name}</td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{g.year}</td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{g.division}</td>
                    <td className="py-3 px-3">
                      {g.guide ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[#EEF2FF] text-xs">{g.guide.name}</span>
                          {g.guide.prnNo && <PrnBadge prn={g.guide.prnNo} />}
                        </div>
                      ) : (
                        <span className="text-[#4A5B7A] text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{g.membersCount ?? g.members?.length ?? '—'}</td>
                    <td className="py-3 px-3">
                      {g.project ? <StatusBadge status={g.project.status} /> : <span className="text-xs text-[#4A5B7A]">—</span>}
                    </td>
                    <td className="py-3 px-3">
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
        )}
      </motion.div>

      {/* ═══ SECTION 4 — Pie Chart ═══ */}
      {pieData.length > 0 && (
        <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4">Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={2} stroke="none">
                  {pieData.map(entry => (
                    <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? '#4A5B7A'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0F1729', border: '1px solid #2A3A5C', borderRadius: 12, color: '#EEF2FF' }} />
                <Legend formatter={(value) => <span className="text-xs text-[#7A8BAF]">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ═══ SECTION 5 — Export ═══ */}
      <motion.div variants={item} className="flex items-center gap-3">
        <button onClick={exportToExcel}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2A3A5C] text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/50 rounded-xl transition-all duration-200 text-sm">
          <Download size={16} /> Export All Groups
        </button>
        <button onClick={exportProjects}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2A3A5C] text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/50 rounded-xl transition-all duration-200 text-sm">
          <Download size={16} /> Export Projects
        </button>
      </motion.div>

      {/* ═══ View Group Dialog ═══ */}
      <AnimatePresence>
        {(viewDetail || viewLoading) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setViewDetail(null); setViewLoading(false) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {viewLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-32" />
                </div>
              ) : viewDetail && (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">{viewDetail.name}</h3>
                    <button onClick={() => setViewDetail(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
                  </div>
                  <div className="space-y-3 mb-5">
                    {[
                      { label: 'Year / Division', value: `${viewDetail.year} / ${viewDetail.division}` },
                      { label: 'Academic Year', value: viewDetail.academicYear ?? '—' },
                      { label: 'Semester', value: viewDetail.semester?.toString() ?? '—' },
                      { label: 'Guide', value: viewDetail.guide?.name ?? 'Unassigned' },
                      { label: 'Project', value: viewDetail.project?.title ?? '—' },
                      { label: 'Project Status', value: viewDetail.project?.status ?? '—' },
                    ].map(r => (
                      <div key={r.label} className="flex items-start justify-between py-2 border-b border-[#2A3A5C]/50">
                        <span className="text-xs text-[#7A8BAF]">{r.label}</span>
                        <span className="text-sm text-[#EEF2FF] text-right">{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Members ({viewDetail.members?.length ?? viewDetail.membersCount ?? 0})</h4>
                  <div className="space-y-2">
                    {(viewDetail.members ?? []).map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-[10px] font-semibold shrink-0">
                            {m.student.name.charAt(0)}
                          </div>
                          <span className="text-sm text-[#EEF2FF]">{m.student.name}</span>
                          {m.student.prnNo && <PrnBadge prn={m.student.prnNo} />}
                          {m.student.enrollmentNo && <span className="text-[10px] text-[#4A5B7A] font-mono">{m.student.enrollmentNo}</span>}
                          {m.isLeader && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">👑 Leader</span>
                          )}
                        </div>
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
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Edit Group — {editGroup.name}</h3>
                <button onClick={() => setEditGroup(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              {/* Section 1 — Change Guide */}
              <div className="mb-5">
                <label className="block text-xs text-[#7A8BAF] mb-1.5">Assigned Guide</label>
                {editGroup.guide && (
                  <div className="flex items-center gap-2 mb-2 p-2.5 bg-[#1A2540] rounded-xl">
                    <span className="text-sm text-[#EEF2FF]">{editGroup.guide.name}</span>
                    {editGroup.guide.prnNo && <PrnBadge prn={editGroup.guide.prnNo} />}
                    <span className="text-[10px] text-[#4A5B7A] ml-auto">current</span>
                  </div>
                )}
                <select value={editGuideId} onChange={e => setEditGuideId(e.target.value)} className={inputCls}>
                  <option value="">No guide</option>
                  {faculty.filter(f => f.isApproved).map(f => (
                    <option key={f.id} value={f.id}>{f.name} {f.prnNo ? `(${f.prnNo})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Section 2 — Current Members */}
              <div className="mb-5">
                <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Current Members</h4>
                <div className="space-y-2">
                  {editMembers.map(m => {
                    const willRemove = removeStudentIds.includes(m.student.id)
                    return (
                      <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl transition-all ${willRemove ? 'bg-red-500/5 border border-red-500/20' : 'bg-[#1A2540]'}`}>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-[10px] font-semibold shrink-0">
                            {m.student.name.charAt(0)}
                          </div>
                          <span className={`text-sm ${willRemove ? 'text-[#4A5B7A] line-through' : 'text-[#EEF2FF]'}`}>{m.student.name}</span>
                          {m.student.prnNo && <PrnBadge prn={m.student.prnNo} />}
                          {m.student.enrollmentNo && <span className="text-[10px] text-[#4A5B7A] font-mono">{m.student.enrollmentNo}</span>}
                          {m.isLeader && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">👑 Leader</span>
                          )}
                        </div>
                        {!m.isLeader && (
                          <button onClick={() => setRemoveStudentIds(prev =>
                            prev.includes(m.student.id) ? prev.filter(x => x !== m.student.id) : [...prev, m.student.id]
                          )} className={`text-xs flex items-center gap-1 transition-colors ${willRemove ? 'text-amber-400 hover:text-amber-300' : 'text-red-400/60 hover:text-red-400'}`}>
                            <UserMinus size={10} /> {willRemove ? 'Undo' : 'Remove'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Section 3 — Add New Students */}
              {currentMemberCount < 5 && (
                <div className="mb-5">
                  <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Add New Students</h4>
                  <p className={`text-xs mb-2 ${currentMemberCount >= 5 ? 'text-red-400' : currentMemberCount < 3 ? 'text-amber-400' : 'text-[#7A8BAF]'}`}>
                    {currentMemberCount}/5 members
                  </p>
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
                    <input type="text" value={editStudentSearch} onChange={e => setEditStudentSearch(e.target.value)}
                      className={`${inputCls} pl-8`} placeholder="Search students..." />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {editStudents
                      .filter(s => !s.group)
                      .filter(s => !editMembers.some(m => m.student.id === s.id))
                      .filter(s => !editStudentSearch || s.name.toLowerCase().includes(editStudentSearch.toLowerCase()) || (s.prnNo ?? '').toLowerCase().includes(editStudentSearch.toLowerCase()) || (s.enrollmentNo ?? '').toLowerCase().includes(editStudentSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(s => (
                        <button key={s.id} onClick={() => setAddStudentIds(prev =>
                          prev.includes(s.id) ? prev.filter(x => x !== s.id) : currentMemberCount + (prev.includes(s.id) ? 0 : 1) <= 5 ? [...prev, s.id] : prev
                        )} className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-all ${addStudentIds.includes(s.id) ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-[#1A2540] border border-transparent hover:border-[#2A3A5C]'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[#EEF2FF]">{s.name}</span>
                            {s.prnNo && <PrnBadge prn={s.prnNo} />}
                            {s.enrollmentNo && <span className="text-[10px] text-[#4A5B7A] font-mono">{s.enrollmentNo}</span>}
                          </div>
                          {addStudentIds.includes(s.id) && <UserPlus size={12} className="text-amber-400" />}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-3">
                <button onClick={() => setEditGroup(null)}
                  className="flex-1 py-2.5 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] rounded-xl text-sm transition-all duration-200">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={editLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                  {editLoading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Save Changes
                </button>
              </div>
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
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-[var(--font-sora)] text-lg font-semibold text-[#EEF2FF]">Create Group</h3>
                <button onClick={() => setShowCreate(false)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Group Name *</label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    className={inputCls} placeholder="Team Alpha" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Year *</label>
                    <select value={createForm.year} onChange={e => setCreateForm(p => ({ ...p, year: e.target.value as Year }))} className={inputCls}>
                      <option value="">Select</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Division *</label>
                    <input type="text" value={createForm.division} onChange={e => setCreateForm(p => ({ ...p, division: e.target.value }))}
                      className={inputCls} placeholder="A" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Academic Year</label>
                    <input type="text" value={createForm.academicYear} onChange={e => setCreateForm(p => ({ ...p, academicYear: e.target.value }))}
                      className={inputCls} placeholder="2024-25" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Semester</label>
                    <input type="number" min={1} max={8} value={createForm.semester} onChange={e => setCreateForm(p => ({ ...p, semester: parseInt(e.target.value) || 1 }))}
                      className={inputCls} />
                  </div>
                </div>

                {/* Guide */}
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Guide</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
                    <input type="text" value={guideSearch} onChange={e => setGuideSearch(e.target.value)}
                      className={`${inputCls} pl-8`} placeholder="Search faculty..." />
                  </div>
                  <div className="max-h-32 overflow-auto mt-2 space-y-1">
                    {filteredFaculty.map(f => (
                      <button key={f.id} onClick={() => setCreateForm(p => ({ ...p, guideId: p.guideId === f.id ? '' : f.id }))}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${
                          createForm.guideId === f.id ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'hover:bg-[#1A2540] text-[#EEF2FF]'}`}>
                        <span>{f.name}</span>
                        {f.prnNo && <PrnBadge prn={f.prnNo} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Students */}
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">
                    Students * <span className="text-[#4A5B7A]">({createForm.studentIds.length}/5 selected, min 3)</span>
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
                    <input type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                      className={`${inputCls} pl-8`} placeholder="Search students..." />
                  </div>
                  <div className="max-h-40 overflow-auto mt-2 space-y-1">
                    {filteredStudents.map((s, idx) => {
                      const sel = createForm.studentIds.includes(s.id)
                      const isFirst = createForm.studentIds[0] === s.id
                      return (
                        <button key={s.id} onClick={() => toggleStudent(s.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${
                            sel ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'hover:bg-[#1A2540] text-[#EEF2FF]'}`}>
                          <span>{s.name}</span>
                          {s.prnNo && <PrnBadge prn={s.prnNo} />}
                          {s.enrollmentNo && <span className="text-[10px] text-[#4A5B7A] font-mono">{s.enrollmentNo}</span>}
                          {isFirst && <Crown size={12} className="text-amber-400 ml-auto" />}
                        </button>
                      )
                    })}
                    {filteredStudents.length === 0 && (
                      <p className="text-xs text-[#4A5B7A] text-center py-3">No available students found</p>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={handleCreateGroup}
                disabled={!createForm.name || !createForm.year || !createForm.division || createForm.studentIds.length < 3 || createLoading}
                className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {createLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create Group
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
