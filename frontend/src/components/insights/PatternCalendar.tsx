import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { clsx } from 'clsx'
import type { PatternLog } from '@/types/pattern'
import type { CalendarDay } from '@/types/entry'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function moodBg(score: number | null | undefined): string {
  if (score == null) return 'bg-gray-300'
  if (score >= 7) return 'bg-green-400'
  if (score >= 4) return 'bg-yellow-400'
  return 'bg-red-400'
}

interface Props {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
  days: CalendarDay[]
  patterns: PatternLog[]
}

export function PatternCalendar({ year, month, onPrev, onNext, days, patterns }: Props) {
  const navigate = useNavigate()
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null)

  const dayMap: Record<string, CalendarDay> = {}
  for (const d of days) dayMap[d.date] = d

  const patternMap: Record<string, PatternLog> = {}
  for (const p of patterns) {
    const dateStr = p.generated_at.slice(0, 10)
    patternMap[dateStr] = p
  }

  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const selectedPattern = patterns.find((p) => p.id === selectedPatternId) ?? null

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-700">
          {format(new Date(year, month - 1, 1), 'yyyy년 M월', { locale: ko })}
        </p>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 text-center">
        {DAY_LABELS.map((d, i) => (
          <p
            key={d}
            className={clsx(
              'text-xs font-medium pb-1',
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400',
            )}
          >
            {d}
          </p>
        ))}

        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const calDay = dayMap[dateStr]
          const pattern = patternMap[dateStr]
          const isToday = dateStr === todayStr
          const hasEntry = !!(calDay?.has_entry)
          const isSelected = pattern?.id === selectedPatternId

          return (
            <button
              key={dateStr}
              onClick={() => {
                if (hasEntry) {
                  // 일기가 있으면 해당 일기로 이동 (draft면 에디터, 완성이면 뷰)
                  if (calDay.is_draft) {
                    navigate(`/entry/${dateStr}`)
                  } else if (calDay.entry_id) {
                    navigate(`/view/${calDay.entry_id}`)
                  } else {
                    navigate(`/entry/${dateStr}`)
                  }
                } else if (pattern) {
                  // 일기 없이 분석만 있는 날: 패턴 카드 토글
                  setSelectedPatternId(isSelected ? null : pattern.id)
                }
              }}
              className={clsx(
                'flex flex-col items-center py-1.5 rounded-lg transition-colors',
                hasEntry ? 'cursor-pointer hover:bg-primary-50' : pattern ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default',
                isSelected && 'bg-primary-50',
              )}
            >
              <span
                className={clsx(
                  'text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium',
                  isToday && 'bg-primary-500 text-white',
                  !isToday && idx % 7 === 0 && 'text-red-400',
                  !isToday && idx % 7 === 6 && 'text-blue-400',
                  !isToday && hasEntry && !isToday && 'text-gray-800 font-semibold',
                  !isToday && !hasEntry && 'text-gray-400',
                )}
              >
                {day}
              </span>

              {hasEntry ? (
                <span className={clsx('w-1.5 h-1.5 rounded-full mt-0.5', moodBg(calDay.mood_score))} />
              ) : (
                <span className="w-1.5 h-1.5 mt-0.5" />
              )}

              {pattern && <span className="text-[10px] leading-none mt-0.5">✨</span>}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> 좋은 날
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 보통
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> 힘든 날
        </span>
        <span>✨ 분석 생성</span>
      </div>

      {/* Selected pattern card */}
      {selectedPattern && (
        <div className="pt-2 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-2">
            {format(new Date(selectedPattern.generated_at), 'M월 d일', { locale: ko })} 분석
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">{selectedPattern.headline}</p>
            <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{selectedPattern.body}</p>
            {selectedPattern.patterns_found.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedPattern.patterns_found.map((p, i) => (
                  <span key={i} className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {patterns.filter((p) => {
        const d = new Date(p.generated_at)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      }).length === 0 && (
        <p className="text-center text-sm text-gray-400 py-2">이 달에 생성된 분석이 없어요</p>
      )}
    </div>
  )
}
