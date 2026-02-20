import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { conversationsApi } from '@/api/conversations'
import { ResponseModeSelector } from './ResponseModeSelector'
import { CrisisResourceBanner } from './CrisisResourceBanner'
import type { Conversation, ConversationMessage, ResponseMode } from '@/types/conversation'

interface Props {
  conversation: Conversation
  onModeChange?: (newConv: Conversation) => void
}

export function ConversationPanel({ conversation: initialConv, onModeChange }: Props) {
  const [conv, setConv] = useState<Conversation>(initialConv)
  const [messages, setMessages] = useState<ConversationMessage[]>(initialConv.messages ?? [])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [hasCrisis, setHasCrisis] = useState(false)
  const [crisisDismissed, setCrisisDismissed] = useState(false)

  // 선택 삭제 모드
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const lastUserCrisisFlag = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  const handleModeChange = async (mode: ResponseMode) => {
    try {
      const updated = await conversationsApi.updateMode(conv.id, mode)
      setConv({ ...conv, response_mode: mode })
      onModeChange?.({ ...conv, ...updated })
    } catch {
      // mode change is best-effort
    }
  }

  // 개별 메시지 삭제 (호버 모드)
  const handleDeleteMessage = async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    try {
      await conversationsApi.deleteMessage(messageId)
    } catch {
      // best-effort
    }
  }

  // 선택 삭제 모드
  const toggleSelectionMode = () => {
    setSelectionMode((v) => !v)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setIsDeleting(true)
    // Optimistic remove
    setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)))
    setSelectedIds(new Set())
    setSelectionMode(false)
    await Promise.all(ids.map((id) => conversationsApi.deleteMessage(id).catch(() => {})))
    setIsDeleting(false)
  }

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || isSending) return

    setInputValue('')
    setIsSending(true)
    setStreamingContent('')

    const optimisticUserMsg: ConversationMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      crisis_flag: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUserMsg])

    let accumulatedChunks = ''
    lastUserCrisisFlag.current = false

    await conversationsApi.sendMessage(conv.id, content, {
      onChunk: (chunk) => {
        accumulatedChunks += chunk
        setStreamingContent(accumulatedChunks)
      },
      onDone: (event) => {
        setStreamingContent('')
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => !m.id.startsWith('optimistic-'))
          return [
            ...withoutOptimistic,
            { ...optimisticUserMsg, id: event.user_message_id ?? `user-${Date.now()}`, crisis_flag: lastUserCrisisFlag.current },
            event.message,
          ]
        })
        setIsSending(false)
      },
      onCrisis: (event) => {
        lastUserCrisisFlag.current = true
        setHasCrisis(true)
        setCrisisDismissed(false)
        setStreamingContent(event.content)
      },
      onError: (_msg) => {
        setStreamingContent('')
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('optimistic-')))
        setIsSending(false)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [inputValue])

  const isEmpty = messages.length === 0 && !streamingContent
  const selectableMessages = messages.filter((m) => !m.id.startsWith('optimistic-'))

  return (
    <div className="flex flex-col h-full">
      {/* Response mode selector + 선택 삭제 버튼 */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400">대화 모드</p>
          {selectableMessages.length > 0 && (
            selectionMode ? (
              <button
                onClick={toggleSelectionMode}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                취소
              </button>
            ) : (
              <button
                onClick={toggleSelectionMode}
                className="text-xs text-gray-400 hover:text-primary-500 transition-colors"
              >
                선택 삭제
              </button>
            )
          )}
        </div>
        <ResponseModeSelector
          value={conv.response_mode as ResponseMode}
          onChange={handleModeChange}
          disabled={isSending || selectionMode}
        />
      </div>

      {/* Crisis banner */}
      <AnimatePresence>
        {hasCrisis && !crisisDismissed && (
          <motion.div
            key="crisis"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-3"
          >
            <CrisisResourceBanner onDismiss={() => setCrisisDismissed(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {isEmpty && (
          <div className="text-center text-gray-300 text-sm py-12">
            <p className="text-2xl mb-2">💬</p>
            <p>오늘 대화에 대해 이야기해 보세요.</p>
            <p className="text-xs mt-1 text-gray-200">궁금한 것, 더 나누고 싶은 것 무엇이든요.</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(msg.id)}
            onToggleSelect={msg.id.startsWith('optimistic-') ? undefined : toggleSelect}
            onDelete={(!selectionMode && !msg.id.startsWith('optimistic-')) ? handleDeleteMessage : undefined}
          />
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

      {/* 선택 삭제 확인 바 */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // 전체 선택 / 전체 해제
                  if (selectedIds.size === selectableMessages.length) {
                    setSelectedIds(new Set())
                  } else {
                    setSelectedIds(new Set(selectableMessages.map((m) => m.id)))
                  }
                }}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {selectedIds.size === selectableMessages.length ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-xs text-gray-400">
                {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : '메시지를 선택하세요'}
              </span>
            </div>
            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0 || isDeleting}
              className={clsx(
                'text-xs px-4 py-2 rounded-lg font-medium transition-colors',
                selectedIds.size > 0
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              )}
            >
              {isDeleting ? '삭제 중...' : `삭제`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area — 선택 모드에서는 숨김 */}
      {!selectionMode && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-50">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              disabled={isSending}
              rows={1}
              className={clsx(
                'flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-300',
                'focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100',
                'transition-colors leading-relaxed',
                isSending && 'opacity-60 cursor-not-allowed',
              )}
              style={{ fontFamily: 'inherit', minHeight: '44px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending}
              className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                inputValue.trim() && !isSending
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed',
              )}
            >
              {isSending ? (
                <span className="animate-spin text-base">⏳</span>
              ) : (
                <span className="text-base">↑</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface BubbleProps {
  message: ConversationMessage
  selectionMode: boolean
  isSelected: boolean
  onToggleSelect?: (id: string) => void
  onDelete?: (id: string) => void
}

function MessageBubble({ message, selectionMode, isSelected, onToggleSelect, onDelete }: BubbleProps) {
  const isUser = message.role === 'user'
  const [hovered, setHovered] = useState(false)

  if (selectionMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={clsx('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}
      >
        {/* 체크박스 — user 메시지는 오른쪽에, assistant는 왼쪽에 */}
        {!isUser && (
          <button
            onClick={() => onToggleSelect?.(message.id)}
            className={clsx(
              'flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center mb-1',
              isSelected
                ? 'bg-red-500 border-red-500 text-white'
                : 'border-gray-300 bg-white',
            )}
          >
            {isSelected && <span className="text-[10px] leading-none">✓</span>}
          </button>
        )}

        <div
          onClick={() => onToggleSelect?.(message.id)}
          className={clsx(
            'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap cursor-pointer transition-all',
            isUser
              ? 'bg-primary-500 text-white rounded-tr-sm'
              : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-sm',
            isSelected && 'ring-2 ring-red-400 opacity-70',
            message.crisis_flag && !isUser && 'border-red-200 bg-red-50',
          )}
        >
          {message.content}
        </div>

        {isUser && (
          <button
            onClick={() => onToggleSelect?.(message.id)}
            className={clsx(
              'flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center mb-1',
              isSelected
                ? 'bg-red-500 border-red-500 text-white'
                : 'border-gray-300 bg-white',
            )}
          >
            {isSelected && <span className="text-[10px] leading-none">✓</span>}
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex items-end gap-1.5', isUser ? 'justify-end' : 'justify-start')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isUser && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className={clsx(
            'text-xs text-gray-300 hover:text-red-400 transition-all mb-1',
            hovered ? 'opacity-100' : 'opacity-0',
          )}
          title="메시지 삭제"
        >
          🗑️
        </button>
      )}

      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-primary-500 text-white rounded-tr-sm'
            : 'bg-white border border-gray-100 shadow-sm text-gray-700 rounded-tl-sm',
          message.crisis_flag && !isUser && 'border-red-200 bg-red-50',
        )}
      >
        {message.content}
      </div>

      {!isUser && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className={clsx(
            'text-xs text-gray-300 hover:text-red-400 transition-all mb-1',
            hovered ? 'opacity-100' : 'opacity-0',
          )}
          title="메시지 삭제"
        >
          🗑️
        </button>
      )}
    </motion.div>
  )
}
