import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Layout } from '@/components/shared/Layout'
import { CalendarView } from '@/components/dashboard/CalendarView'
import { EntryPreviewCard } from '@/components/dashboard/EntryPreviewCard'
import { useAuthStore } from '@/store/authStore'
import { entriesApi } from '@/api/entries'
import { iwa, ga } from '@/utils/josa'

export function Dashboard() {
  const { user } = useAuthStore()
  const aiName = user?.profile?.ai_name
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'M월 d일', { locale: ko })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['entries'],
    queryFn: ({ pageParam = 1 }) => entriesApi.list({ page: pageParam as number, limit: 10 }),
    getNextPageParam: (last, pages) =>
      last.pagination.page < last.pagination.total_pages ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })

  const allEntries = data?.pages.flatMap((p) => p.entries) ?? []
  const todayEntry = allEntries.find((e) => e.entry_date === today)

  return (
    <Layout>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            안녕하세요, {user?.display_name}님 👋
          </h2>
          <p className="text-gray-500 mt-1 text-sm">{todayLabel} · 오늘 어떠셨나요?</p>
        </div>

        {/* Today CTA */}
        {!todayEntry ? (
          <button
            onClick={() => navigate(`/entry/${today}`)}
            className="w-full card p-5 text-left border-2 border-dashed border-primary-200 hover:border-primary-400 hover:bg-primary-50 transition-all duration-150 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                ✏️
              </div>
              <div>
                <p className="font-semibold text-gray-700">
                  {aiName ? `"${aiName}"${iwa(aiName)} 대화하기` : '오늘 대화 시작하기'}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {aiName ? `${aiName}${ga(aiName)} 오늘 이야기를 기다리고 있어요` : 'AI가 당신의 이야기를 기다리고 있어요'}
                </p>
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate(todayEntry.is_draft ? `/entry/${todayEntry.entry_date}` : `/view/${todayEntry.id}`)}
            className="w-full card p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                오늘
              </span>
              {todayEntry.is_draft && (
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                  임시저장
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {todayEntry.daily_summary || todayEntry.raw_content}
            </p>
          </button>
        )}

        {/* Calendar */}
        <CalendarView />

        {/* Recent entries */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">최근 대화</h3>
          {allEntries.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm">아직 대화가 없어요</p>
            </div>
          ) : (
            <>
              {allEntries
                .filter((e) => e.entry_date !== today)
                .map((entry) => (
                  <EntryPreviewCard key={entry.id} entry={entry} />
                ))}
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-3 transition-colors"
                >
                  {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
