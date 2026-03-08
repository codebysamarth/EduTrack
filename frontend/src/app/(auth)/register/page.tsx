'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import type { Department, Year } from '@/types'

const YEARS: { value: Year; label: string }[] = [
  { value: 'FY', label: 'First Year' },
  { value: 'SY', label: 'Second Year' },
  { value: 'TY', label: 'Third Year' },
  { value: 'FINAL', label: 'Final Year' },
]

export default function RegisterPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    prnNo: '',
    enrollmentNo: '',
    password: '',
    departmentId: '',
    year: '' as Year | '',
    division: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data))
  }, [])

  const passwordStrength = (() => {
    const p = form.password
    if (p.length === 0) return { level: 0, label: '', color: '' }
    if (p.length < 6) return { level: 1, label: 'Weak', color: 'bg-red-500' }
    const hasUpper = /[A-Z]/.test(p)
    const hasNumber = /[0-9]/.test(p)
    const hasSpecial = /[^A-Za-z0-9]/.test(p)
    const score = [p.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' }
    if (score === 2) return { level: 2, label: 'Fair', color: 'bg-amber-500' }
    if (score === 3) return { level: 3, label: 'Good', color: 'bg-blue-500' }
    return { level: 4, label: 'Strong', color: 'bg-green-500' }
  })()

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    if (form.password.length < 6) {
      setFieldErrors({ password: 'Password must be at least 6 characters' })
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: '',
        prnNo: form.prnNo,
        enrollmentNo: form.enrollmentNo,
        departmentId: form.departmentId,
        year: form.year,
        division: form.division,
      })
      setSuccess(true)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; errors?: Array<{ path: string; msg: string }> } } })?.response?.data
      if (data?.errors) {
        const fe: Record<string, string> = {}
        data.errors.forEach((e: { path: string; msg: string }) => {
          fe[e.path] = e.msg
        })
        setFieldErrors(fe)
      } else {
        setError(data?.error ?? 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080D1A] px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-8 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-amber-500" size={32} />
          </div>
          <h2 className="font-[var(--font-sora)] text-2xl font-semibold text-[#EEF2FF] mb-2">
            Registration Successful!
          </h2>
          <p className="text-[#7A8BAF] mb-6">
            Your student account has been created. You can now sign in.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 text-center"
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    )
  }

  const inputCls =
    'w-full px-4 py-3 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-[#EEF2FF] placeholder-[#4A5B7A] focus:border-amber-500 focus:outline-none transition-all duration-200'
  const labelCls = 'block text-sm text-[#7A8BAF] mb-1.5'
  const errorCls = 'text-red-400 text-xs mt-1'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080D1A] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-8">
          <h2 className="font-[var(--font-sora)] text-2xl font-semibold text-[#EEF2FF] mb-1">
            Student Registration
          </h2>
          <p className="text-[#7A8BAF] text-sm mb-8">
            Create your account to get started
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={set('name')}
                placeholder="John Doe"
                className={inputCls}
              />
              {fieldErrors.name && <p className={errorCls}>{fieldErrors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                placeholder="student@college.com"
                className={inputCls}
              />
              {fieldErrors.email && <p className={errorCls}>{fieldErrors.email}</p>}
            </div>

            {/* PRN */}
            <div>
              <label className={labelCls}>PRN Number</label>
              <input
                type="text"
                required
                value={form.prnNo}
                onChange={set('prnNo')}
                placeholder="72212001"
                className={`${inputCls} font-mono`}
              />
              <p className="text-[#4A5B7A] text-xs mt-1">
                Your Permanent Registration Number from college
              </p>
              {fieldErrors.prnNo && <p className={errorCls}>{fieldErrors.prnNo}</p>}
            </div>

            {/* Enrollment No */}
            <div>
              <label className={labelCls}>Enrollment Number</label>
              <input
                type="text"
                required
                value={form.enrollmentNo}
                onChange={set('enrollmentNo')}
                placeholder="ENR2024001"
                className={`${inputCls} font-mono`}
              />
              {fieldErrors.enrollmentNo && <p className={errorCls}>{fieldErrors.enrollmentNo}</p>}
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min 6 characters"
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5B7A] hover:text-[#7A8BAF] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1 rounded-full bg-[#1A2540] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.level / 4) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#7A8BAF]">{passwordStrength.label}</span>
                </div>
              )}
              {fieldErrors.password && <p className={errorCls}>{fieldErrors.password}</p>}
            </div>

            {/* Department */}
            <div>
              <label className={labelCls}>Department</label>
              <select
                required
                value={form.departmentId}
                onChange={set('departmentId')}
                className={inputCls}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              {fieldErrors.departmentId && <p className={errorCls}>{fieldErrors.departmentId}</p>}
            </div>

            {/* Year */}
            <div>
              <label className={labelCls}>Year</label>
              <select required value={form.year} onChange={set('year')} className={inputCls}>
                <option value="">Select year</option>
                {YEARS.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
              {fieldErrors.year && <p className={errorCls}>{fieldErrors.year}</p>}
            </div>

            {/* Division */}
            <div>
              <label className={labelCls}>Division</label>
              <input
                type="text"
                required
                value={form.division}
                onChange={set('division')}
                placeholder="A"
                className={inputCls}
              />
              {fieldErrors.division && <p className={errorCls}>{fieldErrors.division}</p>}
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-[#7A8BAF]">
          Already have an account?{' '}
          <Link href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
