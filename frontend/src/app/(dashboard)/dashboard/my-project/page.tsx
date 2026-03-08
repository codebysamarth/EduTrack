'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FolderOpen, Github, Video, CheckCircle2, Circle, XCircle,
  Loader2, Plus, X, FileText, Shield, Link as LinkIcon, AlertTriangle,
  ExternalLink, Play,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import type { Project, ProjectReview } from '@/types'

const SDG_NAMES: Record<number, string> = {
  1:'No Poverty',2:'Zero Hunger',3:'Good Health',4:'Quality Education',
  5:'Gender Equality',6:'Clean Water',7:'Affordable Energy',8:'Decent Work',
  9:'Industry & Innovation',10:'Reduced Inequalities',11:'Sustainable Cities',
  12:'Responsible Consumption',13:'Climate Action',14:'Life Below Water',
  15:'Life on Land',16:'Peace & Justice',17:'Partnerships',
}
const DOMAINS = ['Web Development','IoT','AI/ML','Blockchain','Mobile App','Embedded Systems','Cybersecurity','Data Science','Robotics','Other']
const STATUS_STEPS = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','COMPLETED','PUBLISHED'] as const
const STATUS_LABELS: Record<string,string> = {
  DRAFT:'Draft',SUBMITTED:'Submitted',UNDER_REVIEW:'Under Review',
  APPROVED:'Approved',REJECTED:'Rejected',COMPLETED:'Completed',PUBLISHED:'Published',
}
const STATUS_COLORS: Record<string,string> = {
  DRAFT:'bg-gray-500/20 text-gray-400 border-gray-500/30',
  SUBMITTED:'bg-blue-500/20 text-blue-400 border-blue-500/30',
  UNDER_REVIEW:'bg-amber-500/20 text-amber-400 border-amber-500/30',
  REJECTED:'bg-red-500/20 text-red-400 border-red-500/30',
  APPROVED:'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  COMPLETED:'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PUBLISHED:'bg-violet-500/20 text-violet-400 border-violet-500/30',
}
const STEP_DESC: Record<string,string> = {
  DRAFT: 'Create your project proposal',
  SUBMITTED: 'Submitted for guide review',
  UNDER_REVIEW: 'Guide is reviewing your project',
  REJECTED: 'Revisions requested — edit and resubmit',
  APPROVED: 'Project approved by guide',
  COMPLETED: 'Project successfully completed',
  PUBLISHED: 'Project visible on public showcase',
}

