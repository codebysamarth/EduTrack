'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2, Trash2, History, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { aiApi } from '@/lib/aiApi'
import type { RoleName, User } from '@/types'

/* ─── Colour map ──────────────────────────────────────── */
const ROLE_COLORS: Record<RoleName, string> = {
  STUDENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  GUIDE: 'bg-green-500/20 text-green-400 border-green-500/30',
  COORDINATOR: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  HOD: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
}

/* ─── Types ───────────────────────────────────────────── */
interface ActionButton {
  label: string
  action: string
  style: string
  url?: string
}

interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isLoading?: boolean
  agentUsed?: string
  actionButtons?: ActionButton[]
  actionContext?: Record<string, unknown>
  isTemplate?: boolean
  actionsUsed?: boolean
  isSuccess?: boolean
  isError?: boolean
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  userRole: string
  user: User | null
}

/* ─── Helpers ─────────────────────────────────────────── */

function getButtonStyle(style: string) {
  switch (style) {
    case 'primary':
      return 'bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors'
    case 'success':
      return 'bg-green-500/20 text-green-400 border border-green-500/30 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-green-500/30'
    case 'danger':
      return 'bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-red-500/30'
    default: // ghost
      return 'border border-[#2A3A5C] text-[#7A8BAF] hover:border-amber-500/50 hover:text-amber-400 text-xs px-3 py-1.5 rounded-lg transition-colors'
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

/** Turn **text** into <strong>text</strong> */
function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-[#EEF2FF]">{part}</strong> : part,
  )
}

/* ─── Chat history types ──────────────────────────── */
const CHAT_HISTORY_KEY = 'edutrack_chat_history'
const MAX_SESSIONS = 20

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
}

function sessionTitle(msgs: ChatMessage[]): string {
  const first = msgs.find((m) => m.isUser)
  if (!first) return 'New Chat'
  const text = first.content.slice(0, 40)
  return text.length < first.content.length ? text + '…' : text
}

/* ─── Component ───────────────────────────────────────── */

