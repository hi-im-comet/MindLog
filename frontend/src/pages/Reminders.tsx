import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Layout } from '@/components/shared/Layout'
import { ReminderCard } from '@/components/reminders/ReminderCard'
import { ReminderCreateModal } from '@/components/reminders/ReminderCreateModal'
import { remindersApi } from '@/api/reminders'
import type { CheckInStatus } from '@/types/reminder'

const TABS: { value: CheckInStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '예정' },
  { value: 'sent', label: '진행 중' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소됨' },
]

export function Reminders() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<CheckInStatus | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: checkIns = [], isLoading } = useQuery({
    queryKey: ['reminders', activeTab],
    queryFn: () => remindersApi.list(activeTab === 'all' ? undefined : activeTab),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remindersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-50">
          <h1 className="text-lg font-bold text-gray-800">체크인 알림</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
          >
            + 새 알림
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 py-3 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={clsx(
                'flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors',
                activeTab === tab.value
                  ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            불러오는 중...
          </div>
        ) : checkIns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
            <p>체크인 알림이 없어요.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-primary-500 text-sm hover:underline"
            >
              + 새 알림 추가하기
            </button>
          </div>
        ) : (
          <div className="space-y-2 pb-8">
            {checkIns.map((checkIn) => (
              <ReminderCard
                key={checkIn.id}
                checkIn={checkIn}
                onDelete={deleteMutation.isPending ? undefined : (id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <ReminderCreateModal onClose={() => setShowCreateModal(false)} />
      )}
    </Layout>
  )
}
