'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  RefreshCw,
  BookOpen
} from 'lucide-react'

interface SimilarityResult {
  id: string
  title: string
  abstract?: string
  domain?: string
  groupName?: string
  similarity: number
  titleSimilarity?: number
  abstractSimilarity?: number
  commonTerms?: string[]
}

interface SimilarityResponse {
  isUnique: boolean
  similarProjects: SimilarityResult[]
}

interface UniquenessCheckerProps {
  project: {
    id: string
    title: string
    abstract?: string
    domain?: string
    group?: {
      id?: string
      name?: string
    }
  }
}

export function UniquenessChecker({ project }: UniquenessCheckerProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimilarityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const checkUniqueness = async () => {
    if (!project || !project.title) return
    setLoading(true)
    setError(null)
    setResult(null)
    setExpandedId(null)
    try {
      const res = await api.post('/projects/check-similarity', {
        title: project.title,
        abstract: project.abstract || '',
        domain: project.domain || '',
        excludeGroupId: project.group?.id,
      })
      setResult(res.data)
    } catch (err: any) {
      console.error('Uniqueness check error:', err)
      setError('Failed to compute similarity analysis.')
    } finally {
      setLoading(false)
    }
  }

  // Run automatically when the project ID changes
  useEffect(() => {
    checkUniqueness()
  }, [project?.id])

  // Helper to highlight terms case-insensitively in abstract text
  const highlightTerms = (text: string, terms: string[]) => {
    if (!text || !terms || terms.length === 0) return text

    // Escape terms for Regex safety
    const escapedTerms = terms
      .filter(t => t.length > 2)
      .map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    
    if (escapedTerms.length === 0) return text

    const regex = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi')
    const parts = text.split(regex)

    return (
      <>
        {parts.map((part, i) => {
          const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase())
          return isMatch ? (
            <mark
              key={i}
              className="bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded border border-amber-500/30 inline-block font-medium"
            >
              {part}
            </mark>
          ) : (
            part
          )
        })}
      </>
    )
  }

  if (error) {
    return (
      <div className="mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center gap-3">
        <AlertOctagon className="text-red-400" size={24} />
        <p className="text-sm text-red-400 font-medium">{error}</p>
        <button
          onClick={checkUniqueness}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-semibold transition-all"
        >
          <RefreshCw size={12} /> Retry Analysis
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-5 p-6 bg-[#1A2540]/30 border border-[#2A3A5C]/60 rounded-2xl backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center">
        <div className="relative flex items-center justify-center">
          <Loader2 size={36} className="text-amber-500 animate-spin" />
          <Sparkles size={16} className="text-amber-400 absolute animate-pulse" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[#EEF2FF]">Originality Check in Progress</h4>
          <p className="text-xs text-[#7A8BAF]">Tokenizing input fields and running TF-IDF cross-reference...</p>
        </div>
      </div>
    )
  }

  if (!result) return null

  // Calculate overall originality score based on max similarity
  const maxSimilarity = result.similarProjects.length > 0 
    ? Math.max(...result.similarProjects.map(p => p.similarity))
    : 0
  const originalityScore = 100 - maxSimilarity

  // Choose colors/styling based on score
  let statusColorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  let gaugeColor = '#10B981' // emerald-500
  let statusTitle = 'Highly Unique'
  let statusDesc = 'No significant overlap detected with past projects in the system database.'
  let StatusIcon = CheckCircle2

  if (originalityScore < 50) {
    statusColorClass = 'text-red-400 bg-red-500/10 border-red-500/20'
    gaugeColor = '#EF4444' // red-500
    statusTitle = 'High Plagiarism / Similarity Risk'
    statusDesc = 'Critical overlaps detected. Differentiating the topic or abstract is strongly recommended.'
    StatusIcon = AlertOctagon
  } else if (originalityScore < 80) {
    statusColorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    gaugeColor = '#F59E0B' // amber-500
    statusTitle = 'Moderate Similarity Match'
    statusDesc = 'Significant keywords and ideas overlap with existing work. Review details closely.'
    StatusIcon = AlertTriangle
  }

  // SVG Radial Gauge Calculations
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (originalityScore / 100) * circumference

  return (
    <div className="mt-6 border border-[#2A3A5C]/60 bg-[#121E36]/40 backdrop-blur-md rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-[#2A3A5C]/40 pb-3">
        <h4 className="text-sm font-semibold font-[var(--font-sora)] text-[#EEF2FF] flex items-center gap-2">
          <Sparkles className="text-amber-400" size={16} />
          Project Originality Analysis
        </h4>
        <button
          onClick={checkUniqueness}
          title="Refresh Analysis"
          className="p-1.5 border border-[#2A3A5C] text-[#7A8BAF] hover:text-[#EEF2FF] hover:border-amber-500/50 rounded-lg transition-all"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* ── Gauge & Info summary ── */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#0F1729]/50 border border-[#2A3A5C]/30 mb-4">
        {/* Radial Gauge */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="#1A2540"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={gaugeColor}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-[#EEF2FF] font-mono leading-none">{originalityScore}%</span>
            <span className="text-[8px] text-[#7A8BAF] uppercase tracking-wider font-semibold mt-0.5">Original</span>
          </div>
        </div>

        {/* Status description */}
        <div className="flex-1 space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5">
            <StatusIcon className={originalityScore < 50 ? 'text-red-400' : originalityScore < 80 ? 'text-amber-400' : 'text-emerald-400'} size={15} />
            <span className="text-sm font-bold text-[#EEF2FF]">{statusTitle}</span>
          </div>
          <p className="text-xs text-[#7A8BAF] leading-relaxed">{statusDesc}</p>
        </div>
      </div>

      {/* ── Similar Projects List ── */}
      {result.similarProjects.length === 0 ? (
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 text-center">
          <p className="text-xs text-[#7A8BAF]">✓ No duplicate or matching projects found in the system.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#7A8BAF]">
            Detected Source Overlaps ({result.similarProjects.length})
          </p>
          
          {result.similarProjects.map((sp) => {
            const isExpanded = expandedId === sp.id
            const simPercentage = sp.similarity
            const badgeClass = simPercentage >= 70
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'

            return (
              <div
                key={sp.id}
                className="border border-[#2A3A5C]/40 bg-[#16223A]/40 rounded-xl overflow-hidden hover:border-[#2A3A5C]/80 transition-all duration-200"
              >
                {/* Header block (always visible) */}
                <div
                  className="p-3 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : sp.id)}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <h5 className="text-xs font-bold text-[#EEF2FF] truncate">{sp.title}</h5>
                    <p className="text-[10px] text-[#4A5B7A] mt-0.5 truncate">
                      {sp.groupName ? `Group: ${sp.groupName}` : ''}
                      {sp.domain ? ` · Domain: ${sp.domain}` : ''}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                      {simPercentage}% match
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-[#4A5B7A]" /> : <ChevronDown size={14} className="text-[#4A5B7A]" />}
                  </div>
                </div>

                {/* Collapsible Details */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-[#2A3A5C]/30 bg-[#0C1527]/50"
                    >
                      <div className="p-3.5 space-y-3.5 text-xs">
                        {/* Horizontal Similarity Breakdown Bars */}
                        <div className="grid grid-cols-2 gap-4">
                          {sp.titleSimilarity !== undefined && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-[#7A8BAF]">
                                <span>Title Match</span>
                                <span className="font-semibold text-[#EEF2FF]">{sp.titleSimilarity}%</span>
                              </div>
                              <div className="h-1.5 bg-[#1A2540] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${sp.titleSimilarity >= 70 ? 'bg-red-500' : sp.titleSimilarity >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${sp.titleSimilarity}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {sp.abstractSimilarity !== undefined && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-[#7A8BAF]">
                                <span>Abstract Match</span>
                                <span className="font-semibold text-[#EEF2FF]">{sp.abstractSimilarity}%</span>
                              </div>
                              <div className="h-1.5 bg-[#1A2540] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${sp.abstractSimilarity >= 70 ? 'bg-red-500' : sp.abstractSimilarity >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${sp.abstractSimilarity}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Shared terms badges */}
                        {sp.commonTerms && sp.commonTerms.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-[#4A5B7A] uppercase tracking-wider font-semibold">Shared Terminology</span>
                            <div className="flex flex-wrap gap-1">
                              {sp.commonTerms.map((term, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                >
                                  {term}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compare Abstracts */}
                        {sp.abstract && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-[#4A5B7A] uppercase tracking-wider font-semibold flex items-center gap-1">
                              <BookOpen size={10} /> Abstract Match Comparison
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Current project's abstract */}
                              {project.abstract && (
                                <div className="p-2.5 rounded-lg border border-[#2A3A5C]/40 bg-[#16223A]/30">
                                  <span className="text-[9px] text-[#4A5B7A] font-bold block mb-1">THIS PROJECT</span>
                                  <p className="text-[10px] text-[#7A8BAF] leading-relaxed">
                                    {highlightTerms(project.abstract, sp.commonTerms || [])}
                                  </p>
                                </div>
                              )}

                              {/* Similar project's abstract */}
                              <div className="p-2.5 rounded-lg border border-[#2A3A5C]/40 bg-[#16223A]/30">
                                <span className="text-[9px] text-[#4A5B7A] font-bold block mb-1">EXISTING MATCH</span>
                                <p className="text-[10px] text-[#7A8BAF] leading-relaxed">
                                  {highlightTerms(sp.abstract, sp.commonTerms || [])}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
