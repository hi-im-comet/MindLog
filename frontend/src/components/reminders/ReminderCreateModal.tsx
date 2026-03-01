import { useState } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { remindersApi } from '@/api/reminders'
import type { CheckInTone, CheckInRecurrence } from '@/types/reminder'

interface ReminderCreateModalProps {
  initialTitle?: string
  sourceEntryId?: string
  onClose: () => void
}

const TONE_OPTIONS: { value: CheckInTone; label: string; desc: string }[] = [
  { value: 'encouraging', label: '응원', desc: '따뜻하게 격려해요' },
  { value: 'gentle', label: '부드러움', desc: '배려하며 확인해요' },
  { value: 'strict', label: '직접적', desc: '간결하게 확인해요' },
]

const RECURRENCE_OPTIONS: { value: CheckInRecurrence; label: string }[] = [
  { value: 'none', label: '한 번만' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
]

export function ReminderCreateModal({
  initialTitle = '',
  sourceEntryId,
  onClose,
}: ReminderCreateModalProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initialTitle)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState('09:00')
  const [tone, setTone] = useState<CheckInTone>('encouraging')
  const [recurrence, setRecurrence] = useState<CheckInRecurrence>('none')

  const createMutation = useMutation({
    mutationFn: () =>
      remindersApi.create({
        title,
        scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
        tone,
        recurrence,
        source_entry_id: sourceEntryId ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      onClose()
    },
  })

  const canSubmit = title.trim() && date && time && !createMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-xl">
        <h3 className="text-base font-bold text-gray-800 mb-4">체크인 알림 추가</h3>

        {/* 제목 */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">할 일</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 보고서 제출하기"
            maxLength={200}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        {/* 날짜/시각 */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-300"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">시각</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary-300"
            />
          </div>
        </div>

        {/* 반복 */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1.5 block">반복</label>
          <div className="flex gap-2">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRecurrence(opt.value)}
                className={clsx(
                  'flex-1 text-xs py-2 rounded-lg border transition-colors',
                  recurrence === opt.value
                    ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 톤 */}
        <div className="mb-6">
          <label className="text-xs text-gray-500 mb-1.5 block">AI 말투</label>
          <div className="flex gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTone(opt.value)}
                className={clsx(
                  'flex-1 text-xs py-2 px-1 rounded-lg border transition-colors',
                  tone === opt.value
                    ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            className={clsx(
              'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors',
              canSubmit
                ? 'bg-primary-500 text-white hover:bg-primary-600'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed',
            )}
          >
            {createMutation.isPending ? '저장 중...' : '추가하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
