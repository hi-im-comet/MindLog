import { format, parseISO, isFuture } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import type { CheckIn } from '@/types/reminder'

const STATUS_LABELS: Record<string, string> = {
  pending: '예정',
  sent: '진행 중',
  done: '완료',
  snoozed: '미룸',
  cancelled: '취소됨',
}

const TONE_LABELS: Record<string, string> = {
  encouraging: '응원',
  gentle: '부드러움',
  strict: '직접적',
}

interface ReminderCardProps {
  checkIn: CheckIn
  onDelete?: (id: string) => void
}

export function ReminderCard({ checkIn, onDelete }: ReminderCardProps) {
  const navigate = useNavigate()
  const scheduledDate = parseISO(checkIn.scheduled_at)
  const dateLabel = format(scheduledDate, 'M월 d일 EEEE a h:mm', { locale: ko })
  const canChat = checkIn.status === 'sent' || checkIn.status === 'pending'
  const isDone = checkIn.status === 'done' || checkIn.status === 'cancelled'

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border p-4 flex items-start gap-3 transition-colors',
        isDone ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:border-gray-200',
      )}
    >
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm font-medium text-gray-800 truncate',
            isDone && 'line-through text-gray-400',
          )}
        >
          {checkIn.title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={clsx(
              'text-xs px-2 py-0.5 rounded-full',
              checkIn.status === 'done'
                ? 'bg-green-50 text-green-600'
                : checkIn.status === 'sent'
                  ? 'bg-blue-50 text-blue-600'
                  : checkIn.status === 'snoozed'
                    ? 'bg-yellow-50 text-yellow-600'
                    : checkIn.status === 'cancelled'
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-primary-50 text-primary-600',
            )}
          >
            {STATUS_LABELS[checkIn.status] ?? checkIn.status}
          </span>
          <span className="text-xs text-gray-300">{TONE_LABELS[checkIn.tone]}</span>
          {checkIn.recurrence !== 'none' && (
            <span className="text-xs text-gray-300">
              {checkIn.recurrence === 'daily' ? '매일' : '매주'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {canChat && (
          <button
            onClick={() => navigate(`/reminders/${checkIn.id}/chat`)}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors font-medium"
          >
            대화하기
          </button>
        )}
        {!isDone && onDelete && (
          <button
            onClick={() => onDelete(checkIn.id)}
            className="text-gray-300 hover:text-red-400 transition-colors p-1.5"
            title="삭제"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  )
}