export default function ChatPanel({ isOpen, onClose, userRole, user }: ChatPanelProps) {
  const role = (userRole as RoleName) || 'STUDENT'
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null) // messageId

  // Chat history
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Load sessions from localStorage on mount
  useEffect(() => {
    setSessions(loadSessions())
  }, [])

  // Save messages to active session whenever they change
  useEffect(() => {
    if (!activeSessionId || messages.length === 0) return
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages, title: sessionTitle(messages), updatedAt: new Date().toISOString() }
          : s,
      )
      saveSessions(updated)
      return updated
    })
  }, [messages, activeSessionId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  /* ─── Chat session helpers ─────────────────────── */
  const startNewChat = useCallback(() => {
    const id = uid()
    const session: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setSessions((prev) => {
      const next = [session, ...prev]
      saveSessions(next)
      return next
    })
    setActiveSessionId(id)
    setMessages([])
    setShowHistory(false)
  }, [])

  const loadSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id)
    setMessages(session.messages)
    setShowHistory(false)
  }, [])

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId)
      saveSessions(next)
      return next
    })
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
  }, [activeSessionId])

  /* ─── Send message ────────────────────────────── */
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    if (!text) setInput('')

    // Auto-create session if none active
    if (!activeSessionId) {
      const id = uid()
      const session: ChatSession = {
        id,
        title: msg.slice(0, 40),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setSessions((prev) => {
        const next = [session, ...prev]
        saveSessions(next)
        return next
      })
      setActiveSessionId(id)
    }

    const userMsg: ChatMessage = {
      id: uid(),
      content: msg,
      isUser: true,
      timestamp: new Date(),
    }

    const loadingMsg: ChatMessage = {
      id: uid(),
      content: '',
      isUser: false,
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setSending(true)

    try {
      const { data } = await aiApi.post('/chat', {
        message: msg,
        userRole: role,
        context: {
          userName: user?.name ?? '',
          userId: user?.id ?? '',
          userEmail: user?.email ?? '',
          departmentId:
            user?.facultyProfile?.departmentId ??
            user?.studentProfile?.departmentId ??
            '',
          year: user?.studentProfile?.year ?? '',
          division: user?.studentProfile?.division ?? '',
        },
      })

      const aiMsg: ChatMessage = {
        id: uid(),
        content: data.response,
        isUser: false,
        timestamp: new Date(),
        agentUsed: data.agentUsed,
        actionButtons: data.actionButtons,
        actionContext: data.actionContext,
        isTemplate: data.isTemplate,
      }

      setMessages((prev) => {
        const next = [...prev]
        // Remove the loading message (last one)
        const loadIdx = next.findIndex((m) => m.id === loadingMsg.id)
        if (loadIdx !== -1) next[loadIdx] = aiMsg
        return next
      })
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to reach AI backend'
      setMessages((prev) => {
        const next = [...prev]
        const loadIdx = next.findIndex((m) => m.id === loadingMsg.id)
        if (loadIdx !== -1)
          next[loadIdx] = {
            id: loadingMsg.id,
            content: `Could not get a response: ${errorMsg}`,
            isUser: false,
            timestamp: new Date(),
            isError: true,
          }
        return next
      })
    } finally {
      setSending(false)
    }
  }, [input, sending, role, activeSessionId, user])

  /* ─── Handle action button click ──────────────── */
  const handleAction = useCallback(
    async (btn: ActionButton, msgIndex: number) => {
      const msg = messages[msgIndex]
      if (!msg) return

      switch (btn.action) {
        case 'COPY':
        case 'COPY_TEXT': {
          const textToCopy =
            (msg.actionContext?.copyText as string) || msg.content
          await navigator.clipboard.writeText(textToCopy)
          toast.success('Copied to clipboard!')
          return
        }

        case 'OPEN_URL': {
          const urls = msg.actionContext?.urls as
            | Record<string, string>
            | undefined
          const url = btn.url || (urls && urls[btn.label])
          if (url) window.open(url, '_blank', 'noopener')
          return
        }

        case 'EDIT': {
          setEditingMessageIndex(msgIndex)
          setEditingContent(msg.content)
          return
        }

        case 'REGENERATE': {
          // Find the last user message before this AI message
          for (let i = msgIndex - 1; i >= 0; i--) {
            if (messages[i].isUser) {
              await sendMessage(messages[i].content)
              return
            }
          }
          return
        }

        case 'NAVIGATE': {
          router.push('/dashboard')
          return
        }

        case 'EXPORT': {
          router.push('/dashboard')
          return
        }

        case 'SEND_EMAIL':
        case 'POST_REVIEW': {
          setActionLoading(msg.id)
          try {
            const { data } = await aiApi.post('/action', {
              actionType: btn.action,
              agentUsed: msg.agentUsed ?? '',
              draftContent: msg.content,
              context: {
                ...(msg.actionContext ?? {}),
                token: localStorage.getItem('college_token'),
              },
            })

            // Mark actions as used
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.id ? { ...m, actionsUsed: true } : m,
              ),
            )

            // Add success bubble
            const successMsg: ChatMessage = {
              id: uid(),
              content: `✓ ${data.message}`,
              isUser: false,
              timestamp: new Date(),
              isSuccess: true,
            }
            setMessages((prev) => [...prev, successMsg])
          } catch (err: unknown) {
            const errorText =
              err instanceof Error ? err.message : 'Action failed'
            const errorMsg: ChatMessage = {
              id: uid(),
              content: `✗ Failed: ${errorText}`,
              isUser: false,
              timestamp: new Date(),
              isError: true,
            }
            setMessages((prev) => [...prev, errorMsg])
          } finally {
            setActionLoading(null)
          }
          return
        }
      }
    },
    [messages, router, sendMessage],
  )

  /* ─── Handle edit-mode send ───────────────────── */
  const handleEditSend = useCallback(async () => {
    if (editingMessageIndex === null) return
    const msg = messages[editingMessageIndex]
    if (!msg) return

    // Update message content, then trigger action
    setMessages((prev) =>
      prev.map((m, i) =>
        i === editingMessageIndex ? { ...m, content: editingContent } : m,
      ),
    )
    setEditingMessageIndex(null)
    setEditingContent('')
  }, [editingMessageIndex, editingContent, messages])

  /* ─── Render a single message bubble ──────────── */
  const renderMessage = (msg: ChatMessage, index: number) => {
    if (msg.isLoading) {
      return (
        <div key={msg.id} className="flex justify-start">
          <div className="bg-[#1A2540] border border-[#2A3A5C] rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
            <div className="flex items-center gap-2 text-[#7A8BAF] text-sm">
              <Loader2 size={14} className="animate-spin" />
              <span>Thinking…</span>
            </div>
          </div>
        </div>
      )
    }

    if (msg.isUser) {
      return (
        <div key={msg.id} className="flex justify-end">
          <div className="bg-amber-500/15 border border-amber-500/20 rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]">
            <p className="text-sm text-[#EEF2FF] whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      )
    }

    // ─── Edit mode ───
    if (editingMessageIndex === index) {
      return (
        <div key={msg.id} className="flex justify-start">
          <div className="max-w-[85%] w-full">
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              className="bg-[#1A2540] border border-amber-500/50 rounded-xl w-full text-sm text-[#EEF2FF] p-3 min-h-[120px] resize-y focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEditSend}
                className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setEditingMessageIndex(null); setEditingContent('') }}
                className="border border-[#2A3A5C] text-[#7A8BAF] hover:border-amber-500/50 hover:text-amber-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ─── Success bubble ───
    if (msg.isSuccess) {
      return (
        <div key={msg.id} className="flex justify-start">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
            <p className="text-sm text-green-400 whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      )
    }

    // ─── Error bubble ───
    if (msg.isError) {
      return (
        <div key={msg.id} className="flex justify-start">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
            <p className="text-sm text-red-400 whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      )
    }

    // ─── Determine special rendering ───
    const isEmailDraft =
      msg.agentUsed === 'email_agent' && msg.content.includes('Subject:')
    const isReviewDraft = msg.agentUsed === 'review_agent'
    const isTemplate = msg.isTemplate

    // Review: check approval vs rejection
    const isApproval =
      isReviewDraft && msg.actionContext?.isApproved !== false

    // Email: extract recipients info
    const recipientEmails = isEmailDraft
      ? ((msg.actionContext?.recipients as string[]) ?? [])
      : []
    const recipientNames = isEmailDraft
      ? ((msg.actionContext?.recipientNames as string[]) ?? [])
      : []
    const recipientScope = isEmailDraft
      ? ((msg.actionContext?.recipientScope as string) ?? '')
      : ''

    let bubbleClass =
      'bg-[#1A2540] border border-[#2A3A5C] rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]'

    if (isTemplate) {
      bubbleClass =
        'border border-dashed border-amber-500/40 bg-amber-500/5 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]'
    } else if (isReviewDraft) {
      bubbleClass = `bg-[#1A2540] border-l-4 ${
        isApproval ? 'border-amber-500' : 'border-red-500'
      } border border-[#2A3A5C] rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]`
    }

    return (
      <div key={msg.id} className="flex flex-col items-start">
        {/* Header for email drafts */}
        {isEmailDraft && (
          <div className="text-xs text-amber-400 mb-1 ml-1">
            📧 Email Draft
            {recipientEmails.length > 0 ? ` — ${recipientEmails.length} recipients` : ''}
            {recipientScope ? ` (${recipientScope.replace(/_/g, ' ').toLowerCase()})` : ''}
          </div>
        )}

        {/* Message bubble */}
        <div className={bubbleClass}>
          <div className="text-sm text-[#C5CEE0] whitespace-pre-wrap">
            {msg.content.split('\n').map((line, i) => (
              <span key={i}>
                {renderBold(line)}
                {i < msg.content.split('\n').length - 1 && <br />}
              </span>
            ))}
          </div>
        </div>

        {/* Recipient list for email drafts */}
        {isEmailDraft && recipientEmails.length > 0 && !msg.actionsUsed && (
          <div className="mt-2 ml-1 w-full max-w-[85%]">
            <details className="group">
              <summary className="text-[11px] text-[#7A8BAF] cursor-pointer hover:text-amber-400 transition-colors">
                👥 {recipientEmails.length} recipient{recipientEmails.length !== 1 ? 's' : ''} — click to view
              </summary>
              <div className="mt-1 bg-[#1A2540] border border-[#2A3A5C] rounded-lg p-2 max-h-[120px] overflow-y-auto">
                {recipientEmails.map((email, i) => (
                  <div key={email} className="text-[11px] text-[#C5CEE0] py-0.5 flex items-center gap-1">
                    <span className="text-amber-400">•</span>
                    {recipientNames[i] ? (
                      <span>{recipientNames[i]} <span className="text-[#4A5B7A]">({email})</span></span>
                    ) : (
                      <span>{email}</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
        {isEmailDraft && recipientEmails.length === 0 && !msg.actionsUsed && (
          <div className="text-[11px] text-red-400/70 mt-1 ml-1">
            ⚠ No recipients found. Try specifying the target (e.g. &quot;all students in my department&quot;)
          </div>
        )}

        {/* Agent badge */}
        {msg.agentUsed && msg.agentUsed !== 'general' && (
          <span className="text-[10px] text-[#4A5B7A] mt-1 ml-1">
            via {msg.agentUsed.replace(/_/g, ' ')}
          </span>
        )}

        {/* Action buttons */}
        {msg.actionButtons &&
          msg.actionButtons.length > 0 &&
          !msg.actionsUsed && (
            <div className="flex flex-wrap gap-2 mt-2 ml-1">
              {msg.actionButtons.map((btn) => (
                <button
                  key={btn.action + btn.label}
                  onClick={() => handleAction(btn, index)}
                  disabled={actionLoading === msg.id}
                  className={getButtonStyle(btn.style ?? 'ghost')}
                >
                  {actionLoading === msg.id &&
                    (btn.action === 'SEND_EMAIL' ||
                      btn.action === 'POST_REVIEW') && (
                      <Loader2 size={12} className="inline animate-spin mr-1" />
                    )}
                  {btn.label}
                </button>
              ))}
            </div>
          )}
      </div>
    )
  }

  /* ─── Render ───────────────────────────────────── */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 380 }}
          animate={{ x: 0 }}
          exit={{ x: 380 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-0 right-0 h-screen w-[380px] bg-[#0F1729] border-l border-[#2A3A5C] z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A3A5C]">
            <div className="flex items-center gap-3">
              {showHistory && (
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <h3 className="font-[var(--font-sora)] text-base font-semibold text-[#EEF2FF]">
                {showHistory ? 'Chat History' : 'AI Assistant'}
              </h3>
              {!showHistory && (
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}
                >
                  {role}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!showHistory && (
                <>
                  <button
                    onClick={() => setShowHistory(true)}
                    title="Chat history"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] transition-all duration-200"
                  >
                    <History size={16} />
                  </button>
                  <button
                    onClick={startNewChat}
                    title="New chat"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7A8BAF] hover:bg-[#1A2540] hover:text-amber-400 transition-all duration-200"
                  >
                    <Send size={14} className="rotate-[-45deg]" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7A8BAF] hover:bg-[#1A2540] hover:text-[#EEF2FF] transition-all duration-200"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* History panel */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-[#7A8BAF] text-sm">No chat history yet</p>
                  <p className="text-[#4A5B7A] text-xs mt-1">Start a conversation to see it here</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      s.id === activeSessionId
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'bg-[#1A2540] border border-[#2A3A5C] hover:border-[#3A4A6C]'
                    }`}
                    onClick={() => loadSession(s)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#EEF2FF] truncate">{s.title}</p>
                      <p className="text-[10px] text-[#4A5B7A] mt-0.5">
                        {new Date(s.updatedAt).toLocaleDateString()} &middot; {s.messages.filter((m) => m.isUser).length} messages
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(s.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center text-[#7A8BAF] hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
          <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                  <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <p className="text-[#7A8BAF] text-sm">
                  Ask me anything about your projects
                </p>
                <p className="text-[#4A5B7A] text-xs mt-2">
                  {role === 'STUDENT'
                    ? 'I can help with project ideas'
                    : 'Draft emails, review projects, query data'}
                </p>
              </div>
            )}
            {messages.map((msg, i) => renderMessage(msg, i))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-[#2A3A5C]">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Type a message…"
                rows={1}
                className="flex-1 bg-[#1A2540] border border-[#2A3A5C] rounded-xl text-sm text-[#EEF2FF] px-4 py-3 resize-none focus:outline-none focus:border-amber-500/50 placeholder-[#4A5B7A]"
                style={{ maxHeight: 120 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
              >
                {sending ? (
                  <Loader2 size={16} className="text-black animate-spin" />
                ) : (
                  <Send size={16} className="text-black" />
                )}
              </button>
            </div>
          </div>
          </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
