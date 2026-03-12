'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2, AlertTriangle, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const UPLOAD_TYPES = [
  { key: 'groups', label: 'Create Groups', description: 'Bulk create student groups with project titles and guide assignment', columns: 'GroupName, Year, Division, GuidePRN, ProjectTitle, PRN1, PRN2, PRN3, PRN4, PRN5' },
  { key: 'ff180', label: 'FF180 Status', description: 'Update FF180 form status for students by PRN', columns: 'PRN, FF180Status (PENDING | SUBMITTED | APPROVED)' },
  { key: 'drive-links', label: 'Drive Links', description: 'Update Google Drive links for projects by student PRN', columns: 'PRN, DriveLink' },
  { key: 'project-links', label: 'Project Links', description: 'Bulk update any project resource links (GitHub, Video, Drive, Paper, Patent)', columns: 'PRN, githubLink, videoLink, driveLink, researchPaperLink, patentLink' },
] as const

interface UploadResult {
  message: string
  updated?: number
  created?: number
  failed: { prn?: string; group?: string; reason: string }[]
  total: number
}

export default function BulkUploadPage() {
  const [selectedType, setSelectedType] = useState<string>('groups')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [showFailed, setShowFailed] = useState(false)

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/bulk-upload/template/${selectedType}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `template-${selectedType}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Template downloaded')
    } catch {
      toast.error('Failed to download template')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(`/bulk-upload/${selectedType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      if (res.data.updated > 0) toast.success(res.data.message)
      else toast.warning('No records were updated')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed'
      toast.error(msg)
    }
    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))) {
      setFile(f)
      setResult(null)
    } else {
      toast.error('Please upload an Excel file (.xlsx, .xls)')
    }
  }

  const currentType = UPLOAD_TYPES.find(t => t.key === selectedType)!

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-[var(--font-sora)] text-2xl font-bold text-[#EEF2FF]">Bulk Upload</h1>
        <p className="text-sm text-[#7A8BAF] mt-1">Upload Excel files to update student data in bulk</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {UPLOAD_TYPES.map(t => (
          <button key={t.key} onClick={() => { setSelectedType(t.key); setFile(null); setResult(null) }}
            className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
              selectedType === t.key
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-[#0F1729] border-[#2A3A5C] text-[#7A8BAF] hover:border-[#4A5B7A]'
            }`}>
            <FileSpreadsheet size={18} className="mb-2" />
            <h3 className="font-semibold text-sm">{t.label}</h3>
            <p className="text-xs mt-1 opacity-70">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Upload card */}
      <div className="bg-[#0F1729] border border-[#2A3A5C] rounded-2xl p-6">
        {/* Expected columns */}
        <div className="mb-4">
          <h3 className="text-xs text-[#4A5B7A] uppercase tracking-wider mb-2">Expected Columns</h3>
          <code className="text-xs text-amber-400 bg-[#1A2540] px-3 py-1.5 rounded-xl border border-[#2A3A5C] inline-block">
            {currentType.columns}
          </code>
        </div>

        {/* Download template */}
        <button onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 border border-[#2A3A5C] text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] rounded-xl text-sm transition-all duration-200 mb-5">
          <Download size={14} /> Download Template
        </button>

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
            file ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#2A3A5C] hover:border-[#4A5B7A]'
          }`}>
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet size={32} className="text-amber-400" />
              <p className="text-sm text-[#EEF2FF] font-medium">{file.name}</p>
              <p className="text-xs text-[#7A8BAF]">{(file.size / 1024).toFixed(1)} KB</p>
              <button onClick={() => { setFile(null); setResult(null) }} className="text-xs text-red-400 hover:text-red-300 mt-1">Remove</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={32} className="text-[#4A5B7A]" />
              <p className="text-sm text-[#7A8BAF]">Drag & drop an Excel file here, or</p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all duration-200">
                <Upload size={14} /> Browse File
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setFile(f); setResult(null) }
                }} />
              </label>
              <p className="text-xs text-[#4A5B7A] mt-1">Accepted: .xlsx, .xls</p>
            </div>
          )}
        </div>

        {/* Upload button */}
        {file && !result && (
          <button onClick={handleUpload} disabled={uploading}
            className="mt-4 w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200">
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Upload size={16} /> Upload & Process</>}
          </button>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
              {/* Summary */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                result.failed.length === 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : (result.updated || result.created || 0) > 0
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {result.failed.length === 0 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                <div>
                  <p className="text-sm font-medium">{result.message}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {result.created !== undefined ? `${result.created} created` : `${result.updated} updated`} · {result.failed.length} failed · {result.total} total
                  </p>
                </div>
              </div>

              {/* Failed rows */}
              {result.failed.length > 0 && (
                <div>
                  <button onClick={() => setShowFailed(!showFailed)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    {showFailed ? <X size={12} /> : <AlertTriangle size={12} />}
                    {showFailed ? 'Hide' : 'Show'} {result.failed.length} failed record{result.failed.length > 1 ? 's' : ''}
                  </button>
                  {showFailed && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {result.failed.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-[#1A2540] rounded-lg">
                          <XCircle size={12} className="text-red-400 shrink-0" />
                          <span className="text-xs text-[#EEF2FF] font-mono">{f.prn || f.group || '—'}</span>
                          <span className="text-xs text-[#7A8BAF]">—</span>
                          <span className="text-xs text-red-300">{f.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upload again */}
              <button onClick={() => { setFile(null); setResult(null) }}
                className="text-xs text-amber-400 hover:text-amber-300 underline">Upload another file</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
