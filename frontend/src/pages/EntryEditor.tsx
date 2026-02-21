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
import { useAuthStore } from '@/store/authStore'
import { CrisisResourceBanner } from '@/components/conversation/CrisisResourceBanner'
import type { Conversation, ConversationMessage } from '@/types/conversation'

export function EntryEditor() {
  const { date: dateParam } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const { updateUser } = useAuthStore()

  const entryDate = dateParam || format(new Date(), 'yyyy-MM-dd')
  const dateLabel = format(new Date(entryDate + 'T00:00:00'), 'M월 d일 EEEE', { locale: ko })

  // 엔트리 & 대화 상태
  const [entryId, setEntryId] = useState<string | null>(null)
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isInitializing, setIsInitializing] = useState(true)

  // 채팅 UI 상태
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [hasCrisis, setHasCrisis] = useState(false)
  const [crisisDismissed, setCrisisDismissed] = useState(false)
  const lastCrisisRef = useRef(false)

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

        const conversation = await conversationsApi.start(eid, 'empathetic')
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
          return [
            ...withoutOpt,
            { ...optimisticMsg, crisis_flag: lastCrisisRef.current },
            event.message,
          ]
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
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">{dateLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">오늘 하루를 자유롭게 이야기해보세요</p>
          </div>
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

        {/* Crisis banner */}
        {hasCrisis && !crisisDismissed && (
          <div className="pt-3 flex-shrink-0">
            <CrisisResourceBanner onDismiss={() => setCrisisDismissed(true)} />
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
