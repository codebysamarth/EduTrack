'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/api'
import type { Department } from '@/types'

export default function FacultyRegisterPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    prnNo: '',
    password: '',
    departmentId: '',
    designation: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data))
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)
    try {
      await api.post('/auth/faculty-register', {
        name: form.name,
        email: form.email,
        password: form.password,
        prnNo: form.prnNo,
        departmentId: form.departmentId,
        designation: form.designation,
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
            Registration Submitted
          </h2>
          <p className="text-[#7A8BAF] mb-6">
            Your faculty account has been submitted for review. An administrator will approve your account shortly.
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
            Faculty Registration
          </h2>
          <p className="text-[#7A8BAF] text-sm mb-8">
            Register as faculty — admin approval required
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
                placeholder="Dr. Jane Doe"
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
                placeholder="faculty@college.com"
                className={inputCls}
              />
              {fieldErrors.email && <p className={errorCls}>{fieldErrors.email}</p>}
            </div>

            {/* PRN */}
            <div>
              <label className={labelCls}>Faculty PRN Number</label>
              <input
                type="text"
                required
                value={form.prnNo}
                onChange={set('prnNo')}
                placeholder="FAC2020001"
                className={`${inputCls} font-mono`}
              />
              <p className="text-[#4A5B7A] text-xs mt-1">
                Your college-issued PRN/Employee number
              </p>
              {fieldErrors.prnNo && <p className={errorCls}>{fieldErrors.prnNo}</p>}
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

            {/* Designation */}
            <div>
              <label className={labelCls}>Designation</label>
              <input
                type="text"
                required
                value={form.designation}
                onChange={set('designation')}
                placeholder="Assistant Professor"
                className={inputCls}
              />
              {fieldErrors.designation && <p className={errorCls}>{fieldErrors.designation}</p>}
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
                  Submitting…
                </>
              ) : (
                'Submit Registration'
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
