import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { JournalEntry } from '@/types/entry'
import { clsx } from 'clsx'

const MOOD_EMOJI: Record<number, string> = {
  1: '😭', 2: '😢', 3: '😟', 4: '😕', 5: '😐',
  6: '🙂', 7: '😊', 8: '😄', 9: '😁', 10: '🤩',
}

interface Props {
  entry: JournalEntry
}

export function EntryPreviewCard({ entry }: Props) {
  const navigate = useNavigate()
  const dateLabel = format(new Date(entry.entry_date + 'T00:00:00'), 'M월 d일 EEEE', { locale: ko })

  return (
    <button
      onClick={() => navigate(entry.is_draft ? `/entry/${entry.entry_date}` : `/view/${entry.id}`)}
      className="card p-4 w-full text-left hover:shadow-md transition-shadow duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-400">{dateLabel}</span>
            {entry.is_draft && (
              <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">
                임시저장
              </span>
            )}
          </div>

          {entry.daily_summary ? (
            <p className="text-sm font-medium text-gray-700 line-clamp-2">{entry.daily_summary}</p>
          ) : (
            <p className="text-sm text-gray-500 line-clamp-2">{entry.raw_content}</p>
          )}

          {entry.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat.id}
                  className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5"
                >
                  {cat.icon} {cat.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {entry.mood_score && (
            <span className="text-xl" title={`기분 ${entry.mood_score}/10`}>
              {MOOD_EMOJI[entry.mood_score]}
            </span>
          )}
          {entry.has_conversation && (
            <span className="text-xs text-primary-400">💬</span>
          )}
        </div>
      </div>
    </button>
  )
}