function PrnBadge({ prn }: { prn: string }) {
  return <span className="font-mono text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 tracking-wider">{prn}</span>
}
function StatusBadge({ status }: { status: string }) {
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT}`}>{STATUS_LABELS[status] ?? status}</span>
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function MyProjectPage() {
  const { user, roles } = useAuth()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showLinksDialog, setShowLinksDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [isLeader, setIsLeader] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [createForm, setCreateForm] = useState({ title:'',abstract:'',domain:'',techStack:'',githubLink:'',sdgGoals:[] as number[] })
  const [linksForm, setLinksForm] = useState({ githubLink:'',videoLink:'',driveLink:'',researchPaperLink:'',patentLink:'' })

  useEffect(() => { if (!roles.includes('STUDENT')) router.replace('/dashboard') }, [roles, router])

  const fetchData = useCallback(async () => {
    try {
      const gRes = await api.get('/groups')
      if (gRes.data.length > 0) {
        setGroupId(gRes.data[0].id)
        const full = await api.get(`/groups/${gRes.data[0].id}`)
        setIsLeader(full.data.members?.some((m: { student?: { id: string }; isLeader: boolean }) => m.student?.id === user?.id && m.isLeader) ?? false)
        setIsMember(full.data.members?.some((m: { student?: { id: string } }) => m.student?.id === user?.id) ?? false)
      }
      const pRes = await api.get('/projects')
      if (pRes.data.length > 0) {
        const full = await api.get(`/projects/${pRes.data[0].id}`)
        setProject(full.data)
      }
    } catch {}
    setLoading(false)
  }, [user?.id])
  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateProject = async () => {
    if (!groupId) return; setSubmitting(true)
    try {
      const body: Record<string,unknown> = { groupId, title:createForm.title, abstract:createForm.abstract||undefined, domain:createForm.domain||undefined, techStack:createForm.techStack||undefined, githubLink:createForm.githubLink||undefined }
      if (createForm.sdgGoals.length > 0) body.sdgGoals = createForm.sdgGoals.map(String)
      await api.post('/projects', body)
      setShowCreateDialog(false); setCreateForm({title:'',abstract:'',domain:'',techStack:'',githubLink:'',sdgGoals:[]}); await fetchData()
    } catch {}
    setSubmitting(false)
  }
  const handleEditProject = async () => {
    if (!project) return; setSubmitting(true)
    try {
      const body: Record<string,unknown> = { title:createForm.title, abstract:createForm.abstract||undefined, domain:createForm.domain||undefined, techStack:createForm.techStack||undefined, githubLink:createForm.githubLink||undefined }
      if (createForm.sdgGoals.length > 0) body.sdgGoals = createForm.sdgGoals.map(String)
      await api.patch(`/projects/${project.id}`, body); setShowEditDialog(false); await fetchData()
    } catch {}
    setSubmitting(false)
  }
  const handleSubmitProject = async () => {
    if (!project) return; setActionLoading('submit')
    try { await api.post(`/projects/${project.id}/submit`); await fetchData() } catch {}
    setActionLoading('')
  }
  const handleSaveLinks = async () => {
    if (!project) return; setSubmitting(true)
    try {
      const body: Record<string, string> = {}
      Object.entries(linksForm).forEach(([k, v]) => { if (v) body[k] = v })
      await api.patch(`/projects/${project.id}`, body)
      setShowLinksDialog(false); await fetchData(); toast.success('Links updated')
    } catch { toast.error('Failed to update links') }
    setSubmitting(false)
  }
  const openEditDialog = () => {
    if (!project) return
    setCreateForm({ title:project.title, abstract:project.abstract??'', domain:project.domain??'', techStack:project.techStack??'', githubLink:project.githubLink??'', sdgGoals:project.sdgGoals??[] })
    setShowEditDialog(true)
  }
  const openLinksDialog = () => {
    setLinksForm({ githubLink:project?.githubLink??'', videoLink:project?.videoLink??'', driveLink:project?.driveLink??'', researchPaperLink:project?.researchPaperLink??'', patentLink:project?.patentLink??'' })
    setShowLinksDialog(true)
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="animate-pulse bg-[#1A2540] rounded-xl h-12 w-60" />
      <div className="animate-pulse bg-[#1A2540] rounded-xl h-64" />
      <div className="animate-pulse bg-[#1A2540] rounded-xl h-48" />
    </div>
  )

  if (!project) return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen className="w-16 h-16 text-amber-500/30 mb-4" />
      <h2 className="font-['Sora'] text-xl font-bold text-[#EEF2FF] mb-2">No Project Yet</h2>
      <p className="text-[#7A8BAF] mb-1">Create your group&apos;s project proposal to get started</p>
      <p className="text-[#4A5B7A] text-xs mb-6">Only the group leader can create the project</p>
      {isLeader && groupId && <button onClick={() => setShowCreateDialog(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 inline-flex items-center gap-2"><Plus size={16} /> Create Project</button>}
    </motion.div>
  )

  const reviews: ProjectReview[] = project.reviews ?? []
  const techArr = typeof project.techStack === 'string' ? project.techStack.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Hero Card */}
      <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-8">
        <div className="flex flex-wrap gap-2 mb-2">
          <StatusBadge status={project.status} />
          {project.isPublished && <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Published</span>}
        </div>
        <h1 className="font-['Sora'] text-3xl font-bold text-[#EEF2FF] mt-2">{project.title}</h1>
        <div className="flex flex-wrap gap-2 mt-3">
          {project.domain && <span className="bg-[#1A2540] text-[#EEF2FF] border border-[#2A3A5C] text-xs px-3 py-1 rounded-full">{project.domain}</span>}
          {techArr.map(t => <span key={t} className="bg-[#1A2540] text-[#EEF2FF] border border-[#2A3A5C] text-xs px-3 py-1 rounded-full">{t}</span>)}
          {project.sdgGoals?.map(g => <span key={g} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5 rounded-full">SDG {g}</span>)}
        </div>
        <p className="text-[#4A5B7A] text-sm mt-3">
          {project.group?.name} · {project.group?.guide ? (project.group.guide as unknown as { name: string }).name : 'No guide'} · {project.group?.academicYear}
        </p>
        <div className="border-t border-[#2A3A5C] mt-4 pt-4">
          <span className="text-xs uppercase tracking-wider text-[#4A5B7A]">Abstract</span>
          {project.abstract ? <p className="text-[#7A8BAF] leading-relaxed mt-2">{project.abstract}</p> : <p className="text-[#4A5B7A] italic mt-2">No abstract added yet</p>}
        </div>
      </motion.div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resources */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">Project Resources</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl"><div className="flex items-center gap-2 text-[#7A8BAF] text-sm"><Github size={16} /> GitHub Repository</div>{project.githubLink ? <a href={project.githubLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#243052] hover:text-[#EEF2FF] px-3 py-1.5 rounded-lg text-xs transition-all inline-flex items-center gap-1"><ExternalLink size={12}/> Visit</a> : isMember ? <button onClick={openLinksDialog} className="text-xs text-[#4A5B7A] hover:text-amber-400 transition-colors inline-flex items-center gap-1"><Plus size={12}/> Add link</button> : <span className="text-xs text-[#4A5B7A]">Not added</span>}</div>
              <div className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl"><div className="flex items-center gap-2 text-[#7A8BAF] text-sm"><Play size={16} /> Demo Video</div>{project.videoLink ? <a href={project.videoLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#243052] hover:text-[#EEF2FF] px-3 py-1.5 rounded-lg text-xs transition-all inline-flex items-center gap-1"><ExternalLink size={12}/> Watch</a> : isMember ? <button onClick={openLinksDialog} className="text-xs text-[#4A5B7A] hover:text-amber-400 transition-colors inline-flex items-center gap-1"><Plus size={12}/> Add link</button> : <span className="text-xs text-[#4A5B7A]">Not added</span>}</div>
              <div className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl"><div className="flex items-center gap-2 text-[#7A8BAF] text-sm"><FolderOpen size={16} /> Drive Folder</div>{project.driveLink ? <a href={project.driveLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#243052] hover:text-[#EEF2FF] px-3 py-1.5 rounded-lg text-xs transition-all inline-flex items-center gap-1"><ExternalLink size={12}/> Open</a> : isMember ? <button onClick={openLinksDialog} className="text-xs text-[#4A5B7A] hover:text-amber-400 transition-colors inline-flex items-center gap-1"><Plus size={12}/> Add link</button> : <span className="text-xs text-[#4A5B7A]">Not added</span>}</div>
              <div className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl"><div className="flex items-center gap-2 text-[#7A8BAF] text-sm"><FileText size={16} /> Research Paper</div>{project.researchPaperLink ? <a href={project.researchPaperLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#243052] hover:text-[#EEF2FF] px-3 py-1.5 rounded-lg text-xs transition-all inline-flex items-center gap-1"><ExternalLink size={12}/> View</a> : isMember ? <button onClick={openLinksDialog} className="text-xs text-[#4A5B7A] hover:text-amber-400 transition-colors inline-flex items-center gap-1"><Plus size={12}/> Add link</button> : <span className="text-xs text-[#4A5B7A]">Not added</span>}</div>
              <div className="flex items-center justify-between p-3 bg-[#1A2540] rounded-xl"><div className="flex items-center gap-2 text-[#7A8BAF] text-sm"><Shield size={16} /> Patent Document</div>{project.patentLink ? <a href={project.patentLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#243052] hover:text-[#EEF2FF] px-3 py-1.5 rounded-lg text-xs transition-all inline-flex items-center gap-1"><ExternalLink size={12}/> View</a> : isMember ? <button onClick={openLinksDialog} className="text-xs text-[#4A5B7A] hover:text-amber-400 transition-colors inline-flex items-center gap-1"><Plus size={12}/> Add link</button> : <span className="text-xs text-[#4A5B7A]">Not added</span>}</div>
            </div>
            {/* Links can be updated by any group member */}
            {/* Only project creation and status submission require leader role */}
            {isMember && <button onClick={openLinksDialog} className="mt-4 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm">Update Links</button>}
            {/* FF180 */}
            <div className="border-t border-[#2A3A5C] mt-4 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm"><FileText size={14} className="text-[#4A5B7A]" /><span className="text-[#7A8BAF]">FF180 Form</span></div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${project.ff180Status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : project.ff180Status === 'SUBMITTED' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>{project.ff180Status}</span>
            </div>
          </motion.div>

          {/* Reviews */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Review History</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">{reviews.length}</span>
            </div>
            {reviews.length === 0 ? (
              <p className="text-[#4A5B7A] text-sm py-8 text-center">Awaiting first review from your guide</p>
            ) : reviews.slice().reverse().map(r => (
              <div key={r.id} className="bg-[#1A2540] rounded-xl p-4 mb-3 last:mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.isApproved ? <CheckCircle2 size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}
                    <span className={`text-xs font-medium ${r.isApproved ? 'text-green-400' : 'text-red-400'}`}>{r.isApproved ? 'Approved' : 'Rejected'}</span>
                  </div>
                  <span className="text-xs text-[#4A5B7A]">{r.reviewer?.name} · {new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-[#EEF2FF] mt-2">{r.comment}</p>
                {r.rejectionReason && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-2 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                    <span className="text-red-300 text-sm">Reason: {r.rejectionReason}</span>
                  </div>
                )}
              </div>
            ))}
          </motion.div>

          {/* Action Bar */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-4">
            {project.status === 'DRAFT' && isLeader && (
              <div className="flex gap-3">
                <button onClick={handleSubmitProject} disabled={actionLoading === 'submit'} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 inline-flex items-center gap-2 text-sm disabled:opacity-60">{actionLoading === 'submit' ? <Loader2 size={14} className="animate-spin" /> : null} Submit for Review</button>
                <button onClick={openEditDialog} className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm">Edit Project</button>
              </div>
            )}
            {project.status === 'REJECTED' && (
              <div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3 text-red-400 text-sm">Rejected — Please fix the issues and resubmit</div>
                {isLeader && <button onClick={openEditDialog} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 text-sm">Edit Project</button>}
              </div>
            )}
            {project.status === 'SUBMITTED' && <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-blue-400 text-sm">Submitted — Waiting for guide review</div>}
            {project.status === 'UNDER_REVIEW' && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-sm">Guide is currently reviewing your project</div>}
            {project.status === 'APPROVED' && <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">Approved! 🎉 Your guide will publish this project soon.</div>}
            {project.status === 'PUBLISHED' && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center justify-between">
                <span>Published to Showcase! 🌟</span>
                <a href="/dashboard/showcase" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl transition-all duration-200 text-sm">View in Showcase</a>
              </div>
            )}
          </motion.div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Timeline */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">Project Progress</h3>
            <div className="flex flex-col">
              {STATUS_STEPS.map((step, idx) => {
                const effectiveStatus = project.status === 'REJECTED' ? 'SUBMITTED' : project.status
                const curIdx = STATUS_STEPS.indexOf(effectiveStatus as typeof STATUS_STEPS[number])
                const isCompleted = idx < curIdx
                const isCurrent = step === effectiveStatus
                return (
                  <div key={step}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        {isCompleted ? <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><CheckCircle2 size={16} className="text-white" /></div>
                          : isCurrent ? <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center animate-pulse"><Circle size={10} className="text-black fill-black" /></div>
                          : <div className="w-8 h-8 rounded-full border-2 border-[#2A3A5C]" />}
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${isCurrent ? 'text-amber-400' : isCompleted ? 'text-green-400' : 'text-[#4A5B7A]'}`}>{STATUS_LABELS[step]}</span>
                        <p className="text-xs text-[#4A5B7A]">{STEP_DESC[step]}</p>
                      </div>
                    </div>
                    {idx < STATUS_STEPS.length - 1 && <div className={`w-0.5 h-8 ml-4 ${isCompleted ? 'bg-green-500' : 'bg-[#2A3A5C]'}`} />}
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Links can be updated by any group member */}
          {isMember && (
            <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
              <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">Update Resources</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1">GitHub Link</label>
                  <input type="url" value={linksForm.githubLink} onChange={e => setLinksForm(p => ({ ...p, githubLink: e.target.value }))} placeholder="https://github.com/username/project" className="w-full px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1">Video Link</label>
                  <input type="url" value={linksForm.videoLink} onChange={e => setLinksForm(p => ({ ...p, videoLink: e.target.value }))} placeholder="https://drive.google.com/... or YouTube link" className="w-full px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1">Drive Folder</label>
                  <input type="url" value={linksForm.driveLink} onChange={e => setLinksForm(p => ({ ...p, driveLink: e.target.value }))} placeholder="https://drive.google.com/drive/folders/..." className="w-full px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1">Research Paper</label>
                  <input type="url" value={linksForm.researchPaperLink} onChange={e => setLinksForm(p => ({ ...p, researchPaperLink: e.target.value }))} placeholder="https://drive.google.com/... or DOI link" className="w-full px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1">Patent Document</label>
                  <input type="url" value={linksForm.patentLink} onChange={e => setLinksForm(p => ({ ...p, patentLink: e.target.value }))} placeholder="https://drive.google.com/... or patent link" className="w-full px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
              <button onClick={handleSaveLinks} disabled={submitting} className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl transition-all duration-200 text-sm disabled:opacity-60">Save Links</button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {(showCreateDialog || showEditDialog) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false) }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Sora'] text-lg font-semibold text-[#EEF2FF]">{showEditDialog ? 'Edit Project' : 'Create New Project'}</h3>
              <button onClick={() => { setShowCreateDialog(false); setShowEditDialog(false) }} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Title *</label><input type="text" value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" placeholder="Project title" /></div>
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Abstract</label><textarea value={createForm.abstract} onChange={e => setCreateForm(p => ({ ...p, abstract: e.target.value }))} rows={4} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none resize-none" placeholder="Brief project abstract" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Domain</label><select value={createForm.domain} onChange={e => setCreateForm(p => ({ ...p, domain: e.target.value }))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none"><option value="">Select</option>{DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Tech Stack</label><input type="text" value={createForm.techStack} onChange={e => setCreateForm(p => ({ ...p, techStack: e.target.value }))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" placeholder="React, Node.js, MongoDB" /></div>
              </div>
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">GitHub Link</label><input type="url" value={createForm.githubLink} onChange={e => setCreateForm(p => ({ ...p, githubLink: e.target.value }))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" placeholder="https://github.com/..." /></div>
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">SDG Goals (optional)</label>
                <div className="flex flex-wrap gap-2">{Object.entries(SDG_NAMES).map(([n, name]) => { const num = parseInt(n); const sel = createForm.sdgGoals.includes(num); return <button key={n} type="button" onClick={() => setCreateForm(p => ({ ...p, sdgGoals: sel ? p.sdgGoals.filter(g => g !== num) : [...p.sdgGoals, num] }))} className={`text-xs px-2 py-1 rounded-full border transition-all ${sel ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-[#1A2540] text-[#4A5B7A] border-[#2A3A5C] hover:text-[#7A8BAF]'}`} title={name}>{n}</button> })}</div>
              </div>
            </div>
            <button onClick={showEditDialog ? handleEditProject : handleCreateProject} disabled={!createForm.title || submitting} className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">{submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{showEditDialog ? 'Update Project' : 'Create Project'}</button>
          </motion.div>
        </div>
      )}

      {/* Links Dialog */}
      {showLinksDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLinksDialog(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Sora'] text-lg font-semibold text-[#EEF2FF]">Update Resources</h3>
              <button onClick={() => setShowLinksDialog(false)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-[#7A8BAF] mb-1.5 flex items-center gap-1.5"><Github size={12}/> GitHub Repository</label><input type="url" value={linksForm.githubLink} onChange={e => setLinksForm(p => ({ ...p, githubLink: e.target.value }))} placeholder="https://github.com/username/project" className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" /></div>
              <div><label className="text-xs text-[#7A8BAF] mb-1.5 flex items-center gap-1.5"><Play size={12}/> Demo Video Link</label><input type="url" value={linksForm.videoLink} onChange={e => setLinksForm(p => ({ ...p, videoLink: e.target.value }))} placeholder="https://drive.google.com/... or YouTube link" className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" /></div>
              <div><label className="text-xs text-[#7A8BAF] mb-1.5 flex items-center gap-1.5"><FolderOpen size={12}/> Google Drive Folder</label><input type="url" value={linksForm.driveLink} onChange={e => setLinksForm(p => ({ ...p, driveLink: e.target.value }))} placeholder="https://drive.google.com/drive/folders/..." className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" /></div>
              <div><label className="text-xs text-[#7A8BAF] mb-1.5 flex items-center gap-1.5"><FileText size={12}/> Research Paper</label><input type="url" value={linksForm.researchPaperLink} onChange={e => setLinksForm(p => ({ ...p, researchPaperLink: e.target.value }))} placeholder="https://drive.google.com/... or DOI link" className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" /></div>
              <div><label className="text-xs text-[#7A8BAF] mb-1.5 flex items-center gap-1.5"><Shield size={12}/> Patent Document</label><input type="url" value={linksForm.patentLink} onChange={e => setLinksForm(p => ({ ...p, patentLink: e.target.value }))} placeholder="https://drive.google.com/... or patent link" className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" /></div>
            </div>
            <button onClick={handleSaveLinks} disabled={submitting} className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">{submitting ? <Loader2 size={14} className="animate-spin" /> : null} Save Links</button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
