'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lightbulb, Copy, ExternalLink, RotateCcw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const DOMAINS = [
  'Web Development', 'Internet of Things (IoT)', 'Artificial Intelligence / ML',
  'Blockchain & Web3', 'Mobile App Development', 'Embedded Systems',
  'Cybersecurity', 'Data Science & Analytics', 'Robotics & Automation',
  'Cloud Computing', 'Augmented / Virtual Reality', 'Other',
]
const SDG_GOALS: { n: number; name: string }[] = [
  { n: 1, name: 'No Poverty' }, { n: 2, name: 'Zero Hunger' },
  { n: 3, name: 'Good Health and Well-being' }, { n: 4, name: 'Quality Education' },
  { n: 5, name: 'Gender Equality' }, { n: 6, name: 'Clean Water and Sanitation' },
  { n: 7, name: 'Affordable and Clean Energy' }, { n: 8, name: 'Decent Work and Economic Growth' },
  { n: 9, name: 'Industry, Innovation and Infrastructure' }, { n: 10, name: 'Reduced Inequalities' },
  { n: 11, name: 'Sustainable Cities and Communities' }, { n: 12, name: 'Responsible Consumption and Production' },
  { n: 13, name: 'Climate Action' }, { n: 14, name: 'Life Below Water' },
  { n: 15, name: 'Life on Land' }, { n: 16, name: 'Peace, Justice and Strong Institutions' },
  { n: 17, name: 'Partnerships for the Goals' },
]
const POPULAR = ['AI/ML', 'IoT', 'Web Dev', 'Cybersecurity']

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

export default function ProjectIdeasPage() {
  const { roles } = useAuth()
  const router = useRouter()
  const [domain, setDomain] = useState('')
  const [sdg, setSdg] = useState('')
  const [extra, setExtra] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [template, setTemplate] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!roles.includes('STUDENT')) router.replace('/dashboard')
  }, [roles, router])

  const handleGenerate = () => {
    let t = `Generate 5 innovative engineering project ideas in the domain of ${domain}.\n\nRequirements for each project idea:\n- The project should be suitable for publishing in a research journal OR be patentable\n- Must be feasible for undergraduate engineering students to build in one semester\n- For each idea, provide:\n    • Project Title\n    • Problem Statement (2-3 sentences)\n    • Proposed Solution & Approach\n    • Tech Stack / Tools Required\n    • Short Abstract (50 words max)\n    • Why it is innovative or impactful`
    if (sdg) {
      const goal = SDG_GOALS.find(g => g.n === parseInt(sdg))
      if (goal) t += `\n- All ideas must align with UN Sustainable Development Goal ${goal.n}: ${goal.name}`
    }
    if (extra.trim()) t += `\n- Additional requirements: ${extra.trim()}`
    t += '\n\nFormat as a numbered list (1-5) with clear headings for each section.'
    setTemplate(t)
    setShowResult(true)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(template)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setDomain(''); setSdg(''); setExtra(''); setShowResult(false); setTemplate('')
  }

  const handlePopular = (chip: string) => {
    const map: Record<string, string> = {
      'AI/ML': 'Artificial Intelligence / ML',
      'IoT': 'Internet of Things (IoT)',
      'Web Dev': 'Web Development',
      'Cybersecurity': 'Cybersecurity',
    }
    setDomain(map[chip] ?? chip)
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3 mb-1">
          <Lightbulb className="w-8 h-8 text-amber-400" />
          <h1 className="font-['Sora'] text-2xl font-bold text-[#EEF2FF]">Project Idea Generator</h1>
        </div>
        <p className="text-[#7A8BAF] text-sm">Generate a ready-to-paste prompt for ChatGPT or Claude</p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">
          💡 This tool creates a prompt template — paste it into any AI chatbot
        </div>
      </motion.div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — Generator Form */}
        <motion.div variants={item} className="lg:col-span-3 bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-5">Configure Your Template</h3>
          <div className="space-y-5">
            {/* Domain */}
            <div>
              <label className="block text-sm text-[#7A8BAF] mb-1.5">Project Domain <span className="text-red-400">*</span></label>
              <select value={domain} onChange={e => setDomain(e.target.value)} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
                <option value="">Select your domain...</option>
                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {/* SDG */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-sm text-[#7A8BAF]">SDG Alignment</label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2540] text-[#4A5B7A] border border-[#2A3A5C]">Optional</span>
              </div>
              <p className="text-xs text-[#4A5B7A] mb-2">Aligning with a UN SDG goal can strengthen your project&apos;s impact</p>
              <select value={sdg} onChange={e => setSdg(e.target.value)} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none">
                <option value="">None (no SDG alignment)</option>
                {SDG_GOALS.map(g => <option key={g.n} value={g.n}>{g.n} — {g.name}</option>)}
              </select>
            </div>
            {/* Extra */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-sm text-[#7A8BAF]">Additional Requirements</label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2540] text-[#4A5B7A] border border-[#2A3A5C]">Optional</span>
              </div>
              <textarea value={extra} onChange={e => setExtra(e.target.value)} rows={3} className="w-full px-3 py-2.5 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] focus:border-amber-500 focus:outline-none resize-none" placeholder="e.g. must use IoT sensors, must be low-cost, must work offline..." />
            </div>
            {/* Generate button */}
            <button onClick={handleGenerate} disabled={!domain} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-3 rounded-xl transition-all duration-200 text-sm disabled:opacity-40">
              ✨ Generate Template
            </button>
          </div>
        </motion.div>

        {/* RIGHT — Tips */}
        <motion.div variants={item} className="lg:col-span-2 bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF] mb-4">How to use this</h3>
          <ol className="space-y-3 text-sm text-[#7A8BAF]">
            {['Select your domain and optional SDG goal', 'Click Generate Template', 'Copy the generated prompt', 'Paste into ChatGPT, Claude, or Gemini', 'Get 5+ innovative project ideas instantly'].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-6 pt-4 border-t border-[#2A3A5C]">
            <p className="text-xs text-[#4A5B7A] mb-2">Popular Domains This Semester</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map(p => (
                <button key={p} onClick={() => handlePopular(p)} className="text-xs px-3 py-1.5 rounded-full bg-[#1A2540] text-[#7A8BAF] border border-[#2A3A5C] hover:border-amber-500/30 hover:text-amber-400 transition-all">
                  {p}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Result Section */}
      {showResult && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-['Sora'] text-base font-semibold text-[#EEF2FF]">Generated Template</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Ready to Copy</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center gap-1.5 ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
                <Copy size={14} /> {copied ? '✓ Copied!' : 'Copy Template'}
              </button>
              <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-1.5">
                <ExternalLink size={14} /> Open ChatGPT
              </a>
              <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-1.5">
                <ExternalLink size={14} /> Open Claude
              </a>
            </div>
          </div>
          <div className="bg-[#080D1A] border-2 border-dashed border-amber-500/40 rounded-xl p-6 font-mono text-sm text-[#EEF2FF] whitespace-pre-wrap leading-relaxed">
            {template}
          </div>
          <div className="mt-4">
            <button onClick={handleReset} className="border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] px-4 py-2 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-1.5">
              <RotateCcw size={14} /> Generate New Template
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
