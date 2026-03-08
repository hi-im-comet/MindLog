import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Layout } from '@/components/shared/Layout'
import { useAutoSave } from '@/hooks/useAutoSave'
import { entriesApi } from '@/api/entries'
import { conversationsApi } from '@/api/conversations'
import { usersApi } from '@/api/users'
import { remindersApi } from '@/api/reminders'
import { useAuthStore } from '@/store/authStore'
import { CrisisResourceBanner } from '@/components/conversation/CrisisResourceBanner'
import { ResponseModeSelector } from '@/components/conversation/ResponseModeSelector'
import { ReminderCreateModal } from '@/components/reminders/ReminderCreateModal'
import { MOOD_OPTIONS, LENGTH_OPTIONS } from '@/constants/aiMood'
import type { Conversation, ConversationMessage, ResponseMode } from '@/types/conversation'
import type { ExtractedTask } from '@/types/reminder'

export function EntryEditor() {
  const { date: dateParam } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const { updateUser, user } = useAuthStore()

  const entryDate = dateParam || format(new Date(), 'yyyy-MM-dd')
  const dateLabel = format(new Date(entryDate + 'T00:00:00'), 'M월 d일 EEEE', { locale: ko })

  // 엔트리 & 대화 상태
  const [entryId, setEntryId] = useState<string | null>(null)
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isInitializing, setIsInitializing] = useState(true)

  // 잠금
  const lockEnabled = user?.profile?.entry_lock_enabled ?? false
  const hasLockPassword = user?.profile?.has_lock_password ?? false
  const [isLocked, setIsLocked] = useState(false)
  const [isSessionUnlocked, setIsSessionUnlocked] = useState(false) // 이번 세션에서 비번 확인 완료
  // 잠금 오버레이 (잠긴 일기 열람 시)
  const [viewOverlayPw, setViewOverlayPw] = useState('')
  const [viewOverlayError, setViewOverlayError] = useState('')
  const [viewOverlayLoading, setViewOverlayLoading] = useState(false)
  // 잠금 설정 모달 (새로 잠글 때)
  const [showLockModal, setShowLockModal] = useState(false)
  const [lockPw, setLockPw] = useState('')
  const [lockPwError, setLockPwError] = useState('')
  const [lockPwLoading, setLockPwLoading] = useState(false)
  // 잠금 해제 확인 모달
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)

  // 즐겨찾기
  const [isFavorite, setIsFavorite] = useState(false)
  const [favPending, setFavPending] = useState(false)

  // AI 무드 / 길이 오버라이드
  const [activeMood, setActiveMood] = useState<string>(user?.profile?.ai_mood_default || 'empathy')
  const [activeLength, setActiveLength] = useState<string>(user?.profile?.ai_response_length_default || 'normal')

  // 채팅 UI 상태
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [hasCrisis, setHasCrisis] = useState(false)
  const [crisisDismissed, setCrisisDismissed] = useState(false)
  const lastCrisisRef = useRef(false)

  // NLP 태스크 제안 배너
  const [suggestedTasks, setSuggestedTasks] = useState<ExtractedTask[]>([])
  const [nlpBannerDismissed, setNlpBannerDismissed] = useState(false)
  const [createReminderTask, setCreateReminderTask] = useState<ExtractedTask | null>(null)
  const nlpTriggeredRef = useRef(false)

  // 사용자 메시지 누적 (raw_content 동기화용)
  const userMessagesRef = useRef<string[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // raw_content auto-save
  const saveFn = useCallback(
    async (data: { content: string }) => {
      if (!entryId) return
      await entriesApi.update(entryId, { raw_content: data.content })
    },
    [entryId]
  )
  const { save } = useAutoSave(saveFn, 2000)

  // 초기화: 오늘 날짜 entry 가져오거나 생성, 대화 시작
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        let eid: string
        const existing = await entriesApi.getByDate(entryDate)

        if (existing) {
          eid = existing.id
          if (existing.raw_content?.trim()) {
            userMessagesRef.current = existing.raw_content.split('\n\n').filter(Boolean)
          }
          setIsFavorite(existing.is_favorite ?? false)
          setIsLocked(existing.is_locked ?? false)
          setActiveMood(existing.ai_mood_override || user?.profile?.ai_mood_default || 'empathy')
          setActiveLength(existing.ai_response_length_override || user?.profile?.ai_response_length_default || 'normal')
        } else {
          const created = await entriesApi.create({
            entry_date: entryDate,
            raw_content: ' ',
            is_draft: true,
          })
          eid = created.id
        }

        if (cancelled) return
        setEntryId(eid)

        const conversation = await conversationsApi.start(eid)
        if (cancelled) return
        setConv(conversation)
        setMessages(conversation.messages ?? [])
      } catch (err) {
        console.error('EntryEditor 초기화 실패:', err)
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [entryDate])

  // 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // textarea 자동 높이
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [inputValue])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || isSending || !conv) return

    setInputValue('')
    setIsSending(true)
    setStreamingContent('')
    lastCrisisRef.current = false

    userMessagesRef.current = [...userMessagesRef.current, content]
    save({ content: userMessagesRef.current.join('\n\n') })

    const optimisticMsg: ConversationMessage = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content,
      crisis_flag: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    let accChunks = ''

    await conversationsApi.sendMessage(conv.id, content, {
      onChunk: (chunk) => {
        accChunks += chunk
        setStreamingContent(accChunks)
      },
      onDone: (event) => {
        setStreamingContent('')
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => !m.id.startsWith('opt-'))
          const updated = [
            ...withoutOpt,
            { ...optimisticMsg, crisis_flag: lastCrisisRef.current },
            event.message,
          ]
          // 3번째 사용자 메시지 이후 NLP 추출 (1회만)
          const userCount = updated.filter((m) => m.role === 'user').length
          if (userCount >= 3 && !nlpTriggeredRef.current && entryId) {
            nlpTriggeredRef.current = true
            remindersApi.extractTasks(entryId).then((tasks) => {
              if (tasks.length > 0) {
                setSuggestedTasks(tasks)
                setNlpBannerDismissed(false)
              }
            }).catch(() => {})
          }
          return updated
        })
        setIsSending(false)
      },
      onCrisis: (event) => {
        lastCrisisRef.current = true
        setHasCrisis(true)
        setCrisisDismissed(false)
        setStreamingContent(event.content)
      },
      onError: (msg) => {
        setStreamingContent('')
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('opt-')))
        setIsSending(false)
        setErrorMessage(msg || 'AI 응답 중 오류가 발생했습니다.')
        setTimeout(() => setErrorMessage(''), 4000)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFinish = async () => {
    if (!entryId) return
    const rawContent = userMessagesRef.current.join('\n\n')
    await entriesApi.update(entryId, { raw_content: rawContent || ' ', is_draft: false })
    // 백엔드가 streak를 업데이트했으니 스토어를 새로고침
    try {
      const freshUser = await usersApi.getMe()
      updateUser({ profile: freshUser.profile })
    } catch {
      // 실패해도 네비게이션은 진행
    }
    navigate(`/view/${entryId}`)
  }

  const handleViewOverlaySubmit = async () => {
    if (!viewOverlayPw || viewOverlayLoading) return
    setViewOverlayLoading(true)
    setViewOverlayError('')
    try {
      await usersApi.verifyLock(viewOverlayPw)
      setIsSessionUnlocked(true)
      setViewOverlayPw('')
    } catch (err: any) {
      const status = err?.response?.status
      setViewOverlayError(status === 429 ? '잠시 후 다시 시도해주세요.' : '비밀번호가 일치하지 않아요.')
      setViewOverlayPw('')
    } finally {
      setViewOverlayLoading(false)
    }
  }

  const handlePermanentUnlock = async () => {
    if (!entryId || unlockLoading) return
    setUnlockLoading(true)
    try {
      await entriesApi.unlockEntry(entryId)
      setIsLocked(false)
      setIsSessionUnlocked(false)
      setShowUnlockConfirm(false)
    } catch { } finally {
      setUnlockLoading(false)
    }
  }

  const handleLockConfirm = async () => {
    if (!entryId || !lockPw || lockPwLoading) return
    setLockPwLoading(true)
    setLockPwError('')
    try {
      await usersApi.verifyLock(lockPw)
      await entriesApi.lockEntry(entryId)
      setIsLocked(true)
      setShowLockModal(false)
      setLockPw('')
    } catch (err: any) {
      const status = err?.response?.status
      setLockPwError(status === 429 ? '잠시 후 다시 시도해주세요.' : '비밀번호가 일치하지 않아요.')
      setLockPw('')
    } finally {
      setLockPwLoading(false)
    }
  }

  const handleFavToggle = async () => {
    if (!entryId || favPending) return
    setFavPending(true)
    try {
      const updated = await entriesApi.toggleFavorite(entryId)
      setIsFavorite(updated.is_favorite)
    } catch {
      // 실패 시 상태 유지
    } finally {
      setFavPending(false)
    }
  }

  const handleMoodChange = async (mood: string) => {
    if (!entryId) return
    setActiveMood(mood)
    await entriesApi.update(entryId, { ai_mood_override: mood })
    if (conv) {
      const updated = await conversationsApi.updateMode(conv.id, mood as ResponseMode)
      setConv(updated)
    }
  }

  const handleLengthChange = async (len: string) => {
    if (!entryId) return
    setActiveLength(len)
    await entriesApi.update(entryId, { ai_response_length_override: len })
  }

  const userMessageCount = messages.filter((m) => m.role === 'user').length

  if (isInitializing) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>준비하고 있어요...</p>
        </div>
      </Layout>
    )
  }

  return (
    <>
      {/* 잠긴 일기 열람 오버레이 */}
      {isLocked && !isSessionUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-4xl">🔒</p>
              <h2 className="text-lg font-bold text-gray-800">잠긴 일기예요</h2>
              <p className="text-sm text-gray-500">비밀번호를 입력하면 볼 수 있어요.</p>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleViewOverlaySubmit() }}
              className="space-y-3"
            >
              <input
                type="password"
                value={viewOverlayPw}
                onChange={(e) => { setViewOverlayPw(e.target.value); setViewOverlayError('') }}
                placeholder="비밀번호"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              {viewOverlayError && <p className="text-xs text-red-500">{viewOverlayError}</p>}
              <button
                type="submit"
                disabled={!viewOverlayPw || viewOverlayLoading}
                className="w-full btn-primary text-sm disabled:opacity-60"
              >
                {viewOverlayLoading ? '확인 중...' : '열람하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 잠금 해제 확인 모달 */}
      {showUnlockConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4"
          onClick={(e) => e.target === e.currentTarget && setShowUnlockConfirm(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="text-center space-y-1">
              <p className="text-2xl">🔓</p>
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
                onClick={handlePermanentUnlock}
                disabled={unlockLoading}
                className="flex-1 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-xl py-2.5 font-medium transition-colors"
              >
                {unlockLoading ? '해제 중...' : '잠금 해제'}
              </button>
            </div>
          </div>
        </div>
      )}

    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">{dateLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            {entryId && (
              <button
                onClick={handleFavToggle}
                disabled={favPending}
                className="text-lg p-1 transition-colors disabled:opacity-50"
                title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              >
                {isFavorite ? '⭐' : '☆'}
              </button>
            )}
            {/* 일기 잠금/해제 버튼 */}
            {lockEnabled && hasLockPassword && entryId && (
              <button
                onClick={() => {
                  if (!isLocked) setShowLockModal(true)
                  else if (isSessionUnlocked) setShowUnlockConfirm(true)
                }}
                className={isLocked
                  ? (isSessionUnlocked
                      ? 'text-lg p-1 text-primary-400 hover:text-red-400 transition-colors'
                      : 'text-lg p-1 text-primary-400 cursor-default')
                  : 'text-lg p-1 text-gray-300 hover:text-primary-400 transition-colors'}
                title={isLocked ? (isSessionUnlocked ? '잠금 해제하기' : '잠금된 일기') : '이 일기 잠금'}
              >
                {isLocked ? '🔒' : '🔓'}
              </button>
            )}
            <button
              onClick={handleFinish}
              disabled={userMessageCount === 0}
              className={clsx(
                'text-sm font-medium px-4 py-2 rounded-lg transition-colors',
                userMessageCount > 0
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}
            >
              기록 마치기
            </button>
          </div>
        </div>

        {/* 응답 스타일 */}
        <div className="pt-2 pb-1 flex-shrink-0">
          <ResponseModeSelector
            value={activeMood as ResponseMode}
            onChange={(mode) => handleMoodChange(mode)}
            disabled={isSending}
          />
          <div className="flex gap-1.5 mt-1.5">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleLengthChange(opt.value)}
                disabled={isSending}
                className={clsx(
                  'flex-1 py-1 rounded-lg text-xs font-medium transition-colors border',
                  activeLength === opt.value
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-700',
                  isSending && 'opacity-50 cursor-not-allowed',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Crisis banner */}
        {hasCrisis && !crisisDismissed && (
          <div className="pt-1 flex-shrink-0">
            <CrisisResourceBanner onDismiss={() => setCrisisDismissed(true)} />
          </div>
        )}

        {/* NLP 태스크 제안 배너 */}
        {suggestedTasks.length > 0 && !nlpBannerDismissed && (
          <div className="pt-1 flex-shrink-0">
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-amber-700">💡 이런 할 일이 있으신가요?</p>
                <button
                  onClick={() => setNlpBannerDismissed(true)}
                  className="text-amber-400 hover:text-amber-600 text-xs flex-shrink-0"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {suggestedTasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-amber-800 flex-1 truncate">• {task.title}</p>
                    <button
                      onClick={() => setCreateReminderTask(task)}
                      className="text-xs text-amber-600 font-medium hover:underline flex-shrink-0"
                    >
                      추가
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white border border-gray-100 shadow-sm px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-primary-400 ml-0.5 animate-pulse align-middle" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Error toast */}
        {errorMessage && (
          <div className="flex-shrink-0 text-center py-2">
            <span className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-full">{errorMessage}</span>
          </div>
        )}

        {/* Input */}
        <div className="pt-2 pb-1 border-t border-gray-50 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="오늘 어떤 일이 있었나요? (Enter로 전송)"
              disabled={isSending || !conv}
              rows={1}
              className={clsx(
                'flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-300',
                'focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100',
                'transition-colors leading-relaxed',
                (isSending || !conv) && 'opacity-60 cursor-not-allowed'
              )}
              style={{ fontFamily: 'inherit', minHeight: '44px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending || !conv}
              className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                inputValue.trim() && !isSending && conv
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}
            >
              {isSending ? (
                <span className="animate-spin text-sm">⏳</span>
              ) : (
                <span className="text-base">↑</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>

      {createReminderTask && entryId && (
        <ReminderCreateModal
          initialTitle={createReminderTask.title}
          sourceEntryId={entryId}
          onClose={() => setCreateReminderTask(null)}
        />
      )}

      {/* 일기 잠금 비밀번호 확인 모달 */}
      {showLockModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowLockModal(false); setLockPw(''); setLockPwError('') } }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="text-center space-y-1">
              <p className="text-2xl">🔒</p>
              <h3 className="text-base font-bold text-gray-800">일기 잠금</h3>
              <p className="text-sm text-gray-500">비밀번호를 확인한 후 이 일기를 잠글게요.</p>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={lockPw}
                onChange={(e) => { setLockPw(e.target.value); setLockPwError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLockConfirm()}
                placeholder="잠금 비밀번호"
                className="input-field text-sm w-full"
                autoFocus
              />
              {lockPwError && <p className="text-xs text-red-500">{lockPwError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowLockModal(false); setLockPw(''); setLockPwError('') }}
                className="btn-secondary flex-1 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleLockConfirm}
                disabled={!lockPw || lockPwLoading}
                className="btn-primary flex-1 text-sm disabled:opacity-60"
              >
                {lockPwLoading ? '잠금 중...' : '잠금하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-primary-500 text-white rounded-tr-sm'
            : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-sm',
          message.crisis_flag && !isUser && 'border-red-200 bg-red-50'
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
}
