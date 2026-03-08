'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Globe,
  Github,
  Video,
  ExternalLink,
  X,
  Filter,
  BookOpen,
} from 'lucide-react'
import { api } from '@/lib/api'

// ─── Helpers ────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1A2540] ${className}`} />
}

interface ProjectData {
  id: string
  title: string
  abstract?: string
  domain?: string
  techStack?: string
  sdgGoals?: number[]
  status: string
  githubLink?: string
  videoLink?: string
  driveLink?: string
  researchPaperLink?: string
  patentLink?: string
  publishedAt?: string
  group?: {
    name: string
    year: string
    division: string
    department?: { name: string; code: string }
    guide?: { name: string }
    members?: { student: { name: string; prnNo?: string }; isLeader: boolean }[]
  }
}

const DOMAINS = [
  'Web Development', 'Internet of Things (IoT)', 'Artificial Intelligence / ML',
  'Blockchain & Web3', 'Mobile App Development', 'Embedded Systems',
  'Cybersecurity', 'Data Science & Analytics', 'Robotics & Automation',
  'Cloud Computing', 'Augmented / Virtual Reality',
]
const YEARS = ['FY', 'SY', 'TY', 'FINAL']
const SDG_GOALS = Array.from({ length: 17 }, (_, i) => i + 1)

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function ShowcasePage() {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProjectData | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSdg, setFilterSdg] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get('/showcase')
      setProjects(Array.isArray(res.data) ? res.data : [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const departments = useMemo(() => {
    const set = new Set<string>()
    projects.forEach(p => {
      if (p.group?.department?.code) set.add(p.group.department.code)
    })
    return [...set].sort()
  }, [projects])

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        const match = p.title.toLowerCase().includes(q) ||
          p.abstract?.toLowerCase().includes(q) ||
          p.domain?.toLowerCase().includes(q) ||
          p.group?.name.toLowerCase().includes(q) ||
          p.group?.members?.some(m => m.student.name.toLowerCase().includes(q))
        if (!match) return false
      }
      if (filterDept && p.group?.department?.code !== filterDept) return false
      if (filterDomain && p.domain !== filterDomain) return false
      if (filterYear && p.group?.year !== filterYear) return false
      if (filterSdg && !p.sdgGoals?.includes(parseInt(filterSdg))) return false
      return true
    })
  }, [projects, search, filterDept, filterDomain, filterYear, filterSdg])

  const hasActiveFilters = filterDept || filterDomain || filterYear || filterSdg
  const clearFilters = () => { setFilterDept(''); setFilterDomain(''); setFilterYear(''); setFilterSdg('') }

  const openDetail = async (p: ProjectData) => {
    try {
      const res = await api.get(`/projects/${p.id}`)
      setSelected(res.data)
    } catch {
      setSelected(p)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-80" />
        <Skeleton className="h-12" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    )
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="w-8 h-8 text-amber-400" />
          <h1 className="font-['Sora'] text-2xl font-bold text-[#EEF2FF]">Project Showcase</h1>
        </div>
        <p className="text-[#7A8BAF] text-sm">{filtered.length} published project{filtered.length !== 1 ? 's' : ''}</p>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5B7A]" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none transition-all duration-200"
              placeholder="Search projects, groups, students..." />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-xl text-sm border transition-all duration-200 inline-flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'border-[#2A3A5C] text-[#7A8BAF] hover:border-amber-500/30'}`}>
            <Filter size={14} />
            Filters {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </button>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#2A3A5C]">
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)}
                  className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
                  <option value="">All Domains</option>
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
                  <option value="">All Years</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={filterSdg} onChange={e => setFilterSdg(e.target.value)}
                  className="px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
                  <option value="">All SDGs</option>
                  {SDG_GOALS.map(g => <option key={g} value={g}>SDG {g}</option>)}
                </select>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                  Clear all filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <motion.div variants={item} className="text-center py-16">
          <Globe size={48} className="text-[#2A3A5C] mx-auto mb-3" />
          <p className="text-[#7A8BAF] text-sm">No published projects found</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">Clear filters</button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <motion.div key={p.id} variants={item}
              onClick={() => openDetail(p)}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-5 cursor-pointer group hover:border-amber-500/30 transition-all duration-300 hover:shadow-[0_0_30px_-10px_rgba(245,166,35,0.15)]">
              {/* Domain & SDG */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.domain && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {p.domain}
                  </span>
                )}
                {p.sdgGoals?.slice(0, 2).map(g => (
                  <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    SDG {g}
                  </span>
                ))}
                {(p.sdgGoals?.length ?? 0) > 2 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2540] text-[#4A5B7A] border border-[#2A3A5C]">
                    +{p.sdgGoals!.length - 2}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-['Sora'] text-sm font-semibold text-[#EEF2FF] mb-2 line-clamp-2 group-hover:text-amber-400 transition-colors">
                {p.title}
              </h3>

              {/* Abstract */}
              {p.abstract && (
                <p className="text-xs text-[#7A8BAF] mb-3 line-clamp-3">{p.abstract}</p>
              )}

              {/* Group info */}
              <div className="flex items-center gap-2 text-xs text-[#4A5B7A] mt-auto pt-3 border-t border-[#2A3A5C]/50">
                {p.group?.name && <span>{p.group.name}</span>}
                {p.group?.department?.code && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{p.group.department.code}</span>
                  </>
                )}
                {p.group?.year && (
                  <>
                    <span>·</span>
                    <span>{p.group.year}</span>
                  </>
                )}
              </div>

              {/* Quick links */}
              <div className="flex items-center gap-2 mt-3">
                {p.githubLink && <Github size={13} className="text-[#4A5B7A] group-hover:text-[#7A8BAF] transition-colors" />}
                {p.videoLink && <Video size={13} className="text-[#4A5B7A] group-hover:text-[#7A8BAF] transition-colors" />}
                {p.driveLink && <ExternalLink size={13} className="text-[#4A5B7A] group-hover:text-[#7A8BAF] transition-colors" />}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ Detail Dialog ═══ */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS.PUBLISHED}`}>
                      Published
                    </span>
                    {selected.domain && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {selected.domain}
                      </span>
                    )}
                  </div>
                  <h2 className="font-['Sora'] text-lg font-bold text-[#EEF2FF]">{selected.title}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors ml-3">
                  <X size={18} />
                </button>
              </div>

              {/* Abstract */}
              {selected.abstract && (
                <div className="mb-4">
                  <p className="text-xs text-[#4A5B7A] mb-1">Abstract</p>
                  <p className="text-sm text-[#7A8BAF] leading-relaxed">{selected.abstract}</p>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selected.sdgGoals?.map(g => (
                  <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">SDG {g}</span>
                ))}
                {selected.techStack && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {selected.techStack}
                  </span>
                )}
              </div>

              {/* Group & Guide */}
              {selected.group && (
                <div className="bg-[#1A2540] rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#EEF2FF]">{selected.group.name}</p>
                    <div className="flex items-center gap-2 text-xs text-[#4A5B7A]">
                      {selected.group.department?.code && <span className="font-mono">{selected.group.department.code}</span>}
                      <span>·</span>
                      <span>{selected.group.year} / {selected.group.division}</span>
                    </div>
                  </div>
                  {selected.group.guide && (
                    <p className="text-xs text-[#7A8BAF] mb-3">
                      Guide: <span className="text-[#EEF2FF]">{selected.group.guide.name}</span>
                    </p>
                  )}
                  {selected.group.members && selected.group.members.length > 0 && (
                    <div className="space-y-1.5">
                      {selected.group.members.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-[#EEF2FF]">{m.student.name}</span>
                          {m.student.prnNo && (
                            <span className="font-mono text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {m.student.prnNo}
                            </span>
                          )}
                          {m.isLeader && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Leader</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Resource links */}
              <div className="flex flex-wrap gap-2">
                {selected.githubLink && (
                  <a href={selected.githubLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A2540] border border-[#2A3A5C] text-sm text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/30 transition-all">
                    <Github size={14} /> GitHub
                  </a>
                )}
                {selected.videoLink && (
                  <a href={selected.videoLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A2540] border border-[#2A3A5C] text-sm text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/30 transition-all">
                    <Video size={14} /> Video
                  </a>
                )}
                {selected.driveLink && (
                  <a href={selected.driveLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A2540] border border-[#2A3A5C] text-sm text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/30 transition-all">
                    <ExternalLink size={14} /> Drive
                  </a>
                )}
                {selected.researchPaperLink && (
                  <a href={selected.researchPaperLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A2540] border border-[#2A3A5C] text-sm text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/30 transition-all">
                    <BookOpen size={14} /> Paper
                  </a>
                )}
                {selected.patentLink && (
                  <a href={selected.patentLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A2540] border border-[#2A3A5C] text-sm text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/30 transition-all">
                    <ExternalLink size={14} /> Patent
                  </a>
                )}
              </div>

              {/* Published date */}
              {selected.publishedAt && (
                <p className="text-xs text-[#4A5B7A] mt-4">
                  Published {new Date(selected.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
