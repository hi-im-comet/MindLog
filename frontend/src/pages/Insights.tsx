import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '@/components/shared/Layout'
import { PatternCard } from '@/components/insights/PatternCard'
import { patternsApi } from '@/api/patterns'
import { entriesApi } from '@/api/entries'
import { clsx } from 'clsx'
import type { PatternLog, WeeklySummaryResponse } from '@/types/pattern'

type LogTab = 'weekly' | 'monthly' | 'semiannual'

const TAB_LABELS: Record<LogTab, string> = {
  weekly: '주간',
  monthly: '월간',
  semiannual: '6개월',
}

const TAB_DESCRIPTIONS: Record<LogTab, string> = {
  weekly: '이번 주 거울',
  monthly: '이번 달 흐름',
  semiannual: '6개월 심층 패턴',
}

export function Insights() {
  const [tab, setTab] = useState<LogTab>('weekly')
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // 주간: 새 canonical 전용 엔드포인트 사용
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery<WeeklySummaryResponse>({
    queryKey: ['patterns', 'weekly'],
    queryFn: () => patternsApi.getWeekly(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: monthlyLogs = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['patterns', 'monthly'],
    queryFn: () => patternsApi.list({ limit: 5, type: 'monthly' }),
    enabled: tab === 'monthly',
    staleTime: 1000 * 60 * 5,
  })

  const { data: semiannualLogs = [], isLoading: semiannualLoading } = useQuery({
    queryKey: ['patterns', 'semiannual'],
    queryFn: () => patternsApi.list({ limit: 5, type: 'semiannual' }),
    enabled: tab === 'semiannual',
    staleTime: 1000 * 60 * 5,
  })

  const generateMutation = useMutation({
    mutationFn: (periodType: LogTab) => patternsApi.generate(periodType),
    onSuccess: (_data, periodType) => {
      queryClient.invalidateQueries({ queryKey: ['patterns', periodType] })
    },
  })

  const updatePatternMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => patternsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] })
    },
  })

  const deletePatternMutation = useMutation({
    mutationFn: (id: string) => patternsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] })
    },
  })

  const handlePatternUpdate = (id: string, body: string) => updatePatternMutation.mutate({ id, body })
  const handlePatternDelete = (id: string) => deletePatternMutation.mutate(id)

  // 태그별 날짜 목록
  const { data: allEntriesData } = useQuery({
    queryKey: ['entries-for-tags'],
    queryFn: () => entriesApi.list({ limit: 200, page: 1 }),
    staleTime: 1000 * 60 * 2,
  })

  const { tagMap, tagList } = useMemo(() => {
    const map: Record<string, Array<{ date: string; id: string }>> = {}
    for (const entry of allEntriesData?.entries ?? []) {
      for (const tag of entry.tags ?? []) {
        if (!map[tag]) map[tag] = []
        map[tag].push({ date: entry.entry_date, id: entry.id })
      }
    }
    return { tagMap: map, tagList: Object.keys(map).sort() }
  }, [allEntriesData])

  // 현재 탭의 로딩 상태
  const currentLoading =
    tab === 'weekly' ? weeklyLoading : tab === 'monthly' ? monthlyLoading : semiannualLoading

  // 월간/6개월 탭용 로그 배열
  const currentNonWeeklyLogs: PatternLog[] =
    tab === 'monthly' ? monthlyLogs : semiannualLogs

  const errorMsg =
    (generateMutation.error as any)?.response?.data?.error ??
    '이 기간에 일기가 없거나 분석에 실패했어요.'

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800">변화로그</h2>

        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
          {(['weekly', 'monthly', 'semiannual'] as LogTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 탭 설명 + 분석 생성 버튼 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{TAB_DESCRIPTIONS[tab]}</p>
          <button
            onClick={() => generateMutation.mutate(tab)}
            disabled={generateMutation.isPending}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              generateMutation.isPending
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary-50 text-primary-600 hover:bg-primary-100',
            )}
          >
            {generateMutation.isPending ? '분석 중...' : '✨ 지금 분석'}
          </button>
        </div>

        {/* 피드백 */}
        {generateMutation.isError && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</div>
        )}
        {generateMutation.isSuccess && (
          <div className="text-xs text-primary-600 bg-primary-50 rounded-lg px-3 py-2">
            분석이 완료됐어요!
          </div>
        )}

        {/* 로그 목록 */}
        {currentLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-gray-100 rounded-2xl" />
            <div className="h-20 bg-gray-100 rounded-2xl" />
          </div>
        ) : tab === 'weekly' ? (
          /* 주간 탭: this_week + past_weeks (각 캘린더 주 정확히 1개) */
          <div className="space-y-3">
            {weeklyData?.this_week ? (
              <PatternCard
                key={weeklyData.this_week.id}
                pattern={weeklyData.this_week}
                defaultExpanded={true}
                onUpdate={handlePatternUpdate}
                onDelete={handlePatternDelete}
              />
            ) : (
              <div className="card p-6 text-center text-gray-400 space-y-2">
                <p className="text-sm">이번 주 분석이 아직 없어요.</p>
                <p className="text-xs">일기를 작성한 뒤 "지금 분석" 버튼을 눌러보세요.</p>
              </div>
            )}
            {(weeklyData?.past_weeks ?? []).length > 0 && (
              <>
                <p className="text-xs text-gray-400 pt-1">지난 주간 기록</p>
                {weeklyData!.past_weeks.map((p) => (
                  <PatternCard
                    key={p.id}
                    pattern={p}
                    defaultExpanded={false}
                    onUpdate={handlePatternUpdate}
                    onDelete={handlePatternDelete}
                  />
                ))}
              </>
            )}
          </div>
        ) : currentNonWeeklyLogs.length > 0 ? (
          <div className="space-y-3">
            {currentNonWeeklyLogs.map((p, i) => (
              <PatternCard
                key={p.id}
                pattern={p}
                defaultExpanded={i === 0}
                onUpdate={handlePatternUpdate}
                onDelete={handlePatternDelete}
              />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-gray-400 space-y-2">
            <p className="text-sm">
              {tab === 'monthly' && '이번 달 분석이 아직 없어요.'}
              {tab === 'semiannual' && '6개월 분석이 아직 없어요.'}
            </p>
            <p className="text-xs">일기를 작성한 뒤 "지금 분석" 버튼을 눌러보세요.</p>
          </div>
        )}
        {/* 태그별 날짜 목록 */}
        {tagList.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-gray-700">태그별 기록</h3>
            {tagList.map((tag) => (
              <div key={tag} className="card p-4">
                <p className="text-xs font-medium text-gray-500 mb-2.5">#{tag}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tagMap[tag].map(({ date, id }) => (
                    <button
                      key={id}
                      onClick={() => navigate(`/view/${id}`)}
                      className="text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-full px-2.5 py-1 transition-colors"
                    >
                      {format(new Date(date + 'T00:00:00'), 'M.d (EEE)', { locale: ko })}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
