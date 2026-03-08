import { useState } from 'react'
import { format, addMonths, subMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { entriesApi } from '@/api/entries'
import { CalendarDay } from '@/types/entry'

const MOOD_BG: Record<number, string> = {
  1: 'bg-red-200',
  2: 'bg-red-100',
  3: 'bg-orange-100',
  4: 'bg-orange-50',
  5: 'bg-yellow-50',
  6: 'bg-lime-50',
  7: 'bg-green-100',
  8: 'bg-green-200',
  9: 'bg-emerald-200',
  10: 'bg-emerald-300',
}

// 일요일 기준 순서 (JS getDay() 규칙)
const DAY_LABELS_BASE = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarView({ weekStartDay = 0 }: { weekStartDay?: number }) {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  const { data } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => entriesApi.calendar(year, month),
  })

  const days: CalendarDay[] = data?.days || []

  // week_start_day(0=월…6=일) → JS getDay()(0=일…6=토) 변환
  const jsWeekStart = (weekStartDay + 1) % 7
  const dayLabels = [...DAY_LABELS_BASE.slice(jsWeekStart), ...DAY_LABELS_BASE.slice(0, jsWeekStart)]
  const firstDayOfWeek = (getDay(startOfMonth(currentMonth)) - jsWeekStart + 7) % 7

  const handleDayClick = (day: CalendarDay) => {
    if (day.has_entry && !day.is_draft && day.entry_id) {
      navigate(`/view/${day.entry_id}`)
    } else {
      navigate(`/entry/${day.date}`)
    }
  }

  return (
    <div className="card p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          ←
        </button>
        <h3 className="font-semibold text-gray-800">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h3>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          disabled={currentMonth >= new Date()}
        >
          →
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const d = new Date(day.date + 'T00:00:00')
          const isToday = day.date === format(new Date(), 'yyyy-MM-dd')
          const isFuture = d > new Date()

          return (
            <button
              key={day.date}
              disabled={isFuture}
              onClick={() => handleDayClick(day)}
              className={clsx(
                'group aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all',
                isFuture
                  ? 'text-gray-200 cursor-default'
                  : day.has_entry
                    ? clsx(
                        'hover:opacity-80 cursor-pointer',
                        day.mood_score ? MOOD_BG[day.mood_score] : 'bg-primary-50',
                        'text-gray-700'
                      )
                    : 'hover:bg-primary-50 hover:text-primary-500 text-gray-300 cursor-pointer',
                isToday && 'ring-2 ring-primary-400 ring-offset-1'
              )}
              title={
                isFuture ? undefined
                : day.has_entry && day.summary ? day.summary
                : !day.has_entry ? '이 날 대화 시작하기'
                : undefined
              }
            >
              {d.getDate()}
              {day.has_entry ? (
                <span className="w-1 h-1 rounded-full bg-primary-400 mt-0.5" />
              ) : !isFuture ? (
                <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 bg-primary-300 mt-0.5 transition-opacity" />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
