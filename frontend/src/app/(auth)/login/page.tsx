'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Sparkles, Target, Radio } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const userRoles = await login(identifier, password)
      if (userRoles.includes('ADMIN')) {
        router.push('/dashboard/admin')
      } else if (userRoles.includes('HOD')) {
        router.push('/dashboard/hod')
      } else if (userRoles.includes('COORDINATOR')) {
        router.push('/dashboard/coordinator')
      } else if (userRoles.includes('GUIDE')) {
        router.push('/dashboard/guide')
      } else if (userRoles.includes('STUDENT')) {
        router.push('/dashboard/student')
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'Login failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const pills = [
    { icon: Sparkles, label: 'AI-Powered' },
    { icon: Target, label: 'SDG Aligned' },
    { icon: Radio, label: 'Real-time Tracking' },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-[40%] flex-col justify-center px-12 xl:px-16 relative overflow-hidden"
        style={{
          background: '#080D1A',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
        }}
      >
        {/* Decorative geometric SVG */}
        <div className="absolute top-12 right-8 opacity-10">
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            <rect x="20" y="20" width="60" height="60" rx="8" stroke="#F5A623" strokeWidth="1.5" />
            <rect x="100" y="40" width="40" height="40" rx="6" stroke="#F5A623" strokeWidth="1" />
            <rect x="60" y="100" width="80" height="80" rx="10" stroke="#F5A623" strokeWidth="1.5" />
            <circle cx="160" cy="140" r="20" stroke="#F5A623" strokeWidth="1" />
            <line x1="30" y1="90" x2="90" y2="90" stroke="#F5A623" strokeWidth="0.5" />
            <line x1="140" y1="30" x2="140" y2="80" stroke="#F5A623" strokeWidth="0.5" />
          </svg>
        </div>

        <div className="absolute bottom-16 left-8 opacity-[0.07]">
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
            <path d="M10 80 L80 10 L150 80 L80 150Z" stroke="#F5A623" strokeWidth="1.5" />
            <path d="M40 80 L80 40 L120 80 L80 120Z" stroke="#F5A623" strokeWidth="1" />
            <circle cx="80" cy="80" r="10" stroke="#F5A623" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative z-10">
          <h1 className="font-[var(--font-sora)] text-5xl font-bold text-[#EEF2FF] tracking-tight">
            Edu<span className="text-amber-500">Track</span>
          </h1>
          <div className="w-16 h-1 bg-amber-500 rounded-full mt-4 mb-6" />
          <p className="text-xl text-[#7A8BAF] font-medium mb-10">
            Project Lifecycle Management
          </p>

          <div className="flex flex-wrap gap-3">
            {pills.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-400 text-sm border border-amber-500/20"
              >
                <Icon size={14} />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-12 text-sm text-[#4A5B7A] leading-relaxed max-w-xs">
            Manage your college projects from ideation to publication — with
            AI-powered insights, SDG alignment, and real-time collaboration.
          </p>
        </div>
      </motion.div>

      {/* Right Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1 flex items-center justify-center px-6 sm:px-12 bg-[#080D1A]"
      >
        <div className="w-full max-w-md">
          <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-8">
            <h2 className="font-[var(--font-sora)] text-2xl font-semibold text-[#EEF2FF] mb-2">
              Welcome back
            </h2>
            <p className="text-[#7A8BAF] text-sm mb-8">
              Sign in with your email or PRN number
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Identifier */}
              <div>
                <label className="block text-sm text-[#7A8BAF] mb-1.5">
                  Email or PRN Number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. student@college.com or 72212001"
                  className="w-full px-4 py-3 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-[#EEF2FF] placeholder-[#4A5B7A] focus:border-amber-500 focus:outline-none transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-[#7A8BAF] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-[#EEF2FF] placeholder-[#4A5B7A] focus:border-amber-500 focus:outline-none transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5B7A] hover:text-[#7A8BAF] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* Links below card */}
          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-[#7A8BAF]">
            <Link
              href="/register"
              className="hover:text-amber-400 transition-colors"
            >
              New student? Register
            </Link>
            <span className="text-[#2A3A5C]">|</span>
            <Link
              href="/faculty-register"
              className="hover:text-amber-400 transition-colors"
            >
              Faculty? Register here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
