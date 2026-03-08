'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  ClipboardList,
  CheckCircle2,
  BookOpen,
  Eye,
  Loader2,
  X,
  Download,
  Github,
  Video,
  XCircle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '@/lib/api'
import { downloadAsExcel } from '@/lib/exportExcel'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

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
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  SUBMITTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  UNDER_REVIEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
  PUBLISHED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}
const CHART_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280', SUBMITTED: '#3B82F6', UNDER_REVIEW: '#F59E0B',
  REJECTED: '#EF4444', APPROVED: '#10B981', COMPLETED: '#10B981', PUBLISHED: '#8B5CF6',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2540] ${className}`} />
}

interface GroupData {
  id: string; name: string; year: string; division: string
  guide?: { name: string; prnNo?: string }
  membersCount?: number; members?: MemberData[]
  project?: { id: string; title: string; status: string; abstract?: string; domain?: string; sdgGoals?: number[]; githubLink?: string; videoLink?: string }
}
interface MemberData {
  id: string; isLeader: boolean
  student: { id: string; name: string; prnNo?: string; email?: string }
}
interface ProjectData {
  id: string; title: string; status: string; domain?: string; sdgGoals?: number[]
  group?: { name: string; year: string; division: string }
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

export default function GuidePage() {
  const { user, prnNo } = useAuth()
  const [groups, setGroups] = useState<GroupData[]>([])
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewDialog, setReviewDialog] = useState<ProjectData | null>(null)
  const [reviewForm, setReviewForm] = useState({ comment: '', isApproved: true, rejectionReason: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [publishingId, setPublishingId] = useState('')
  const [confirmPublish, setConfirmPublish] = useState<string | null>(null)
  const [exportingMembersId, setExportingMembersId] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([api.get('/groups'), api.get('/projects')])
      setGroups(g.data)
      setProjects(p.data)
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pendingProjects = projects.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW')
  const approvedCount = projects.filter(p => ['APPROVED', 'COMPLETED'].includes(p.status)).length
  const publishedCount = projects.filter(p => p.status === 'PUBLISHED').length

  // Chart data
  const statusCounts: Record<string, number> = {}
  projects.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1 })
  const chartData = Object.entries(statusCounts).map(([status, count]) => ({ status: STATUS_LABELS[status] || status, count, key: status }))

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
      setReviewDialog(null)
      await fetchData()
    } catch { /* */ }
    setReviewSubmitting(false)
  }

  const handlePublish = async (projectId: string) => {
    setPublishingId(projectId)
    try {
      await api.patch(`/projects/${projectId}/publish`)
      setConfirmPublish(null)
      await fetchData()
    } catch { /* */ }
    setPublishingId('')
  }

  const exportToExcel = async () => {
    try {
      const response = await api.get('/export/groups')
      downloadAsExcel(response.data, 'my_groups_export')
    } catch { /* */ }
  }

  const exportProjects = async () => {
    try {
      const response = await api.get('/export/projects')
      downloadAsExcel(response.data, 'my_projects_export')
    } catch { /* */ }
  }

  const exportMembers = async (group: GroupData) => {
    setExportingMembersId(group.id)
    try {
      const response = await api.get(`/groups/${group.id}/members-export`)
      downloadAsExcel(response.data, `group_${group.name}_members`)
    } catch {
      toast.error('Failed to export members')
    }
    setExportingMembersId('')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ═══ SECTION 1 — Header ═══ */}
      <motion.div variants={item}>
        <h1 className="font-[var(--font-sora)] text-3xl font-bold text-[#EEF2FF]">{user?.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          {prnNo && <PrnBadge prn={prnNo} />}
          {user?.facultyProfile?.designation && (
            <span className="text-sm text-[#7A8BAF]">{user.facultyProfile.designation}</span>
          )}
        </div>
      </motion.div>

      {/* ═══ SECTION 2 — Stats ═══ */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Groups', value: groups.length, icon: Users },
          { label: 'Pending Reviews', value: pendingProjects.length, icon: ClipboardList, pulse: pendingProjects.length > 0 },
          { label: 'Approved', value: approvedCount, icon: CheckCircle2 },
          { label: 'Published', value: publishedCount, icon: BookOpen },
        ].map((c) => (
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

      {/* ═══ SECTION 3 — Pending Reviews ═══ */}
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
                  {['Group', 'Project Title', 'Student PRNs', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-[#4A5B7A] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingProjects.map(p => (
                  <tr key={p.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                    <td className="py-3 px-3 text-[#EEF2FF]">{p.group?.name}</td>
                    <td className="py-3 px-3 text-[#EEF2FF] font-medium">{p.title}</td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-amber-300">{p.memberCount ?? '—'} members</span>
                    </td>
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

      {/* ═══ SECTION 4 — My Groups ═══ */}
      <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">My Groups</h3>
        </div>
        {groups.length === 0 ? (
          <div className="text-center py-8">
            <Users size={32} className="text-[#2A3A5C] mx-auto mb-2" />
            <p className="text-sm text-[#7A8BAF]">No groups assigned</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A3A5C]">
                  {['Group Name', 'Year / Div', 'Students', 'Project Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-[#4A5B7A] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                    <td className="py-3 px-3 text-[#EEF2FF] font-medium">{g.name}</td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{g.year} / {g.division}</td>
                    <td className="py-3 px-3 text-[#7A8BAF]">{g.membersCount ?? g.members?.length ?? '—'}</td>
                    <td className="py-3 px-3">
                      {g.project ? <StatusBadge status={g.project.status} /> : <span className="text-xs text-[#4A5B7A]">No project</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {g.project && (
                          <button onClick={() => openReview({ id: g.project!.id, title: g.project!.title, status: g.project!.status } as ProjectData)}
                            className="text-xs text-[#7A8BAF] hover:text-amber-400 transition-colors">
                            View
                          </button>
                        )}
                        {g.project && ['APPROVED', 'COMPLETED'].includes(g.project.status) && (
                          <button onClick={() => setConfirmPublish(g.project!.id)}
                            disabled={publishingId === g.project.id}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors">
                            {publishingId === g.project.id ? 'Publishing…' : 'Publish'}
                          </button>
                        )}
                        <button onClick={() => exportMembers(g)}
                          disabled={exportingMembersId === g.id}
                          className="text-xs text-[#7A8BAF] hover:text-amber-400 transition-colors flex items-center gap-1">
                          {exportingMembersId === g.id ? <Loader2 size={10} className="animate-spin" /> : <Users size={10} />} Export
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

      {/* ═══ SECTION 5 — Chart ═══ */}
      {chartData.length > 0 && (
        <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] mb-4">Project Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3A5C" />
                <XAxis dataKey="status" tick={{ fill: '#7A8BAF', fontSize: 12 }} axisLine={{ stroke: '#2A3A5C' }} />
                <YAxis tick={{ fill: '#7A8BAF', fontSize: 12 }} axisLine={{ stroke: '#2A3A5C' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0F1729', border: '1px solid #2A3A5C', borderRadius: 12, color: '#EEF2FF' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={CHART_STATUS_COLORS[entry.key] ?? '#6B7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ═══ SECTION 6 — Export ═══ */}
      <motion.div variants={item} className="flex items-center gap-3">
        <button onClick={exportToExcel}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2A3A5C] text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/50 rounded-xl transition-all duration-200 text-sm">
          <Download size={16} /> Export Groups to Excel
        </button>
        <button onClick={exportProjects}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2A3A5C] text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/50 rounded-xl transition-all duration-200 text-sm">
          <Download size={16} /> Export Projects
        </button>
      </motion.div>

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

              {/* Project details */}
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

              {/* Group members */}
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

              {/* Only show review form for reviewable statuses */}
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
