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
  Clock,
  ClipboardList,
  CheckCircle2,
  BookOpen,
  XCircle,
  Github,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
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
  status?: string
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
interface ProjectData {
  id: string; title: string; status: string; domain?: string; sdgGoals?: number[]
  group?: { name: string; year: string; division: string; members?: MemberData[] }
  guide?: { name: string; prnNo?: string }
  memberCount?: number; latestReview?: { isApproved: boolean; comment: string; rejectionReason?: string }
  reviews?: ReviewData[]
  abstract?: string; githubLink?: string; videoLink?: string; techStack?: string
}
interface ReviewData {
  id: string; isApproved: boolean; comment: string; rejectionReason?: string; createdAt: string
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
  const [approveLoading, setApproveLoading] = useState('')

  // Projects & Reviews
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [reviewDialog, setReviewDialog] = useState<ProjectData | null>(null)
  const [reviewForm, setReviewForm] = useState({ comment: '', isApproved: true, rejectionReason: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [publishingId, setPublishingId] = useState('')
  const [confirmPublish, setConfirmPublish] = useState<string | null>(null)

  const GROUP_STATUS_LABELS: Record<string, string> = {
    FORMING: 'Forming', PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved',
  }
  const GROUP_STATUS_COLORS: Record<string, string> = {
    FORMING: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  }

  const fetchData = useCallback(async () => {
    if (!deptId) return
    try {
      const [g, s, f, p] = await Promise.all([
        api.get('/groups'),
        api.get(`/users/students?departmentId=${deptId}`),
        api.get(`/users/faculty?departmentId=${deptId}`),
        api.get('/projects'),
      ])
      setGroups(g.data)
      setStudents(s.data)
      setFaculty(f.data)
      setProjects(p.data)
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
      toast.success('Group created successfully')
      setShowCreate(false)
      setCreateForm({ name: '', year: '', division: '', academicYear: '', semester: 1, guideId: '', studentIds: [] })
      await fetchData()
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to create group'
      const conflicting = err?.response?.data?.conflicting
      if (conflicting?.length) {
        const names = students.filter(s => conflicting.includes(s.id)).map(s => s.name)
        toast.error(`${msg}: ${names.join(', ')}`)
      } else {
        toast.error(msg)
      }
    }
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

  const pendingGroups = groups.filter(g => g.status === 'PENDING_APPROVAL')

  const handleApproveGroup = async (groupId: string, guideId?: string) => {
    setApproveLoading(groupId)
    try {
      await api.post(`/groups/${groupId}/approve`, { guideId: guideId || undefined })
      toast.success('Group approved!')
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve group')
    }
    setApproveLoading('')
  }

  const handleRejectGroup = async (groupId: string) => {
    setApproveLoading(groupId)
    try {
      await api.post(`/groups/${groupId}/reject-group`, { reason: 'Rejected by coordinator' })
      toast.success('Group rejected — sent back to forming')
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to reject group')
    }
    setApproveLoading('')
  }

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

  // Review & publish
  const pendingProjects = projects.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW')
  const approvedCount = projects.filter(p => ['APPROVED', 'COMPLETED'].includes(p.status)).length
  const publishedCount = projects.filter(p => p.status === 'PUBLISHED').length

  // Bar chart data for project status
  const projectStatusCounts: Record<string, number> = {}
  projects.forEach(p => { projectStatusCounts[p.status] = (projectStatusCounts[p.status] || 0) + 1 })
  const barChartData = Object.entries(projectStatusCounts).map(([status, count]) => ({
    status: STATUS_LABELS[status] || status, count, key: status,
  }))

  // Year-wise group distribution chart data
  const yearGroupCounts: Record<string, number> = {}
  groups.forEach(g => { yearGroupCounts[g.year] = (yearGroupCounts[g.year] || 0) + 1 })
  const yearChartData = Object.entries(yearGroupCounts).map(([year, count]) => ({ year, count }))

  const openReview = async (p: ProjectData) => {
    try {
      const full = await api.get(`/projects/${p.id}`)
      setReviewDialog(full.data)
    } catch {
      setReviewDialog(p)
    }
    setReviewForm({ comment: '', isApproved: true, rejectionReason: '' })
  }

  const submitReview = async () => {
    if (!reviewDialog) return
    setReviewSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        isApproved: reviewForm.isApproved,
        comment: reviewForm.comment,
      }
      if (!reviewForm.isApproved) body.rejectionReason = reviewForm.rejectionReason
      await api.post(`/projects/${reviewDialog.id}/review`, body)
      toast.success(reviewForm.isApproved ? 'Project approved!' : 'Project rejected')
      setReviewDialog(null)
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit review')
    }
    setReviewSubmitting(false)
  }

  const handlePublish = async (projectId: string) => {
    setPublishingId(projectId)
    try {
      await api.patch(`/projects/${projectId}/publish`)
      toast.success('Project published to showcase!')
      setConfirmPublish(null)
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to publish')
    }
    setPublishingId('')
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
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Groups', value: groups.length, icon: LayoutGrid },
          { label: 'Pending Approval', value: pendingGroups.length, icon: UserCheck, pulse: pendingGroups.length > 0 },
          { label: 'Pending Reviews', value: pendingProjects.length, icon: ClipboardList, pulse: pendingProjects.length > 0 },
          { label: 'Approved', value: approvedCount, icon: CheckCircle2 },
          { label: 'Published', value: publishedCount, icon: BookOpen },
          { label: 'Guides', value: guidesCount, icon: Users },
        ].map(c => (
          <div key={c.label} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={14} className="text-[#4A5B7A]" />
              <span className="text-xs text-[#7A8BAF]">{c.label}</span>
              {c.pulse && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            <p className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">{c.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ═══ SECTION 1.5 — Pending Approval ═══ */}
      {pendingGroups.length > 0 && (
        <motion.div variants={item} className="bg-[#0F1729] border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-400"/>
            <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Groups Pending Approval</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{pendingGroups.length}</span>
          </div>
          <div className="space-y-3">
            {pendingGroups.map(g => (
              <div key={g.id} className="bg-[#1A2540] border border-[#2A3A5C] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-[#EEF2FF]">{g.name}</h4>
                    <p className="text-xs text-[#7A8BAF]">{g.year} · Div {g.division} · {g.academicYear}</p>
                  </div>
                  <span className="text-xs text-[#4A5B7A]">{g.membersCount ?? g.members?.length ?? 0} members</span>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <button onClick={() => openView(g)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Eye size={10}/> View Members</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveGroup(g.id)} disabled={approveLoading === g.id}
                    className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                    {approveLoading === g.id ? <Loader2 size={12} className="animate-spin"/> : <UserCheck size={12}/>} Approve
                  </button>
                  <button onClick={() => handleRejectGroup(g.id)} disabled={approveLoading === g.id}
                    className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                    {approveLoading === g.id ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>} Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ SECTION 2a — Pending Reviews ═══ */}
      <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
        <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4">Pending Reviews</h3>
        {pendingProjects.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList size={32} className="text-[#2A3A5C] mx-auto mb-2" />
            <p className="text-sm text-[#7A8BAF]">No pending reviews</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A3A5C]">
                  {['Group', 'Project Title', 'Guide', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-[#4A5B7A] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingProjects.map(p => (
                  <tr key={p.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                    <td className="py-3 px-3 text-[#EEF2FF]">{p.group?.name}</td>
                    <td className="py-3 px-3 text-[#EEF2FF] font-medium">{p.title}</td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{p.guide?.name ?? '—'}</td>
                    <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                    <td className="py-3 px-3">
                      <button onClick={() => openReview(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-all duration-200">
                        <Eye size={12} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                  {['Group', 'Year', 'Div', 'Guide', 'Students', 'Group Status', 'Project', 'Actions'].map(h => (
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
                      {g.status ? (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GROUP_STATUS_COLORS[g.status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {GROUP_STATUS_LABELS[g.status] ?? g.status}
                        </span>
                      ) : <span className="text-xs text-[#4A5B7A]">—</span>}
                    </td>
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
                        {g.project && (
                          <button onClick={() => openReview({ id: g.project!.id, title: g.project!.title, status: g.project!.status } as ProjectData)}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            <ClipboardList size={10} /> Project
                          </button>
                        )}
                        {g.project && ['APPROVED', 'COMPLETED'].includes(g.project.status) && (
                          <button onClick={() => setConfirmPublish(g.project!.id)}
                            disabled={publishingId === g.project.id}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors">
                            {publishingId === g.project.id ? 'Publishing…' : 'Publish'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ═══ SECTION 4 — Charts ═══ */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart — Group Project Status */}
        {pieData.length > 0 && (
          <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4">Group Status Distribution</h3>
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
          </div>
        )}

        {/* Bar Chart — Project Status Distribution */}
        {barChartData.length > 0 && (
          <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4">Project Status Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3A5C" />
                  <XAxis dataKey="status" tick={{ fill: '#7A8BAF', fontSize: 11 }} axisLine={{ stroke: '#2A3A5C' }} />
                  <YAxis tick={{ fill: '#7A8BAF', fontSize: 12 }} axisLine={{ stroke: '#2A3A5C' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#0F1729', border: '1px solid #2A3A5C', borderRadius: 12, color: '#EEF2FF' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {barChartData.map((entry) => (
                      <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? '#6B7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </motion.div>

      {/* Year-wise Group Distribution */}
      {yearChartData.length > 0 && (
        <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4">Year-wise Group Distribution</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3A5C" />
                <XAxis dataKey="year" tick={{ fill: '#7A8BAF', fontSize: 12 }} axisLine={{ stroke: '#2A3A5C' }} />
                <YAxis tick={{ fill: '#7A8BAF', fontSize: 12 }} axisLine={{ stroke: '#2A3A5C' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0F1729', border: '1px solid #2A3A5C', borderRadius: 12, color: '#EEF2FF' }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
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
                disabled={!createForm.name || !createForm.year || !createForm.division || !createForm.academicYear || createForm.studentIds.length < 3 || createLoading}
                className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {createLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create Group
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Review Dialog ═══ */}
      <AnimatePresence>
        {reviewDialog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setReviewDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-[var(--font-sora)] text-lg font-semibold text-[#EEF2FF]">{reviewDialog.title}</h3>
                <button onClick={() => setReviewDialog(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>

              {reviewDialog.abstract && (
                <p className="text-sm text-[#7A8BAF] mb-3">{reviewDialog.abstract}</p>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {reviewDialog.domain && (
                  <span className="text-xs px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10">{reviewDialog.domain}</span>
                )}
                {reviewDialog.sdgGoals?.map(g => (
                  <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">SDG {g}</span>
                ))}
              </div>
              <div className="flex gap-3 mb-4">
                {reviewDialog.githubLink && (
                  <a href={reviewDialog.githubLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#7A8BAF] hover:text-amber-400 flex items-center gap-1"><Github size={12} /> GitHub</a>
                )}
                {reviewDialog.videoLink && (
                  <a href={reviewDialog.videoLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#7A8BAF] hover:text-amber-400 flex items-center gap-1"><Video size={12} /> Video</a>
                )}
              </div>

              {(reviewDialog as unknown as { group?: { members?: MemberData[] } }).group?.members && (
                <div className="mb-4 p-3 rounded-xl bg-[#1A2540]">
                  <p className="text-xs text-[#4A5B7A] mb-2">Group Members</p>
                  {((reviewDialog as unknown as { group: { members: MemberData[] } }).group.members).map(m => (
                    <div key={m.id} className="flex items-center gap-2 py-1">
                      <span className="text-sm text-[#EEF2FF]">{m.student.name}</span>
                      {m.student.prnNo && <PrnBadge prn={m.student.prnNo} />}
                    </div>
                  ))}
                </div>
              )}

              {['SUBMITTED', 'UNDER_REVIEW'].includes(reviewDialog.status) && (
                <>
                  <div className="border-t border-[#2A3A5C] pt-4 mt-4">
                    <label className="block text-xs text-[#7A8BAF] mb-1.5">Review Comment *</label>
                    <textarea value={reviewForm.comment} onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))} rows={3}
                      className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none resize-none transition-all duration-200"
                      placeholder="Your review comments..." />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setReviewForm(p => ({ ...p, isApproved: true }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 border ${
                        reviewForm.isApproved ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-[#4A5B7A] border-[#2A3A5C] hover:border-green-500/30'}`}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button onClick={() => setReviewForm(p => ({ ...p, isApproved: false }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 border ${
                        !reviewForm.isApproved ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'text-[#4A5B7A] border-[#2A3A5C] hover:border-red-500/30'}`}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>

                  {!reviewForm.isApproved && (
                    <div className="mt-3">
                      <label className="block text-xs text-[#7A8BAF] mb-1.5">Rejection Reason *</label>
                      <textarea value={reviewForm.rejectionReason} onChange={e => setReviewForm(p => ({ ...p, rejectionReason: e.target.value }))} rows={2}
                        className="w-full px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-[#EEF2FF] focus:border-red-500 focus:outline-none resize-none transition-all duration-200"
                        placeholder="Explain what needs to be improved..." />
                    </div>
                  )}

                  <button onClick={submitReview}
                    disabled={!reviewForm.comment || (!reviewForm.isApproved && !reviewForm.rejectionReason) || reviewSubmitting}
                    className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {reviewSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Submit Review
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Publish Confirmation ═══ */}
      <AnimatePresence>
        {confirmPublish && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setConfirmPublish(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-[var(--font-sora)] text-lg font-semibold text-[#EEF2FF] mb-2">Publish Project?</h3>
              <p className="text-sm text-[#7A8BAF] mb-6">This will make the project visible on the public showcase.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPublish(null)} className="flex-1 py-2.5 border border-[#2A3A5C] text-[#7A8BAF] rounded-xl text-sm hover:bg-[#1A2540] transition-all duration-200">Cancel</button>
                <button onClick={() => handlePublish(confirmPublish)} disabled={!!publishingId}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60">
                  {publishingId ? <Loader2 size={14} className="animate-spin" /> : null} Publish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
