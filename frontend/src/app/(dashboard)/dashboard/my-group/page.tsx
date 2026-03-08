'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, Crown, BookOpen, Calendar, Building2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Group } from '@/types'

function PrnBadge({ prn }: { prn: string }) {
  return (
    <span className="font-mono text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 tracking-wider">
      {prn}
    </span>
  )
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function MyGroupPage() {
  const { roles } = useAuth()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roles.includes('STUDENT')) router.replace('/dashboard')
  }, [roles, router])

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/groups')
        if (res.data.length > 0) {
          const full = await api.get(`/groups/${res.data[0].id}`)
          setGroup(full.data)
        }
      } catch {}
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-[#1A2540] rounded-xl h-12 w-60" />
        <div className="animate-pulse bg-[#1A2540] rounded-xl h-48" />
        <div className="animate-pulse bg-[#1A2540] rounded-xl h-32" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[#1A2540] rounded-xl h-40" />
          ))}
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="w-12 h-12 text-[#4A5B7A] mb-4" />
        <p className="text-[#7A8BAF] text-lg">
          You have not been assigned to a group yet.
        </p>
        <p className="text-[#4A5B7A] text-sm mt-1">
          Please contact your coordinator.
        </p>
      </div>
    )
  }

  const guide = group.guide as unknown as {
    name?: string
    prnNo?: string
    facultyProfile?: { prnNo?: string; designation?: string }
  } | undefined
  const guidePrn = guide?.prnNo ?? guide?.facultyProfile?.prnNo
  const members = group.members ?? []

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="font-['Sora'] text-2xl font-bold text-[#EEF2FF]">
          My Group
        </h1>
      </motion.div>

      {/* Group Info Card */}
      <motion.div
        variants={item}
        className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-['Sora'] text-2xl font-bold text-[#EEF2FF]">
              {group.name}
            </h2>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {group.year}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">
                Div {group.division}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">
                Sem {group.semester}
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">
                {group.academicYear}
              </span>
            </div>
            {group.department && (
              <p className="text-[#7A8BAF] text-sm mt-3">
                {group.department.name}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end justify-center">
            {group.department && (
              <span className="font-['Sora'] text-3xl font-bold text-amber-500/30">
                {group.department.code}
              </span>
            )}
            <span className="text-xs text-[#4A5B7A] mt-2">
              Created {new Date(group.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Guide Card */}
      {guide && (
        <motion.div
          variants={item}
          className="bg-[#0F1729] border border-[#2A3A5C] border-l-4 border-l-green-500 rounded-2xl p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-lg font-semibold shrink-0">
              {guide.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
                Project Guide
              </span>
              <h3 className="font-['Sora'] font-semibold text-lg text-[#EEF2FF] mt-1">
                {guide.name}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                {guidePrn && <PrnBadge prn={guidePrn} />}
                {guide.facultyProfile?.designation && (
                  <span className="text-sm text-[#7A8BAF]">
                    {guide.facultyProfile.designation}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Members Section */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-['Sora'] text-lg font-semibold text-[#EEF2FF]">
            Group Members
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C]">
            {members.length} members
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((m) => {
            const s = m.student as unknown as {
              id: string
              name: string
              prnNo?: string
              studentProfile?: {
                prnNo?: string
                enrollmentNo?: string
                year?: string
                division?: string
              }
            }
            const memberPrn = s?.prnNo ?? s?.studentProfile?.prnNo
            return (
              <div
                key={m.id}
                className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-4 relative"
              >
                {m.isLeader && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <span className="text-sm">👑</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Leader
                    </span>
                  </div>
                )}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                    m.isLeader
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-[#1A2540] text-[#EEF2FF]'
                  }`}
                >
                  {s?.name?.[0]?.toUpperCase()}
                </div>
                <h4 className="font-['Sora'] font-semibold text-[#EEF2FF] mt-3">
                  {s?.name}
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <span className="text-[#4A5B7A] block mb-0.5">PRN</span>
                    {memberPrn && <PrnBadge prn={memberPrn} />}
                  </div>
                  <div>
                    <span className="text-[#4A5B7A] block mb-0.5">
                      Enrollment No
                    </span>
                    <span className="font-mono text-[#7A8BAF]">
                      {s?.studentProfile?.enrollmentNo ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4A5B7A] block mb-0.5">Year</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block">
                      {s?.studentProfile?.year ?? group.year}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4A5B7A] block mb-0.5">Division</span>
                    <span className="text-[#7A8BAF]">
                      {s?.studentProfile?.division ?? group.division}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
