import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { JournalEntry } from '@/types/entry'
import { entriesApi } from '@/api/entries'

const MOOD_EMOJI: Record<number, string> = {
  1: '😭', 2: '😢', 3: '😟', 4: '😕', 5: '😐',
  6: '🙂', 7: '😊', 8: '😄', 9: '😁', 10: '🤩',
}

interface Props {
  entry: JournalEntry
}

export function EntryPreviewCard({ entry }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dateLabel = format(new Date(entry.entry_date + 'T00:00:00'), 'M월 d일 EEEE', { locale: ko })

  const favMutation = useMutation({
    mutationFn: () => entriesApi.toggleFavorite(entry.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })

  return (
    <div className="card p-4 w-full hover:shadow-md transition-shadow duration-150 relative">
      {/* 별 버튼 - 절대 위치로 항상 클릭 가능 */}
      <button
        onClick={() => favMutation.mutate()}
        disabled={favMutation.isPending}
        className="absolute top-3 right-3 z-10 text-base disabled:opacity-50"
        title={entry.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
      >
        {entry.is_favorite ? '⭐' : '☆'}
      </button>

      {/* 내비게이션 버튼 - 별 버튼과 겹치지 않도록 오른쪽 패딩 */}
      <button
        className="w-full text-left pr-8"
        onClick={() => navigate(entry.is_draft ? `/entry/${entry.entry_date}` : `/view/${entry.id}`)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-gray-400">{dateLabel}</span>
              {entry.is_draft && (
                <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">
                  임시저장
                </span>
              )}
              {entry.is_locked && (
                <span className="text-xs text-gray-400" title="잠긴 일기">🔒</span>
              )}
            </div>

            {entry.is_locked ? (
              <p className="text-sm text-gray-400 italic">비밀번호로 보호된 일기예요</p>
            ) : entry.daily_summary ? (
              <p className="text-sm font-medium text-gray-700 line-clamp-2">{entry.daily_summary}</p>
            ) : (
              <p className="text-sm text-gray-500 line-clamp-2">{entry.raw_content}</p>
            )}

            {entry.tags && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-primary-600 bg-primary-50 rounded-full px-2 py-0.5"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {entry.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
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

          <div className="flex flex-col items-end gap-2 shrink-0 pr-6">
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
    </div>
  )
}
