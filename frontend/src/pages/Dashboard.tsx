import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Layout } from '@/components/shared/Layout'
import { CalendarView } from '@/components/dashboard/CalendarView'
import { EntryPreviewCard } from '@/components/dashboard/EntryPreviewCard'
import { useAuthStore } from '@/store/authStore'
import { entriesApi } from '@/api/entries'
import { usersApi } from '@/api/users'
import { dailyMessagesApi } from '@/api/dailyMessages'
import { iwa, ga } from '@/utils/josa'

function DashboardSkeleton() {
  return (
    <Layout>
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 bg-gray-100 rounded-xl w-52" />
          <div className="h-4 bg-gray-100 rounded-xl w-36" />
        </div>
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded-xl w-20" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
    </Layout>
  )
}

function StreakBadge({ days }: { days: number }) {
  if (days <= 0) return null

  if (days >= 3) {
    const icon = days >= 30 ? '🏆' : days >= 14 ? '🔥' : days >= 7 ? '⭐' : '🎉'
    const message =
      days >= 30
        ? '한 달 이상 이어졌어요!'
        : days >= 14
        ? '2주 연속이에요!'
        : days >= 7
        ? '일주일 연속이에요!'
        : '3일 연속이에요!'
    const colorClass =
      days >= 14
        ? 'from-amber-50 to-orange-50 border-amber-100'
        : 'from-primary-50 to-violet-50 border-primary-100'

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className={clsx('card p-4 flex items-center gap-3 bg-gradient-to-r border', colorClass)}
      >
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{days}일 연속 기록 중!</p>
          <p className="text-xs text-gray-500 mt-0.5">{message} 대단해요 👏</p>
        </div>
      </motion.div>
    )
  }

  return <p className="text-xs text-primary-400 -mt-2">🌱 {days}일째 기록 중</p>
}

export function Dashboard() {
  const { user, updateUser } = useAuthStore()
  const aiName = user?.profile?.ai_name
  const streakDays = user?.profile?.consecutive_days ?? 0
  const navigate = useNavigate()

  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearchQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(value.trim()), 400)
  }

  // 대시보드 진입 시마다 프로필 새로고침 → 스트릭 최신화
  useEffect(() => {
    usersApi.getMe().then((fresh) => {
      updateUser({ profile: fresh.profile })
    }).catch(() => {})
  }, [])
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'M월 d일', { locale: ko })

  const queryClient = useQueryClient()
  const todayFavMutation = useMutation({
    mutationFn: (entryId: string) => entriesApi.toggleFavorite(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })

  const { data: dailyMsg } = useQuery({
    queryKey: ['daily-message', 'today'],
    queryFn: dailyMessagesApi.getToday,
    staleTime: 1000 * 60 * 10,
  })

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['entries', debouncedQ, showFavoritesOnly],
    queryFn: ({ pageParam = 1 }) => entriesApi.list({
      page: pageParam as number,
      limit: 10,
      q: debouncedQ || undefined,
      is_favorite: showFavoritesOnly || undefined,
    }),
    getNextPageParam: (last, pages) =>
      last.pagination.page < last.pagination.total_pages ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })

  if (isLoading) return <DashboardSkeleton />

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

        {/* Daily message */}
        {dailyMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100"
          >
            <p className="text-xs font-medium text-violet-500 mb-1">✨ 오늘의 메시지</p>
            <p className="text-sm text-gray-700 leading-relaxed">{dailyMsg.content}</p>
          </motion.div>
        )}

        {/* Streak badge */}
        <StreakBadge days={streakDays} />

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
                  {aiName
                    ? `${aiName}${ga(aiName)} 오늘 이야기를 기다리고 있어요`
                    : 'AI가 당신의 이야기를 기다리고 있어요'}
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => todayFavMutation.mutate(todayEntry.id)}
              disabled={todayFavMutation.isPending}
              className="absolute top-3 right-3 z-10 text-base disabled:opacity-50"
              title={todayEntry.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              {todayEntry.is_favorite ? '⭐' : '☆'}
            </button>
            <button
              onClick={() =>
                navigate(
                  todayEntry.is_draft
                    ? `/entry/${todayEntry.entry_date}`
                    : `/view/${todayEntry.id}`,
                )
              }
              className="w-full card p-5 text-left hover:shadow-md transition-shadow pr-12"
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
                {todayEntry.is_locked && (
                  <span className="text-xs text-gray-400" title="잠긴 일기">🔒</span>
                )}
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {todayEntry.is_locked
                  ? '비밀번호로 보호된 일기예요'
                  : todayEntry.daily_summary || todayEntry.raw_content}
              </p>
            </button>
          </div>
        )}

        {/* Calendar */}
        <CalendarView weekStartDay={user?.profile?.week_start_day ?? 0} />

        {/* Search + filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
              <input
                type="text"
                value={searchQ}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="일기 검색..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 bg-white"
              />
              {searchQ && (
                <button
                  onClick={() => { setSearchQ(''); setDebouncedQ('') }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFavoritesOnly((v) => !v)}
              className={clsx(
                'px-3 py-2 rounded-xl text-sm border transition-all whitespace-nowrap',
                showFavoritesOnly
                  ? 'border-amber-300 bg-amber-50 text-amber-600'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              )}
              title="즐겨찾기만 보기"
            >
              {showFavoritesOnly ? '⭐ 즐겨찾기' : '☆ 즐겨찾기'}
            </button>
          </div>
        </div>

        {/* Recent entries */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">
            {debouncedQ ? `"${debouncedQ}" 검색 결과` : showFavoritesOnly ? '즐겨찾기' : '최근 대화'}
          </h3>
          {allEntries.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">{debouncedQ || showFavoritesOnly ? '🔍' : '💬'}</p>
              <p className="text-sm">
                {debouncedQ ? '검색 결과가 없어요' : showFavoritesOnly ? '즐겨찾기한 일기가 없어요' : '아직 대화가 없어요'}
              </p>
            </div>
          ) : (
            <>
              {allEntries
                .filter((e) => debouncedQ || showFavoritesOnly ? true : e.entry_date !== today)
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
