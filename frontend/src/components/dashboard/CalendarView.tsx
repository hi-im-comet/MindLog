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

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarView() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  const { data } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => entriesApi.calendar(year, month),
  })

  const days: CalendarDay[] = data?.days || []
  const firstDayOfWeek = getDay(startOfMonth(currentMonth)) // 0=Sun

  const handleDayClick = (day: CalendarDay) => {
    navigate(`/entry/${day.date}`)
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
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">
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
                'aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all',
                isFuture
                  ? 'text-gray-200 cursor-default'
                  : day.has_entry
                    ? clsx(
                        'hover:opacity-80 cursor-pointer',
                        day.mood_score ? MOOD_BG[day.mood_score] : 'bg-primary-50',
                        'text-gray-700'
                      )
                    : 'hover:bg-gray-50 text-gray-400 cursor-pointer',
                isToday && 'ring-2 ring-primary-400 ring-offset-1'
              )}
              title={day.has_entry && day.summary ? day.summary : undefined}
            >
              {d.getDate()}
              {day.has_entry && (
                <span className="w-1 h-1 rounded-full bg-primary-400 mt-0.5" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
