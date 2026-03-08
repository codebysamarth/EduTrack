'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users, FolderOpen, User as UserIcon, Calendar, Crown, Github, Video,
  CheckCircle2, Circle, XCircle, Zap, Copy, ExternalLink, X, Loader2,
  Plus, BookOpen, FileText, Shield, Link as LinkIcon, AlertTriangle, Play,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import type { Project, Group, ProjectReview } from '@/types'

const SDG_NAMES: Record<number, string> = {
  1:'No Poverty',2:'Zero Hunger',3:'Good Health',4:'Quality Education',
  5:'Gender Equality',6:'Clean Water',7:'Affordable Energy',8:'Decent Work',
  9:'Industry & Innovation',10:'Reduced Inequalities',11:'Sustainable Cities',
  12:'Responsible Consumption',13:'Climate Action',14:'Life Below Water',
  15:'Life on Land',16:'Peace & Justice',17:'Partnerships',
}
const DOMAINS = ['Web Development','IoT','AI/ML','Blockchain','Mobile App','Embedded Systems','Cybersecurity','Data Science','Robotics','Other']
const STATUS_STEPS = ['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','PUBLISHED'] as const
const STATUS_LABELS: Record<string,string> = {
  DRAFT:'Draft',SUBMITTED:'Submitted',UNDER_REVIEW:'Under Review',
  APPROVED:'Approved',REJECTED:'Rejected',COMPLETED:'Completed',PUBLISHED:'Published',
}
const STATUS_COLORS: Record<string,string> = {
  DRAFT:'bg-gray-500/20 text-gray-400 border-gray-500/30',
  SUBMITTED:'bg-blue-500/20 text-blue-400 border-blue-500/30',
  UNDER_REVIEW:'bg-amber-500/20 text-amber-400 border-amber-500/30',
  REJECTED:'bg-red-500/20 text-red-400 border-red-500/30',
  APPROVED:'bg-green-500/20 text-green-400 border-green-500/30',
  COMPLETED:'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PUBLISHED:'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}
const STEP_DESC: Record<string,string> = {
  DRAFT:'Create your project proposal',SUBMITTED:'Submitted for guide review',
  UNDER_REVIEW:'Guide is reviewing your project',APPROVED:'Project approved by guide',
  PUBLISHED:'Project visible to all',
}

