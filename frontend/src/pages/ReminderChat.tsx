import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Layout } from '@/components/shared/Layout'
import { ReminderCheckInPanel } from '@/components/reminders/ReminderCheckInPanel'
import { remindersApi } from '@/api/reminders'

export function ReminderChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: checkIn, isLoading } = useQuery({
    queryKey: ['reminder', id],
    queryFn: () => remindersApi.get(id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          불러오는 중...
        </div>
      </Layout>
    )
  }

  if (!checkIn) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400 text-sm">
          <p>체크인을 찾을 수 없어요.</p>
          <button
            onClick={() => navigate('/reminders')}
            className="text-primary-500 mt-2 inline-block"
          >
            목록으로
          </button>
        </div>
      </Layout>
    )
  }

  const scheduledDate = parseISO(checkIn.scheduled_at)
  const dateLabel = format(scheduledDate, 'M월 d일 EEEE', { locale: ko })

  return (
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-50 flex-shrink-0">
          <button
            onClick={() => navigate('/reminders')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-800 truncate">{checkIn.title}</h2>
            <p className="text-xs text-gray-400">{dateLabel}</p>
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-h-0">
          <ReminderCheckInPanel
            checkIn={checkIn}
            onStatusChange={() => {}}
          />
        </div>
      </div>
    </Layout>
  )
}
