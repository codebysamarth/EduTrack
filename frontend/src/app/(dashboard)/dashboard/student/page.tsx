'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Users, FolderOpen, User as UserIcon, Calendar, Crown, Github, Video,
  CheckCircle2, Circle, XCircle, Zap, Copy, ExternalLink, X, Loader2,
  Plus, BookOpen, FileText, Shield, Link as LinkIcon, AlertTriangle, Play,
  Send, Check, Clock, LogOut, Mail,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import type { Project, Group, ProjectReview, PendingInvitation } from '@/types'

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

export default function StudentPage() {
  const { user, roles, prnNo } = useAuth()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showLinksDialog, setShowLinksDialog] = useState(false)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [createForm, setCreateForm] = useState({ title:'',abstract:'',domain:'',techStack:'',githubLink:'',sdgGoals:[] as number[] })
  const [linksForm, setLinksForm] = useState({ githubLink:'',videoLink:'',driveLink:'',researchPaperLink:'',patentLink:'' })
  const [groupForm, setGroupForm] = useState({ name:'', academicYear:'2025-26', semester:5 })
  const [classmates, setClassmates] = useState<{id:string;name:string;prnNo:string;enrollmentNo:string}[]>([])
  const [classmateSearch, setClassmateSearch] = useState('')
  const [groupCreating, setGroupCreating] = useState(false)
  const [inviteIds, setInviteIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [respondingInvId, setRespondingInvId] = useState('')
  const [similarityResult, setSimilarityResult] = useState<{
    isUnique: boolean;
    checkedAt: Date;
    title: string;
    similarProjects: { id: string; title: string; abstract?: string; domain?: string; groupName?: string; similarity: number; titleSimilarity?: number; abstractSimilarity?: number; commonTerms?: string[] }[];
  } | null>(null)
  const [checkingSimilarity, setCheckingSimilarity] = useState(false)

  useEffect(() => { if (!roles.includes('STUDENT')) router.replace('/dashboard') }, [roles, router])

  const fetchData = useCallback(async () => {
    try {
      const [gRes, pRes, invRes] = await Promise.all([
        api.get('/groups'),
        api.get('/projects'),
        api.get('/groups/my-invitations').catch(() => ({ data: [] })),
      ])
      if (gRes.data.length > 0) { const full = await api.get(`/groups/${gRes.data[0].id}`); setGroup(full.data) }
      else { setGroup(null) }
      if (pRes.data.length > 0) { const full = await api.get(`/projects/${pRes.data[0].id}`); setProject(full.data) }
      else { setProject(null) }
      setPendingInvitations(invRes.data)
    } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateProject = async () => {
    if (!group) return; setSubmitting(true)
    try {
      const body: Record<string,unknown> = { groupId:group.id, title:createForm.title, abstract:createForm.abstract||undefined, domain:createForm.domain||undefined, techStack:createForm.techStack||undefined, githubLink:createForm.githubLink||undefined }
      if (createForm.sdgGoals.length>0) body.sdgGoals = createForm.sdgGoals.map(String)
      const res = await api.post('/projects', body)
      if (res.data.similarityWarning) {
        setSimilarityResult({
          isUnique: false,
          checkedAt: new Date(),
          title: createForm.title,
          similarProjects: res.data.similarityWarning.similarProjects || [],
        })
        toast.warning('Similar projects detected — review below')
      }
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
    try {
      const res = await api.post(`/projects/${project.id}/submit`)
      if (res.data.similarityWarning) {
        setSimilarityResult({
          isUnique: false,
          checkedAt: new Date(),
          title: project.title,
          similarProjects: res.data.similarityWarning.similarProjects || [],
        })
        toast.warning('Similar projects found — see report below')
      }
      await fetchData()
    } catch {}
    setActionLoading('')
  }
  const openEditDialog = () => {
    if (!project) return
    setCreateForm({ title:project.title, abstract:project.abstract??'', domain:project.domain??'', techStack:project.techStack??'', githubLink:project.githubLink??'', sdgGoals:project.sdgGoals??[] })
    setShowEditDialog(true)
  }

  const handleCheckSimilarity = async () => {
    const title = showCreateDialog || showEditDialog ? createForm.title : project?.title
    const abstract = showCreateDialog || showEditDialog ? createForm.abstract : project?.abstract
    const domain = showCreateDialog || showEditDialog ? createForm.domain : project?.domain
    if (!title) { toast.error('Enter a title first'); return }
    setCheckingSimilarity(true)
    try {
      const res = await api.post('/projects/check-similarity', { title, abstract: abstract||'', domain: domain||'', excludeGroupId: group?.id })
      setSimilarityResult({
        isUnique: res.data.isUnique,
        checkedAt: new Date(),
        title,
        similarProjects: res.data.similarProjects || [],
      })
      if (res.data.isUnique) {
        toast.success('Your project appears unique!')
      } else {
        toast.warning(`${res.data.similarProjects.length} similar project(s) found`)
      }
    } catch { toast.error('Failed to check similarity') }
    setCheckingSimilarity(false)
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

  const openGroupDialog = async () => {
    setGroupForm({ name:'', academicYear:'2025-26', semester: studentProfile?.year === 'TY' ? 5 : studentProfile?.year === 'FINAL' ? 7 : studentProfile?.year === 'SY' ? 3 : 1 })
    setShowGroupDialog(true)
  }

  const handleCreateGroup = async () => {
    setGroupCreating(true)
    try {
      await api.post('/groups/student-create', {
        name: groupForm.name,
        academicYear: groupForm.academicYear,
        semester: groupForm.semester,
      })
      toast.success('Group created! Now invite your classmates.')
      setShowGroupDialog(false)
      await fetchData()
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to create group'
      toast.error(msg)
    }
    setGroupCreating(false)
  }

  const openInviteDialog = async () => {
    try {
      const res = await api.get('/groups/classmates')
      setClassmates(res.data)
    } catch { setClassmates([]) }
    setClassmateSearch('')
    setInviteIds([])
    setShowInviteDialog(true)
  }

  const handleSendInvites = async () => {
    if (!group || inviteIds.length === 0) return
    setInviting(true)
    try {
      await api.post(`/groups/${group.id}/invite`, { studentIds: inviteIds })
      toast.success(`Invitations sent to ${inviteIds.length} classmate(s)`)
      setShowInviteDialog(false)
      await fetchData()
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to send invitations'
      toast.error(msg)
    }
    setInviting(false)
  }

  const toggleInvite = (id: string) => {
    setInviteIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])
  }

  const filteredClassmates = classmates.filter(c => {
    const q = classmateSearch.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.prnNo.toLowerCase().includes(q) || c.enrollmentNo.toLowerCase().includes(q)
  })

  const handleRespondInvitation = async (invId: string, accept: boolean) => {
    setRespondingInvId(invId)
    try {
      await api.post(`/groups/invitations/${invId}/respond`, { accept })
      toast.success(accept ? 'Invitation accepted! You joined the group.' : 'Invitation declined.')
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to respond')
    }
    setRespondingInvId('')
  }

  const handleSubmitForApproval = async () => {
    if (!group) return
    setActionLoading('submitGroup')
    try {
      await api.post(`/groups/${group.id}/submit-for-approval`)
      toast.success('Group submitted for coordinator approval!')
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit')
    }
    setActionLoading('')
  }

  const handleLeaveGroup = async () => {
    if (!group) return
    setActionLoading('leave')
    try {
      await api.delete(`/groups/${group.id}/leave`)
      toast.success('You left the group')
      await fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to leave group')
    }
    setActionLoading('')
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
  const groupStatus = group?.status ?? null
  const isApproved = groupStatus === 'APPROVED'
  const isForming = groupStatus === 'FORMING'
  const isPendingApproval = groupStatus === 'PENDING_APPROVAL'
  const pendingInvites = group?.invitations?.filter(i => i.status === 'PENDING') ?? []
  const acceptedInvites = group?.invitations?.filter(i => i.status === 'ACCEPTED') ?? []
  const maxInvitable = 5 - (group?.members?.length ?? 0) - pendingInvites.length

  const GROUP_STATUS_LABELS: Record<string, string> = {
    FORMING: 'Forming', PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved',
  }
  const GROUP_STATUS_COLORS: Record<string, string> = {
    FORMING: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    PENDING_APPROVAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  }

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
          {label:'My Group',value:group?.name??'Not Assigned', badge: groupStatus ? { text: GROUP_STATUS_LABELS[groupStatus], cls: GROUP_STATUS_COLORS[groupStatus] } : null },
          {label:'Project Status',statusBadge: isApproved ? project?.status : undefined, value: !isApproved && group ? (isPendingApproval ? 'Awaiting Approval' : 'Group Forming') : undefined},
          {label:'Guide',value:guide?.name??'Not Assigned'},
          {label:'Semester',value:group ? `${group.semester} · ${group.academicYear}` : '—'},
        ].map(card=>(
          <div key={card.label} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 hover:bg-[#1A2540] transition-all duration-200">
            <p className="text-[#7A8BAF] text-sm mb-1">{card.label}</p>
            {card.statusBadge ? <StatusBadge status={card.statusBadge}/> : card.badge ? (
              <div className="flex items-center gap-2">
                <p className="text-[#EEF2FF] text-xl font-bold font-['Sora']">{card.value}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${card.badge.cls}`}>{card.badge.text}</span>
              </div>
            ) : <p className="text-[#EEF2FF] text-2xl font-bold font-['Sora']">{card.value}</p>}
          </div>
        ))}
      </motion.div>

      {/* Main content: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT col-span-2 */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── STATE: No Group ── */}
          {!group && (
            <>
              <motion.div variants={item} className="bg-[#0F1729] border border-amber-500/30 rounded-2xl p-6">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="w-12 h-12 text-amber-500/50 mb-4"/>
                  <h3 className="text-[#EEF2FF] text-lg font-semibold font-['Sora'] mb-1">You&apos;re not in a group yet</h3>
                  <p className="text-[#7A8BAF] text-sm mb-4 max-w-sm">Create a group and invite classmates from your division. Once your team is ready, submit for coordinator approval.</p>
                  <button onClick={openGroupDialog} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 inline-flex items-center gap-2 text-sm"><Plus size={16}/> Create Group</button>
                </div>
              </motion.div>

              {/* Pending Invitations from other groups */}
              {pendingInvitations.length > 0 && (
                <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Mail size={16} className="text-amber-400"/>
                    <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Group Invitations</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{pendingInvitations.length}</span>
                  </div>
                  <div className="space-y-3">
                    {pendingInvitations.map(inv => (
                      <div key={inv.id} className="bg-[#1A2540] border border-[#2A3A5C] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-semibold text-[#EEF2FF]">{inv.group.name}</h4>
                            <p className="text-xs text-[#7A8BAF]">{inv.group.year} · Div {inv.group.division} · {inv.group.academicYear}</p>
                          </div>
                          <span className="text-xs text-[#4A5B7A]">{inv.group.membersCount} member(s)</span>
                        </div>
                        {inv.group.leader && <p className="text-xs text-[#7A8BAF] mb-3">Invited by <span className="text-amber-400">{inv.group.leader.name}</span></p>}
                        <div className="flex gap-2">
                          <button onClick={() => handleRespondInvitation(inv.id, true)} disabled={respondingInvId === inv.id}
                            className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                            {respondingInvId === inv.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} Accept
                          </button>
                          <button onClick={() => handleRespondInvitation(inv.id, false)} disabled={respondingInvId === inv.id}
                            className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                            {respondingInvId === inv.id ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>} Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* ── STATE: FORMING (leader) ── */}
          {group && isForming && isLeader && (
            <motion.div variants={item} className="bg-[#0F1729] border border-cyan-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Group Formation</h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GROUP_STATUS_COLORS.FORMING}`}>Forming</span>
                </div>
                <button onClick={openInviteDialog} disabled={maxInvitable <= 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-medium transition-all disabled:opacity-40">
                  <Send size={12}/> Invite Classmates
                </button>
              </div>

              {/* Current Members */}
              <div className="mb-4">
                <p className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Members ({group.members?.length ?? 0}/5)</p>
                <div className="space-y-2">
                  {group.members?.map(m => {
                    const s = m.student as unknown as {id:string;name:string;prnNo?:string;studentProfile?:{prnNo?:string}}
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2 px-3 bg-[#1A2540] rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">{s?.name?.[0]?.toUpperCase()}</div>
                        <span className="text-sm text-[#EEF2FF] flex-1">{s?.name}</span>
                        {m.isLeader && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">👑 Leader</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Pending Invitations Sent */}
              {pendingInvites.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Pending Invitations</p>
                  <div className="space-y-1">
                    {pendingInvites.map(inv => (
                      <div key={inv.id} className="flex items-center gap-3 py-2 px-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                        <Clock size={14} className="text-amber-400"/>
                        <span className="text-sm text-[#EEF2FF] flex-1">{inv.student.name}</span>
                        <span className="text-[10px] text-amber-400">Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="border-t border-[#2A3A5C] pt-4 mt-4">
                {(group.members?.length ?? 0) < 3 ? (
                  <p className="text-xs text-[#7A8BAF]">Need at least <span className="text-amber-400">3 members</span> to submit for approval (currently {group.members?.length ?? 0})</p>
                ) : (
                  <button onClick={handleSubmitForApproval} disabled={actionLoading === 'submitGroup'}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {actionLoading === 'submitGroup' ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                    Submit for Coordinator Approval
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STATE: FORMING (member, not leader) ── */}
          {group && isForming && !isLeader && (
            <motion.div variants={item} className="bg-[#0F1729] border border-cyan-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Group Formation</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GROUP_STATUS_COLORS.FORMING}`}>Forming</span>
              </div>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 mb-4">
                <p className="text-sm text-cyan-400">Waiting for the group leader to invite more members and submit for approval.</p>
              </div>
              <div className="mb-4">
                <p className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Members ({group.members?.length ?? 0})</p>
                <div className="space-y-2">
                  {group.members?.map(m => {
                    const s = m.student as unknown as {id:string;name:string;prnNo?:string;studentProfile?:{prnNo?:string}}
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2 px-3 bg-[#1A2540] rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">{s?.name?.[0]?.toUpperCase()}</div>
                        <span className="text-sm text-[#EEF2FF] flex-1">{s?.name}</span>
                        {m.isLeader && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">👑 Leader</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <button onClick={handleLeaveGroup} disabled={actionLoading === 'leave'}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-all disabled:opacity-60">
                {actionLoading === 'leave' ? <Loader2 size={12} className="animate-spin"/> : <LogOut size={12}/>} Leave Group
              </button>
            </motion.div>
          )}

          {/* ── STATE: PENDING_APPROVAL ── */}
          {group && isPendingApproval && (
            <motion.div variants={item} className="bg-[#0F1729] border border-amber-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Awaiting Approval</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GROUP_STATUS_COLORS.PENDING_APPROVAL}`}>Pending</span>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1"><Clock size={14}/> Submitted for Coordinator Approval</div>
                <p className="text-xs text-[#7A8BAF]">Your coordinator will review and approve the group. Once approved, you can create your project.</p>
              </div>
              <p className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Members ({group.members?.length ?? 0})</p>
              <div className="space-y-2">
                {group.members?.map(m => {
                  const s = m.student as unknown as {id:string;name:string;prnNo?:string;studentProfile?:{prnNo?:string}}
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2 px-3 bg-[#1A2540] rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">{s?.name?.[0]?.toUpperCase()}</div>
                      <span className="text-sm text-[#EEF2FF] flex-1">{s?.name}</span>
                      {m.isLeader && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">👑 Leader</span>}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ── STATE: APPROVED — Project card ── */}
          {isApproved && (<>
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
                  <button onClick={handleCheckSimilarity} disabled={checkingSimilarity} className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-all duration-200 inline-flex items-center gap-2 text-sm disabled:opacity-60">{checkingSimilarity?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>} Check Uniqueness</button>
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
                {(project.status==='SUBMITTED'||project.status==='UNDER_REVIEW'||project.status==='APPROVED'||project.status==='COMPLETED') && isLeader && (
                  <button onClick={openEditDialog} className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm">Edit Project</button>
                )}
                {project.status==='APPROVED' && <div className="w-full bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-sm">Project Approved! 🎉</div>}
                {project.status==='PUBLISHED' && <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center justify-between">
                  <span>Project Published to Showcase! 🌟</span>
                  <a href="/dashboard/showcase" className="underline text-xs hover:text-emerald-300">View in Showcase</a>
                </div>}
              </div>

              {/* Similarity Report */}
              {similarityResult && (
                <div className={`mt-4 rounded-xl p-4 border ${similarityResult.isUnique ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {similarityResult.isUnique ? (
                        <><CheckCircle2 size={18} className="text-emerald-400"/><span className="text-emerald-400 font-medium">Project Appears Unique</span></>
                      ) : (
                        <><AlertTriangle size={18} className="text-amber-400"/><span className="text-amber-400 font-medium">{similarityResult.similarProjects.length} Similar Project{similarityResult.similarProjects.length>1?'s':''} Found</span></>
                      )}
                    </div>
                    <button onClick={()=>setSimilarityResult(null)} className="text-[#4A5B7A] hover:text-[#7A8BAF]"><X size={14}/></button>
                  </div>
                  
                  {similarityResult.isUnique ? (
                    <div className="bg-[#1A2540] border border-[#2A3A5C] rounded-lg p-4">
                      <p className="text-sm text-[#EEF2FF] mb-2">Great news! No similar projects were found in the database.</p>
                      <div className="text-xs text-[#7A8BAF] space-y-1">
                        <p>✓ Checked against all existing projects</p>
                        <p>✓ Title and abstract analyzed using TF-IDF similarity</p>
                        <p>✓ Domain matching considered</p>
                      </div>
                      <p className="text-xs text-[#4A5B7A] mt-3">Checked: {similarityResult.checkedAt.toLocaleString()}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-amber-300/80">Your project has similarities with existing submissions. Review below and consider differentiating your approach:</p>
                      {similarityResult.similarProjects.map((sp) => (
                        <div key={sp.id} className="bg-[#1A2540] border border-[#2A3A5C] rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm text-[#EEF2FF] font-medium">{sp.title}</p>
                              <p className="text-xs text-[#4A5B7A] mt-0.5">
                                {sp.groupName && <span>Group: {sp.groupName}</span>}
                                {sp.domain && <span className="ml-2">• {sp.domain}</span>}
                              </p>
                            </div>
                            <span className={`shrink-0 text-xs font-mono px-2 py-1 rounded-full border ${sp.similarity >= 70 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {sp.similarity}% match
                            </span>
                          </div>
                          {/* Abstract excerpt */}
                          {sp.abstract && (
                            <div className="bg-[#0F1729] rounded-lg p-2">
                              <p className="text-xs text-[#4A5B7A] mb-1">Abstract:</p>
                              <p className="text-xs text-[#7A8BAF] line-clamp-3">{sp.abstract}</p>
                            </div>
                          )}
                          {/* Detailed similarity breakdown */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            {sp.titleSimilarity !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[#4A5B7A]">Title:</span>
                                <div className="w-16 h-1.5 bg-[#0F1729] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${sp.titleSimilarity >= 70 ? 'bg-red-400' : sp.titleSimilarity >= 40 ? 'bg-amber-400' : 'bg-green-400'}`} style={{width: `${sp.titleSimilarity}%`}}/>
                                </div>
                                <span className={sp.titleSimilarity >= 70 ? 'text-red-400' : sp.titleSimilarity >= 40 ? 'text-amber-400' : 'text-green-400'}>{sp.titleSimilarity}%</span>
                              </div>
                            )}
                            {sp.abstractSimilarity !== undefined && (
                              <div className="flex items-center gap-1.5">
                              <span className="text-[#4A5B7A]">Abstract:</span>
                              <div className="w-16 h-1.5 bg-[#0F1729] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${sp.abstractSimilarity >= 70 ? 'bg-red-400' : sp.abstractSimilarity >= 40 ? 'bg-amber-400' : 'bg-green-400'}`} style={{width: `${sp.abstractSimilarity}%`}}/>
                              </div>
                              <span className={sp.abstractSimilarity >= 70 ? 'text-red-400' : sp.abstractSimilarity >= 40 ? 'text-amber-400' : 'text-green-400'}>{sp.abstractSimilarity}%</span>
                            </div>
                          )}
                        </div>
                        {sp.commonTerms && sp.commonTerms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[#4A5B7A] text-xs">Overlapping terms:</span>
                              {sp.commonTerms.map((term: string, i: number)=>(
                                <span key={i} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">{term}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-[#4A5B7A] mt-2">Tip: Differentiate by focusing on a unique problem statement, different technology stack, or novel approach.</p>
                    </div>
                  )}
                </div>
              )}
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
          </>)} {/* end isApproved */}
        </div>

        {/* RIGHT col-span-1 */}
        <div className="space-y-6">
          {/* Timeline */}
          <motion.div variants={item} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
            <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">Project Progress</h3>
            <div className="flex flex-col">
              {STATUS_STEPS.map((step,idx)=>{
                const effectiveStatus = project?.status === 'REJECTED' ? 'SUBMITTED' : project?.status
                const curIdx = STATUS_STEPS.indexOf(effectiveStatus as typeof STATUS_STEPS[number])
                const isCompleted = project ? idx < curIdx : false
                const isCurrent = step === effectiveStatus
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
            <button onClick={handleCheckSimilarity} disabled={!createForm.title||checkingSimilarity} className="w-full mt-4 py-2 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">{checkingSimilarity?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>} Check Uniqueness</button>
            {similarityResult && (
              <div className={`mt-3 rounded-xl p-3 border ${similarityResult.isUnique ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                {similarityResult.isUnique ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400"/>
                    <span className="text-emerald-400 text-xs font-medium">Your project appears unique!</span>
                    <button onClick={()=>setSimilarityResult(null)} className="ml-auto text-[#4A5B7A] hover:text-[#7A8BAF]"><X size={12}/></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-amber-400 text-xs font-medium flex items-center gap-1"><AlertTriangle size={12}/>{similarityResult.similarProjects.length} similar project(s) found</p>
                      <button onClick={()=>setSimilarityResult(null)} className="text-[#4A5B7A] hover:text-[#7A8BAF]"><X size={12}/></button>
                    </div>
                    {similarityResult.similarProjects.map(sp=>(
                      <div key={sp.id} className="bg-[#1A2540] border border-[#2A3A5C] rounded-lg p-2 mb-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-[#EEF2FF] truncate flex-1">{sp.title}{sp.groupName?` (${sp.groupName})`:''}</p>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ml-2 ${sp.similarity>=70?'text-red-400 bg-red-500/10':'text-amber-400 bg-amber-500/10'}`}>{sp.similarity}%</span>
                        </div>
                        {sp.abstract && <p className="text-[10px] text-[#4A5B7A] mt-1 line-clamp-2">{sp.abstract}</p>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            <button onClick={showEditDialog?handleEditProject:handleCreateProject} disabled={!createForm.title||submitting} className="w-full mt-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">{submitting?<Loader2 size={14} className="animate-spin"/>:<Plus size={14}/>}{showEditDialog?'Update Project':'Create Project'}</button>
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

      {/* Group Creation Dialog — just name, AY, semester */}
      {showGroupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowGroupDialog(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Sora'] text-lg font-semibold text-[#EEF2FF]">Create Group</h3>
              <button onClick={() => setShowGroupDialog(false)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#7A8BAF] mb-1.5">Group Name *</label>
                <input type="text" value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. CSE-TY-A-G1" className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Academic Year *</label>
                  <input type="text" value={groupForm.academicYear} onChange={e => setGroupForm(p => ({ ...p, academicYear: e.target.value }))} placeholder="2025-26" className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[#7A8BAF] mb-1.5">Semester *</label>
                  <input type="number" min={1} max={8} value={groupForm.semester} onChange={e => setGroupForm(p => ({ ...p, semester: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
              <div className="bg-[#1A2540] border border-[#2A3A5C] rounded-xl p-3">
                <p className="text-xs text-amber-400 flex items-center gap-1.5"><Crown size={12} /> You will be the group leader</p>
                <p className="text-xs text-[#4A5B7A] mt-1">After creating, invite classmates to join your group.</p>
              </div>
            </div>
            <button onClick={handleCreateGroup} disabled={!groupForm.name || !groupForm.academicYear || groupCreating} className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {groupCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Group
            </button>
          </motion.div>
        </div>
      )}

      {/* Invite Classmates Dialog */}
      {showInviteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowInviteDialog(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Sora'] text-lg font-semibold text-[#EEF2FF]">Invite Classmates</h3>
              <button onClick={() => setShowInviteDialog(false)} className="text-[#4A5B7A] hover:text-[#EEF2FF] transition-colors"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-[#1A2540] border border-[#2A3A5C] rounded-xl p-3">
                <p className="text-xs text-[#7A8BAF]">Select classmates to send group invitations. They must accept before joining your group.</p>
                <p className="text-xs text-[#4A5B7A] mt-1">You can invite up to {maxInvitable} more classmate(s)</p>
              </div>
              <div>
                <label className="block text-xs text-[#7A8BAF] mb-1.5">Search Classmates <span className="text-[#4A5B7A]">({inviteIds.length} selected)</span></label>
                <input type="text" value={classmateSearch} onChange={e => setClassmateSearch(e.target.value)} placeholder="Search by name or PRN..." className="w-full px-3 py-2 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none mb-2" />
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredClassmates.map(c => {
                    const sel = inviteIds.includes(c.id)
                    return (
                      <button key={c.id} onClick={() => toggleInvite(c.id)} disabled={!sel && inviteIds.length >= maxInvitable}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-all ${sel ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400' : 'hover:bg-[#1A2540] text-[#EEF2FF] border border-transparent'} disabled:opacity-40`}>
                        <span>{c.name}</span>
                        <span className="font-mono text-xs text-[#4A5B7A]">{c.prnNo}</span>
                      </button>
                    )
                  })}
                  {filteredClassmates.length === 0 && <p className="text-xs text-[#4A5B7A] text-center py-3">No available classmates found</p>}
                </div>
              </div>
            </div>
            <button onClick={handleSendInvites} disabled={inviteIds.length === 0 || inviting} className="w-full mt-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send {inviteIds.length} Invitation{inviteIds.length !== 1 ? 's' : ''}
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
