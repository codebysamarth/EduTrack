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
  Loader2,
  Eye,
  RefreshCw,
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

interface ProjectData {
  id: string; title: string; status: string; domain?: string
  sdgGoals?: string[]; isPublished?: boolean
  group?: { id: string; name: string; department?: { id: string; name: string; code: string } } | null
  guide?: { id: string; name: string; prnNo?: string } | null
  latestReview?: { grade?: string; marks?: number } | null
  memberCount?: number
}

interface ProjectDetail {
  id: string; title: string; description?: string; abstract?: string
  status: string; domain?: string; sdgGoals?: string[]
  isPublished?: boolean; driveLink?: string; patentLink?: string
  group?: {
    id: string; name: string; year: string; division: string
    department?: { id: string; name: string } | null
    members?: { id: string; student: { id: string; name: string; prnNo?: string }; isLeader: boolean }[]
  } | null
  guide?: { id: string; name: string; prnNo?: string } | null
  reviews?: { id: string; grade?: string; marks?: number; comment?: string; createdAt: string }[]
}

interface DeptData { id: string; name: string; code: string }

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED', 'PUBLISHED'] as const
const PAGE_SIZE = 20

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [departments, setDepartments] = useState<DeptData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)

  // Detail dialog
  const [detailProject, setDetailProject] = useState<ProjectDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Change status dialog
  const [statusProject, setStatusProject] = useState<ProjectData | null>(null)
  const [newStatus, setNewStatus] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        api.get('/projects'),
        api.get('/departments'),
      ])
      setProjects(Array.isArray(pRes.data) ? pRes.data : [])
      setDepartments(Array.isArray(dRes.data) ? dRes.data : [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtered + paginated
  const filtered = projects.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      if (!p.title.toLowerCase().includes(q) && !(p.domain ?? '').toLowerCase().includes(q) &&
        !(p.guide?.name ?? '').toLowerCase().includes(q) && !(p.group?.name ?? '').toLowerCase().includes(q)) return false
    }
    if (filterDept && p.group?.department?.id !== filterDept) return false
    if (filterStatus && p.status !== filterStatus) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterDept, filterStatus])

  const handleExport = async () => {
    try {
      const res = await api.get('/export/projects')
      downloadAsExcel(res.data, 'projects')
    } catch { /* */ }
  }

  // Detail
  const openDetail = async (p: ProjectData) => {
    setDetailLoading(true)
    setDetailProject(null)
    try {
      const res = await api.get(`/projects/${p.id}`)
      setDetailProject(res.data)
    } catch { /* */ }
    setDetailLoading(false)
  }

  // Change status
  const openChangeStatus = (p: ProjectData) => {
    setStatusProject(p)
    setNewStatus(p.status)
  }

  const handleChangeStatus = async () => {
    if (!statusProject || !newStatus) return
    setActionLoading(true)
    try {
      await api.patch(`/projects/${statusProject.id}/status`, { status: newStatus })
      setStatusProject(null)
      await fetchData()
    } catch { /* */ }
    setActionLoading(false)
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none transition-all duration-200'

  const statusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'COMPLETED': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'UNDER_REVIEW': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'SUBMITTED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'DRAFT': return 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'
      default: return 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C]'
    }
  }

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
          <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">Projects</h1>
          <p className="text-sm text-[#7A8BAF] mt-1">{filtered.length} projects</p>
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
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, domain, guide, group..."
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
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${filterStatus === '' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
            All
          </button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${filterStatus === s ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
              {s.replace('_', ' ')}
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
                {['Title', 'Group', 'Guide', 'Dept', 'Domain', 'SDG', 'Status', 'Published', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-[#4A5B7A] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-sm text-[#4A5B7A]">No projects found</td></tr>
              ) : paginated.map(p => (
                <tr key={p.id} className="border-b border-[#2A3A5C]/50 hover:bg-[#1A2540] transition-colors">
                  <td className="py-3 px-4 text-[#EEF2FF] font-medium max-w-[180px] truncate">{p.title}</td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{p.group?.name ?? '—'}</td>
                  <td className="py-3 px-4">
                    {p.guide ? (
                      <div>
                        <span className="text-xs text-[#EEF2FF]">{p.guide.name}</span>
                        {p.guide.prnNo && <div><PrnBadge prn={p.guide.prnNo} /></div>}
                      </div>
                    ) : <span className="text-xs text-[#4A5B7A]">—</span>}
                  </td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{p.group?.department?.code ?? '—'}</td>
                  <td className="py-3 px-4 text-[#7A8BAF] text-xs">{p.domain ?? '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-0.5">
                      {(p.sdgGoals ?? []).slice(0, 2).map(g => (
                        <span key={g} className="text-[9px] px-1 py-0.5 rounded bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">{g}</span>
                      ))}
                      {(p.sdgGoals ?? []).length > 2 && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#1A2540] text-[#4A5B7A]">+{(p.sdgGoals ?? []).length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="py-3 px-4">
                    {p.isPublished ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Yes</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2540] text-[#4A5B7A] border border-[#2A3A5C]">No</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDetail(p)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                        <Eye size={10} /> View
                      </button>
                      <button onClick={() => openChangeStatus(p)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <RefreshCw size={10} /> Status
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

      {/* ═══ Project Detail Dialog ═══ */}
      <AnimatePresence>
        {(detailProject || detailLoading) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setDetailProject(null); setDetailLoading(false) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-48" />
                </div>
              ) : detailProject && (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF] max-w-[85%]">{detailProject.title}</h3>
                    <button onClick={() => setDetailProject(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
                  </div>

                  {detailProject.description && (
                    <p className="text-sm text-[#7A8BAF] mb-4 leading-relaxed">{detailProject.description}</p>
                  )}
                  {detailProject.abstract && (
                    <div className="mb-4">
                      <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-1">Abstract</h4>
                      <p className="text-xs text-[#7A8BAF] leading-relaxed">{detailProject.abstract}</p>
                    </div>
                  )}

                  <div className="space-y-3 mb-5">
                    {[
                      { label: 'Status', value: detailProject.status },
                      { label: 'Domain', value: detailProject.domain ?? '—' },
                      { label: 'SDG Goals', value: (detailProject.sdgGoals ?? []).join(', ') || '—' },
                      { label: 'Published', value: detailProject.isPublished ? 'Yes' : 'No' },
                      { label: 'Group', value: detailProject.group?.name ?? '—' },
                      { label: 'Department', value: detailProject.group?.department?.name ?? '—' },
                      { label: 'Guide', value: detailProject.guide?.name ?? '—' },
                    ].map(r => (
                      <div key={r.label} className="flex items-start justify-between py-2 border-b border-[#2A3A5C]/50">
                        <span className="text-xs text-[#7A8BAF]">{r.label}</span>
                        <span className="text-sm text-[#EEF2FF] text-right max-w-[60%]">{r.value}</span>
                      </div>
                    ))}
                    {detailProject.driveLink && (
                      <div className="flex items-start justify-between py-2 border-b border-[#2A3A5C]/50">
                        <span className="text-xs text-[#7A8BAF]">Drive Link</span>
                        <a href={detailProject.driveLink} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline">Open</a>
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Members</h4>
                  <div className="space-y-2 mb-5">
                    {(detailProject.group?.members ?? []).map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#EEF2FF]">{m.student.name}</span>
                          {m.student.prnNo && <PrnBadge prn={m.student.prnNo} />}
                          {m.isLeader && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Leader</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reviews */}
                  {(detailProject.reviews ?? []).length > 0 && (
                    <>
                      <h4 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Reviews</h4>
                      <div className="space-y-2">
                        {detailProject.reviews!.map(r => (
                          <div key={r.id} className="p-3 bg-[#1A2540] rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {r.grade && <span className="text-xs font-medium text-amber-400">{r.grade}</span>}
                                {r.marks != null && <span className="text-xs text-[#7A8BAF]">{r.marks} marks</span>}
                              </div>
                              <span className="text-[10px] text-[#4A5B7A]">{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            {r.comment && <p className="text-xs text-[#7A8BAF] mt-1">{r.comment}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Change Status Dialog ═══ */}
      <AnimatePresence>
        {statusProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setStatusProject(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">Change Status</h3>
                <button onClick={() => setStatusProject(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
              </div>
              <p className="text-sm text-[#7A8BAF] mb-4 truncate">{statusProject.title}</p>
              <div className="space-y-2 mb-5">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setNewStatus(s)}
                    className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium border text-left transition-all duration-200 ${newStatus === s ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#1A2540] text-[#7A8BAF] border-[#2A3A5C] hover:text-[#EEF2FF]'}`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${statusColor(s).split(' ')[1]?.replace('text-', 'bg-') ?? 'bg-gray-500'}`} />
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <button onClick={handleChangeStatus} disabled={actionLoading || newStatus === statusProject.status}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Update Status
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
