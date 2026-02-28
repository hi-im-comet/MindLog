import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/shared/Layout'
import { entriesApi } from '@/api/entries'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/store/authStore'
import { useAutoLock } from '@/hooks/useAutoLock'
import { iwa } from '@/utils/josa'

const CATEGORY_ICONS: Record<string, string> = {
  업무: '💼',
  기분: '😊',
  수면: '🌙',
  식사: '🍽️',
  운동: '🏃',
  관계: '👥',
}

// ── 비밀번호 입력 오버레이 ────────────────────────────────────────────────────
function LockVerifyOverlay({ onVerified }: { onVerified: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = (seconds: number) => {
    setCooldownSeconds(seconds)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!)
          setRemainingAttempts(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || cooldownSeconds > 0) return
    setLoading(true)
    setError('')
    try {
      await usersApi.verifyLock(pw)
      onVerified()
    } catch (err: any) {
      const data = err?.response?.data
      const status = err?.response?.status
      if (status === 429 && data?.errors?.retry_after) {
        startCooldown(data.errors.retry_after)
        setError(`너무 많이 시도했어요. ${data.errors.retry_after}초 후 다시 시도해 주세요.`)
      } else {
        const remaining = data?.errors?.remaining_attempts
        if (typeof remaining === 'number') setRemainingAttempts(remaining)
        setError('비밀번호가 일치하지 않아요.')
      }
      setPw('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  const isLocked = cooldownSeconds > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4"
      >
        <div className="text-center mb-6">
          <span className="text-4xl">{isLocked ? '⏳' : '🔒'}</span>
          <h3 className="text-lg font-bold text-gray-800 mt-3">잠긴 일기예요</h3>
          <p className="text-sm text-gray-500 mt-1">잠금 비밀번호를 입력하면 볼 수 있어요</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError('') }}
            placeholder="비밀번호"
            autoFocus
            disabled={isLocked}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-400"
          />
          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}
          {isLocked && (
            <p className="text-xs text-center text-amber-600 font-medium">
              {cooldownSeconds}초 후 다시 시도할 수 있어요
            </p>
          )}
          {!isLocked && remainingAttempts !== null && remainingAttempts > 0 && (
            <p className="text-xs text-center text-orange-500">
              남은 시도 횟수: {remainingAttempts}회
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !pw || isLocked}
            className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '확인 중...' : isLocked ? `${cooldownSeconds}초 대기` : '확인'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ── 태그 입력 컴포넌트 ────────────────────────────────────────────────────────
function TagEditor({ tags, onSave }: { tags: string[]; onSave: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const [localTags, setLocalTags] = useState(tags)
  const [isComposing, setIsComposing] = useState(false)

  const addTag = () => {
    const t = input.trim().replace(/^#/, '')
    if (!t || localTags.includes(t) || localTags.length >= 10) return
    const next = [...localTags, t]
    setLocalTags(next)
    setInput('')
    onSave(next)
  }

  const removeTag = (tag: string) => {
    const next = localTags.filter((t) => t !== tag)
    setLocalTags(next)
    onSave(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {localTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 rounded-full px-2.5 py-1"
          >
            #{tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-primary-400 hover:text-primary-700 leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isComposing) { e.preventDefault(); addTag() }
          }}
          placeholder="태그 추가 (Enter)"
          maxLength={30}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-300"
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          className="text-xs text-primary-600 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50 disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </div>
  )
}

// ── 메인 EntryView ────────────────────────────────────────────────────────────
export function EntryView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const aiName = user?.profile?.ai_name
  const lockEnabled = user?.profile?.entry_lock_enabled ?? false
  const hasLockPassword = user?.profile?.has_lock_password ?? false
  const autoLockEnabled = user?.profile?.auto_lock_enabled ?? false
  const autoLockTimeout = user?.profile?.auto_lock_timeout ?? 30

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false)
  const [showTagEditor, setShowTagEditor] = useState(false)

  // 자동 잠금: 잠긴 일기를 이미 비번으로 열었을 때만 적용
  const shouldAutoLock = lockEnabled && hasLockPassword && isUnlocked && autoLockEnabled
  const handleAutoLock = useCallback(() => setIsUnlocked(false), [])
  useAutoLock({ enabled: shouldAutoLock, timeoutMinutes: autoLockTimeout, onLock: handleAutoLock })

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.get(id!),
    refetchInterval: (query) => {
      const e = query.state.data
      if (!e || e.is_draft) return false
      return (!e.category_segments || e.category_segments.length === 0) ? 10_000 : false
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => entriesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate('/dashboard')
    },
  })

  const lockMutation = useMutation({
    mutationFn: () => entriesApi.lockEntry(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entry', id] }),
  })

  const unlockMutation = useMutation({
    mutationFn: () => entriesApi.unlockEntry(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', id] })
      setShowUnlockConfirm(false)
      setIsUnlocked(false)
    },
  })

  const favMutation = useMutation({
    mutationFn: () => entriesApi.toggleFavorite(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', id] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })

  const tagMutation = useMutation({
    mutationFn: (tags: string[]) => entriesApi.update(id!, { tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entry', id] }),
  })

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>불러오는 중...</p>
        </div>
      </Layout>
    )
  }

  if (!entry) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400">
          <p>대화를 찾을 수 없어요.</p>
          <Link to="/dashboard" className="text-primary-500 text-sm mt-2 inline-block">
            홈으로
          </Link>
        </div>
      </Layout>
    )
  }

  const dateLabel = format(
    new Date(entry.entry_date + 'T00:00:00'),
    'yyyy년 M월 d일 EEEE',
    { locale: ko }
  )
  const hasSegments = entry.category_segments && entry.category_segments.length > 0
  const needsVerification = entry.is_locked && hasLockPassword && !isUnlocked

  return (
    <>
      {/* 잠금 오버레이 */}
      {needsVerification && (
        <LockVerifyOverlay onVerified={() => setIsUnlocked(true)} />
      )}

      {/* 잠금 해제 확인 모달 */}
      <AnimatePresence>
        {showUnlockConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setShowUnlockConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="text-center space-y-1">
                <p className="text-3xl">🔓</p>
                <h3 className="text-base font-bold text-gray-800">잠금을 해제할까요?</h3>
                <p className="text-sm text-gray-500">이 일기의 잠금이 영구적으로 풀려요.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUnlockConfirm(false)}
                  className="btn-secondary flex-1 text-sm"
                >
                  취소
                </button>
                <button
                  onClick={() => unlockMutation.mutate()}
                  disabled={unlockMutation.isPending}
                  className="flex-1 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-xl py-2.5 font-medium transition-colors"
                >
                  {unlockMutation.isPending ? '해제 중...' : '잠금 해제'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Layout>
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ←
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-800">{dateLabel}</h2>
              {entry.categories.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {entry.categories.map((c) => (
                    <span key={c.id} className="text-xs text-gray-400">
                      {c.icon} {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 즐겨찾기 버튼 */}
            <button
              onClick={() => favMutation.mutate()}
              disabled={favMutation.isPending}
              className="text-lg p-1 transition-colors disabled:opacity-50"
              title={entry.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              {entry.is_favorite ? '⭐' : '☆'}
            </button>

            {/* 잠금 버튼 — 전역 잠금 + 비밀번호 설정 시만 표시 */}
            {lockEnabled && hasLockPassword && !entry.is_locked && (
              <button
                onClick={() => lockMutation.mutate()}
                disabled={lockMutation.isPending}
                className="text-gray-300 hover:text-primary-400 transition-colors p-1 text-lg disabled:opacity-50"
                title="이 일기 잠금"
              >
                🔓
              </button>
            )}
            {lockEnabled && entry.is_locked && isUnlocked && (
              <button
                onClick={() => setShowUnlockConfirm(true)}
                className="text-primary-400 hover:text-red-400 transition-colors p-1 text-lg"
                title="잠금 해제"
              >
                🔒
              </button>
            )}
            {lockEnabled && entry.is_locked && !isUnlocked && hasLockPassword && (
              <span className="text-primary-400 p-1 text-lg">🔒</span>
            )}

            {/* Delete control */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-gray-300 hover:text-red-400 transition-colors p-1"
                title="대화 삭제"
              >
                🗑️
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">삭제할까요?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
                >
                  취소
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded font-medium"
                >
                  {deleteMutation.isPending ? '...' : '삭제'}
                </button>
              </div>
            )}
          </div>

          {/* 본문 — 잠금 미인증 시 블러 */}
          <div className={needsVerification ? 'blur-sm pointer-events-none select-none' : ''}>
            {/* 태그 */}
            <div className="mb-4">
              {entry.tags && entry.tags.length > 0 && !showTagEditor && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-primary-600 bg-primary-50 rounded-full px-2.5 py-1"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowTagEditor((v) => !v)}
                className="text-xs text-gray-400 hover:text-primary-500 transition-colors"
              >
                {showTagEditor ? '태그 닫기' : entry.tags?.length ? '태그 편집' : '+ 태그 추가'}
              </button>
              <AnimatePresence>
                {showTagEditor && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-2"
                  >
                    <TagEditor
                      tags={entry.tags || []}
                      onSave={(tags) => tagMutation.mutate(tags)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 카테고리별 AI 분석 */}
            <AnimatePresence mode="wait">
              {hasSegments ? (
                <motion.div
                  key="segments"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {entry.category_segments!.map((seg) => (
                    <div key={seg.category} className="card p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {CATEGORY_ICONS[seg.category] ?? '📌'} {seg.category}
                      </p>
                      <p className="text-gray-700 text-sm leading-relaxed">{seg.content}</p>
                    </div>
                  ))}
                </motion.div>
              ) : !entry.is_draft ? (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card p-4 flex items-center gap-3 text-gray-400"
                >
                  <span className="animate-spin text-lg">⏳</span>
                  <span className="text-sm">AI가 오늘 대화를 분석하고 있어요...</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              <Link
                to={`/entry/${entry.entry_date}`}
                className="btn-secondary flex-1 text-center"
              >
                대화 이어가기
              </Link>
              {!entry.is_draft && (
                <Link
                  to={`/view/${entry.id}/chat`}
                  className="btn-primary flex-1 text-center"
                >
                  {entry.has_conversation
                    ? '전체 대화 보기 💬'
                    : aiName
                    ? `"${aiName}"${iwa(aiName)} 대화하기 🤖`
                    : 'AI와 대화하기 🤖'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
