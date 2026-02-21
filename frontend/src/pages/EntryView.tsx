import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/shared/Layout'
import { entriesApi } from '@/api/entries'
import { useAuthStore } from '@/store/authStore'
import { iwa } from '@/utils/josa'

const CATEGORY_ICONS: Record<string, string> = {
  업무: '💼',
  기분: '😊',
  수면: '🌙',
  식사: '🍽️',
  운동: '🏃',
  관계: '👥',
}

// ── 비밀번호 입력 오버레이 (열람용) ──────────────────────────────
function LockVerifyOverlay({
  entryId,
  onVerified,
}: {
  entryId: string
  onVerified: (password: string) => void
}) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw) return
    setLoading(true)
    setError('')
    try {
      await entriesApi.verifyLock(entryId, pw)
      onVerified(pw)
    } catch {
      setError('비밀번호가 일치하지 않아요.')
      setPw('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4"
      >
        <div className="text-center mb-6">
          <span className="text-4xl">🔒</span>
          <h3 className="text-lg font-bold text-gray-800 mt-3">잠긴 일기예요</h3>
          <p className="text-sm text-gray-500 mt-1">비밀번호를 입력하면 볼 수 있어요</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !pw}
            className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ── 잠금 설정 모달 ────────────────────────────────────────────
function LockSetupModal({
  entryId,
  onDone,
  onClose,
}: {
  entryId: string
  onDone: () => void
  onClose: () => void
}) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 4) { setError('비밀번호는 4자 이상이어야 해요.'); return }
    if (pw !== confirm) { setError('비밀번호가 일치하지 않아요.'); return }
    setLoading(true)
    setError('')
    try {
      await entriesApi.lockEntry(entryId, pw)
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
      onDone()
    } catch {
      setError('잠금 설정에 실패했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-800 mb-1">잠금 비밀번호 설정</h3>
        <p className="text-sm text-gray-500 mb-6">이 날의 일기를 비밀번호로 보호해요</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호 (4자 이상)"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="비밀번호 확인"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !pw || !confirm}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {loading ? '설정 중...' : '잠금 설정'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── 잠금 해제 모달 ────────────────────────────────────────────
function UnlockModal({
  entryId,
  verifiedPassword,
  onDone,
  onClose,
}: {
  entryId: string
  verifiedPassword: string | null
  onDone: () => void
  onClose: () => void
}) {
  const [pw, setPw] = useState(verifiedPassword ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await entriesApi.unlockEntry(entryId, pw)
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] })
      onDone()
    } catch {
      setError('비밀번호가 일치하지 않아요.')
      setPw('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-800 mb-1">잠금 해제</h3>
        <p className="text-sm text-gray-500 mb-6">
          비밀번호를 입력하면 잠금이 영구적으로 해제돼요
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            autoFocus={!verifiedPassword}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !pw}
              className="flex-1 py-3 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {loading ? '해제 중...' : '잠금 해제'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── 메인 EntryView ────────────────────────────────────────────
export function EntryView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const aiName = user?.profile?.ai_name
  const lockEnabled = user?.profile?.entry_lock_enabled ?? false

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [verifiedPw, setVerifiedPw] = useState<string | null>(null)
  const [showLockSetup, setShowLockSetup] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)

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
  const needsVerification = entry.is_locked && !isUnlocked

  return (
    <>
      {/* 잠금 오버레이 */}
      {needsVerification && (
        <LockVerifyOverlay
          entryId={entry.id}
          onVerified={(pw) => { setVerifiedPw(pw); setIsUnlocked(true) }}
        />
      )}

      {/* 잠금 설정 모달 */}
      {showLockSetup && (
        <LockSetupModal
          entryId={entry.id}
          onDone={() => { setShowLockSetup(false); setIsUnlocked(true) }}
          onClose={() => setShowLockSetup(false)}
        />
      )}

      {/* 잠금 해제 모달 */}
      {showUnlockModal && (
        <UnlockModal
          entryId={entry.id}
          verifiedPassword={verifiedPw}
          onDone={() => { setShowUnlockModal(false); setIsUnlocked(false); setVerifiedPw(null) }}
          onClose={() => setShowUnlockModal(false)}
        />
      )}

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

            {/* 잠금 버튼 — 기능 활성화 시만 표시 */}
            {lockEnabled && !entry.is_locked && (
              <button
                onClick={() => setShowLockSetup(true)}
                className="text-gray-300 hover:text-primary-400 transition-colors p-1 text-lg"
                title="이 일기 잠금 설정"
              >
                🔓
              </button>
            )}
            {lockEnabled && entry.is_locked && isUnlocked && (
              <button
                onClick={() => setShowUnlockModal(true)}
                className="text-primary-400 hover:text-red-400 transition-colors p-1 text-lg"
                title="잠금 해제"
              >
                🔒
              </button>
            )}
            {lockEnabled && entry.is_locked && !isUnlocked && (
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
