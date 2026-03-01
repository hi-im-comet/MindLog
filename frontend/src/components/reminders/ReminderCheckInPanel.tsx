import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { remindersApi } from '@/api/reminders'
import type { CheckIn, CheckInMessage, CheckInActionType } from '@/types/reminder'

interface ReminderCheckInPanelProps {
  checkIn: CheckIn
  onStatusChange: (updated: CheckIn) => void
}

const QUICK_ACTIONS: { action: CheckInActionType; label: string; emoji: string }[] = [
  { action: 'done', label: '완료', emoji: '✅' },
  { action: 'snooze_10', label: '10분', emoji: '💤' },
  { action: 'snooze_60', label: '1시간', emoji: '💤' },
  { action: 'reschedule', label: '재예약', emoji: '📅' },
]

export function ReminderCheckInPanel({ checkIn, onStatusChange }: ReminderCheckInPanelProps) {
  const [messages, setMessages] = useState<CheckInMessage[]>(checkIn.messages ?? [])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDone, setIsDone] = useState(
    checkIn.status === 'done' || checkIn.status === 'cancelled',
  )

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputValue])

  const sendMessage = async (content: string, actionType: CheckInActionType = null) => {
    if ((!content.trim() && !actionType) || isSending || isDone) return

    const messageContent = content.trim() || _getActionLabel(actionType)
    setInputValue('')
    setIsSending(true)
    setStreamingContent('')

    const optimisticMsg: CheckInMessage = {
      id: `opt-${Date.now()}`,
      check_in_id: checkIn.id,
      role: 'user',
      content: messageContent,
      action_type: actionType,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    let accChunks = ''

    await remindersApi.sendMessage(checkIn.id, messageContent, actionType, {
      onChunk: (chunk) => {
        accChunks += chunk
        setStreamingContent(accChunks)
      },
      onDone: (aiMsg) => {
        setStreamingContent('')
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => !m.id.startsWith('opt-'))
          return [...withoutOpt, optimisticMsg, aiMsg]
        })
        setIsSending(false)
        // 완료 액션이면 입력 비활성화
        if (actionType === 'done' || actionType === 'snooze_10' || actionType === 'snooze_60') {
          setIsDone(true)
        }
      },
      onError: (msg) => {
        setStreamingContent('')
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('opt-')))
        setIsSending(false)
        setErrorMessage(msg || '오류가 발생했습니다.')
        setTimeout(() => setErrorMessage(''), 4000)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  return (
    <div className="flex flex-col h-full">
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

      {/* Quick actions */}
      {!isDone && (
        <div className="flex gap-2 py-2 flex-shrink-0 overflow-x-auto">
          {QUICK_ACTIONS.map(({ action, label, emoji }) => (
            <button
              key={action}
              onClick={() => sendMessage('', action)}
              disabled={isSending}
              className="flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {isDone && (
        <div className="py-3 text-center text-sm text-gray-400 flex-shrink-0">
          이 체크인이 완료되었습니다 ✅
        </div>
      )}

      {/* Error toast */}
      {errorMessage && (
        <div className="flex-shrink-0 text-center py-2">
          <span className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-full">
            {errorMessage}
          </span>
        </div>
      )}

      {/* Input */}
      {!isDone && (
        <div className="pt-2 pb-1 border-t border-gray-50 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지 입력... (Enter로 전송)"
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
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isSending}
              className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                inputValue.trim() && !isSending
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed',
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
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: CheckInMessage }) {
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
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
}

function _getActionLabel(actionType: CheckInActionType): string {
  switch (actionType) {
    case 'done': return '완료했어요!'
    case 'snooze_10': return '10분 후에 다시 알려줘요'
    case 'snooze_60': return '1시간 후에 다시 알려줘요'
    case 'reschedule': return '나중에 다시 설정할게요'
    default: return ''
  }
}