function PrnBadge({ prn }: { prn: string }) {
  return <span className="font-mono text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 tracking-wider">{prn}</span>
}
function StatusBadge({ status }: { status: string }) {
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT}`}>{STATUS_LABELS[status] ?? status}</span>
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function StudentPage() {
  const { user, roles, prnNo } = useAuth()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showLinksDialog, setShowLinksDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [createForm, setCreateForm] = useState({ title:'',abstract:'',domain:'',techStack:'',githubLink:'',sdgGoals:[] as number[] })
  const [linksForm, setLinksForm] = useState({ githubLink:'',videoLink:'',driveLink:'',researchPaperLink:'',patentLink:'' })

  useEffect(() => { if (!roles.includes('STUDENT')) router.replace('/dashboard') }, [roles, router])

  const fetchData = useCallback(async () => {
    try {
      const [gRes, pRes] = await Promise.all([api.get('/groups'), api.get('/projects')])
      if (gRes.data.length > 0) { const full = await api.get(`/groups/${gRes.data[0].id}`); setGroup(full.data) }
      if (pRes.data.length > 0) { const full = await api.get(`/projects/${pRes.data[0].id}`); setProject(full.data) }
    } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateProject = async () => {
    if (!group) return; setSubmitting(true)
    try {
      const body: Record<string,unknown> = { groupId:group.id, title:createForm.title, abstract:createForm.abstract||undefined, domain:createForm.domain||undefined, techStack:createForm.techStack||undefined, githubLink:createForm.githubLink||undefined }
      if (createForm.sdgGoals.length>0) body.sdgGoals = createForm.sdgGoals.map(String)
      await api.post('/projects', body)
      setShowCreateDialog(false); setCreateForm({title:'',abstract:'',domain:'',techStack:'',githubLink:'',sdgGoals:[]}); await fetchData()
    } catch {}
    setSubmitting(false)
  }
  const handleEditProject = async () => {
    if (!project) return; setSubmitting(true)
    try {
      const body: Record<string,unknown> = { title:createForm.title, abstract:createForm.abstract||undefined, domain:createForm.domain||undefined, techStack:createForm.techStack||undefined, githubLink:createForm.githubLink||undefined }
      if (createForm.sdgGoals.length>0) body.sdgGoals = createForm.sdgGoals.map(String)
      await api.patch(`/projects/${project.id}`, body); setShowEditDialog(false); await fetchData()
    } catch {}
    setSubmitting(false)
  }
  const handleSubmitProject = async () => {
    if (!project) return; setActionLoading('submit')
    try { await api.post(`/projects/${project.id}/submit`); await fetchData() } catch {}
    setActionLoading('')
  }
  const openEditDialog = () => {
    if (!project) return
    setCreateForm({ title:project.title, abstract:project.abstract??'', domain:project.domain??'', techStack:project.techStack??'', githubLink:project.githubLink??'', sdgGoals:project.sdgGoals??[] })
    setShowEditDialog(true)
  }
  // Links can be updated by any group member
  // Only project creation and status submission require leader role
  const openLinksDialog = () => {
    setLinksForm({ githubLink:project?.githubLink??'', videoLink:project?.videoLink??'', driveLink:project?.driveLink??'', researchPaperLink:project?.researchPaperLink??'', patentLink:project?.patentLink??'' })
    setShowLinksDialog(true)
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

  const greeting = (() => { const h=new Date().getHours(); if(h<12)return'Good morning'; if(h<17)return'Good afternoon'; return'Good evening' })()

  if (loading) return (
    <div className="space-y-6">
      <div className="animate-pulse bg-[#1A2540] rounded-xl h-12 w-80" />
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><div key={i} className="animate-pulse bg-[#1A2540] rounded-xl h-28"/>)}</div>
      <div className="animate-pulse bg-[#1A2540] rounded-xl h-64" />
    </div>
  )

  const studentProfile = user?.studentProfile
  const reviews: ProjectReview[] = project?.reviews ?? []
  const isLeader = group?.members?.some(m => m.student?.id === user?.id && m.isLeader) ?? false
  const isMember = group?.members?.some(m => m.student?.id === user?.id) ?? false
  const guide = group?.guide as unknown as { name?:string; prnNo?:string; facultyProfile?:{ designation?:string } } | undefined

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-['Sora'] text-2xl font-bold text-[#EEF2FF]">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-[#7A8BAF] text-sm mt-1">
            {studentProfile?.year} Year · Division {studentProfile?.division}
            {studentProfile?.department && <> · {studentProfile.department.name}</>}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[#4A5B7A] text-xs mb-1">PRN Number</span>
          <span className="font-mono text-base bg-amber-500/10 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/20 tracking-widest">{prnNo}</span>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'My Group',value:group?.name??'Not Assigned'},
          {label:'Project Status',statusBadge:project?.status},
          {label:'Guide',value:guide?.name??'Not Assigned'},
          {label:'Semester',value:group ? `${group.semester} · ${group.academicYear}` : '—'},
        ].map(card=>(
          <div key={card.label} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 hover:bg-[#1A2540] transition-all duration-200">
            <p className="text-[#7A8BAF] text-sm mb-1">{card.label}</p>
            {card.statusBadge ? <StatusBadge status={card.statusBadge}/> : <p className="text-[#EEF2FF] text-2xl font-bold font-['Sora']">{card.value}</p>}
          </div>
        ))}
      </motion.div>

      {/* Main content: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT col-span-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project card */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            {project ? (<>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-['Sora'] font-semibold text-[#EEF2FF] text-lg">{project.title}</h2>
                <StatusBadge status={project.status}/>
              </div>
              {project.abstract && <p className="text-sm text-[#7A8BAF] line-clamp-3 mb-3">{project.abstract}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {project.domain && <span className="bg-[#1A2540] text-[#EEF2FF] border border-[#2A3A5C] text-xs px-3 py-1 rounded-full">{project.domain}</span>}
                {project.techStack && typeof project.techStack==='string' && project.techStack.split(',').map(t=><span key={t} className="bg-[#1A2540] text-[#EEF2FF] border border-[#2A3A5C] text-xs px-3 py-1 rounded-full">{t.trim()}</span>)}
                {project.sdgGoals?.map(g=><span key={g} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5 rounded-full">SDG {g}</span>)}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {project.githubLink ? <a href={project.githubLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-sm"><Github size={14}/> GitHub</a> : isMember && <button onClick={openLinksDialog} className="border border-dashed border-[#2A3A5C] text-[#4A5B7A] hover:text-amber-400 hover:border-amber-500/30 px-3 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-xs"><Plus size={12}/> GitHub</button>}
                {project.videoLink ? <a href={project.videoLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-sm"><Video size={14}/> Video</a> : isMember && <button onClick={openLinksDialog} className="border border-dashed border-[#2A3A5C] text-[#4A5B7A] hover:text-amber-400 hover:border-amber-500/30 px-3 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-xs"><Plus size={12}/> Video</button>}
                {project.driveLink ? <a href={project.driveLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-sm"><FolderOpen size={14}/> Drive</a> : isMember && <button onClick={openLinksDialog} className="border border-dashed border-[#2A3A5C] text-[#4A5B7A] hover:text-amber-400 hover:border-amber-500/30 px-3 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-xs"><Plus size={12}/> Drive</button>}
                {project.researchPaperLink ? <a href={project.researchPaperLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-sm"><FileText size={14}/> Paper</a> : isMember && <button onClick={openLinksDialog} className="border border-dashed border-[#2A3A5C] text-[#4A5B7A] hover:text-amber-400 hover:border-amber-500/30 px-3 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-xs"><Plus size={12}/> Paper</button>}
                {project.patentLink ? <a href={project.patentLink} target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-sm"><Shield size={14}/> Patent</a> : isMember && <button onClick={openLinksDialog} className="border border-dashed border-[#2A3A5C] text-[#4A5B7A] hover:text-amber-400 hover:border-amber-500/30 px-3 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-xs"><Plus size={12}/> Patent</button>}
                {isMember && <button onClick={openLinksDialog} className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 text-sm"><LinkIcon size={14}/> Update Links</button>}
              </div>
              {/* Action bar */}
              <div className="border-t border-[#2A3A5C] pt-4 mt-4 flex gap-3 flex-wrap">
                {project.status==='DRAFT' && isLeader && <>
                  <button onClick={handleSubmitProject} disabled={actionLoading==='submit'} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-2 text-sm disabled:opacity-60">{actionLoading==='submit'?<Loader2 size={14} className="animate-spin"/>:null} Submit Project</button>
                  <button onClick={openEditDialog} className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm">Edit Project</button>
                </>}
                {project.status==='REJECTED' && <>
                  <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-2">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1"><AlertTriangle size={14}/>Project Rejected</div>
                    {reviews.length>0 && reviews[reviews.length-1]?.rejectionReason && <p className="text-red-300 text-xs">{reviews[reviews.length-1].rejectionReason}</p>}
                  </div>
                  {isLeader && <button onClick={openEditDialog} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl transition-all duration-200 text-sm">Edit & Resubmit</button>}
                </>}
                {(project.status==='SUBMITTED'||project.status==='UNDER_REVIEW') && <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-blue-400 text-sm">Your project is under review</div>}
                {project.status==='APPROVED' && <div className="w-full bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">Project Approved! 🎉</div>}
                {project.status==='PUBLISHED' && <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center justify-between">
                  <span>Project Published to Showcase! 🌟</span>
                  <a href="/dashboard/showcase" className="underline text-xs hover:text-emerald-300">View in Showcase</a>
                </div>}
              </div>
            </>) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-12 h-12 text-[#4A5B7A] mb-4"/>
                <p className="text-[#7A8BAF] text-lg">No project created yet</p>
                {isLeader && group && <button onClick={()=>setShowCreateDialog(true)} className="mt-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-2 text-sm"><Plus size={16}/> Create Project</button>}
              </div>
            )}
          </motion.div>

          {/* Reviews */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Review History</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">{reviews.length}</span>
            </div>
            {reviews.length===0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center"><BookOpen className="w-12 h-12 text-[#4A5B7A] mb-4"/><p className="text-[#7A8BAF] text-lg">No reviews yet</p></div>
            ) : reviews.map(r=>(
              <div key={r.id} className="flex gap-3 mb-3 last:mb-0">
                <div className="mt-1 shrink-0">{r.isApproved ? <CheckCircle2 size={16} className="text-green-400"/> : <XCircle size={16} className="text-red-400"/>}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between"><span className={`text-xs font-medium ${r.isApproved?'text-green-400':'text-red-400'}`}>{r.isApproved?'Approved':'Rejected'}</span><span className="text-xs text-[#4A5B7A]">{r.reviewer?.name} · {new Date(r.createdAt).toLocaleDateString()}</span></div>
                  <p className="text-sm text-[#EEF2FF] mt-1">{r.comment}</p>
                  {r.rejectionReason && <div className="bg-red-500/10 rounded p-2 mt-1 text-red-300 text-xs">{r.rejectionReason}</div>}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT col-span-1 */}
        <div className="space-y-6">
          {/* Timeline */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">Project Progress</h3>
            <div className="flex flex-col">
              {STATUS_STEPS.map((step,idx)=>{
                const curIdx = STATUS_STEPS.indexOf(project?.status as typeof STATUS_STEPS[number])
                const isCompleted = project ? idx < curIdx : false
                const isCurrent = step === project?.status
                return (
                  <div key={step}>
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        {isCompleted ? <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"><CheckCircle2 size={16} className="text-white"/></div>
                        : isCurrent ? <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center animate-pulse"><Circle size={10} className="text-black fill-black"/></div>
                        : <div className="w-8 h-8 rounded-full border-2 border-[#2A3A5C]"/>}
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${isCurrent?'text-amber-400':isCompleted?'text-green-400':'text-[#4A5B7A]'}`}>{STATUS_LABELS[step]}</span>
                        <p className="text-xs text-[#4A5B7A]">{STEP_DESC[step]}</p>
                      </div>
                    </div>
                    {idx < STATUS_STEPS.length-1 && <div className={`w-0.5 h-8 ml-4 ${isCompleted?'bg-green-500':'bg-[#2A3A5C]'}`}/>}
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Group Members */}
          {group?.members && group.members.length>0 && (
            <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
              <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">Group Members</h3>
              <div className="space-y-3">
                {group.members.map(m=>{
                  const s = m.student as unknown as {id:string;name:string;prnNo?:string;studentProfile?:{prnNo?:string;enrollmentNo?:string}}
                  const mPrn = s?.prnNo ?? s?.studentProfile?.prnNo
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">{s?.name?.[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className="text-sm text-[#EEF2FF]">{s?.name}</span>{m.isLeader && <span className="text-xs">👑</span>}</div>
                        <div className="flex items-center gap-2 mt-0.5">{mPrn && <PrnBadge prn={mPrn}/>}<span className="text-xs text-[#4A5B7A]">{s?.studentProfile?.enrollmentNo}</span></div>
                      </div>
                    </div>
                  )
                })}
                {guide && (
                  <div className="border-t border-[#2A3A5C] pt-3 mt-2">
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm">{guide.name?.[0]?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-sm text-[#EEF2FF]">{guide.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">GUIDE</span></div>
                        {guide.prnNo && <PrnBadge prn={guide.prnNo}/>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {(showCreateDialog||showEditDialog) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={()=>{setShowCreateDialog(false);setShowEditDialog(false)}}>
          <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Sora'] text-lg font-semibold text-[#EEF2FF]">{showEditDialog?'Edit Project':'Create New Project'}</h3>
              <button onClick={()=>{setShowCreateDialog(false);setShowEditDialog(false)}} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18}/></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Title *</label><input type="text" value={createForm.title} onChange={e=>setCreateForm(p=>({...p,title:e.target.value}))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" placeholder="Project title"/></div>
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Abstract</label><textarea value={createForm.abstract} onChange={e=>setCreateForm(p=>({...p,abstract:e.target.value}))} rows={4} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none resize-none" placeholder="Brief project abstract"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Domain</label><select value={createForm.domain} onChange={e=>setCreateForm(p=>({...p,domain:e.target.value}))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none"><option value="">Select</option>{DOMAINS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="block text-xs text-[#7A8BAF] mb-1.5">Tech Stack</label><input type="text" value={createForm.techStack} onChange={e=>setCreateForm(p=>({...p,techStack:e.target.value}))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" placeholder="React, Node.js, MongoDB"/></div>
              </div>
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">GitHub Link</label><input type="url" value={createForm.githubLink} onChange={e=>setCreateForm(p=>({...p,githubLink:e.target.value}))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" placeholder="https://github.com/..."/></div>
              <div><label className="block text-xs text-[#7A8BAF] mb-1.5">SDG Goals (optional)</label><div className="flex flex-wrap gap-2">{Object.entries(SDG_NAMES).map(([n,name])=>{const num=parseInt(n);const sel=createForm.sdgGoals.includes(num);return <button key={n} type="button" onClick={()=>setCreateForm(p=>({...p,sdgGoals:sel?p.sdgGoals.filter(g=>g!==num):[...p.sdgGoals,num]}))} className={`text-xs px-2 py-1 rounded-full border transition-all duration-200 ${sel?'bg-blue-500/20 text-blue-400 border-blue-500/30':'bg-[#1A2540] text-[#4A5B7A] border-[#2A3A5C] hover:text-[#7A8BAF]'}`} title={name}>{n}</button>})}</div></div>
            </div>
            <button onClick={showEditDialog?handleEditProject:handleCreateProject} disabled={!createForm.title||submitting} className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">{submitting?<Loader2 size={14} className="animate-spin"/>:<Plus size={14}/>}{showEditDialog?'Update Project':'Create Project'}</button>
          </motion.div>
        </div>
      )}

      {/* Links Dialog */}
      {showLinksDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLinksDialog(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
