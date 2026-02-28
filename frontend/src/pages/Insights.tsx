import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '@/components/shared/Layout'
import { PatternCard } from '@/components/insights/PatternCard'
import { patternsApi } from '@/api/patterns'
import { clsx } from 'clsx'
import type { PatternLog } from '@/types/pattern'

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

  // 각 탭별 최신 로그 목록 조회 (최대 5개)
  const { data: weeklyLogs = [], isLoading: weeklyLoading } = useQuery({
    queryKey: ['patterns', 'weekly'],
    queryFn: () => patternsApi.list({ limit: 5, type: 'weekly' }),
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

  // 현재 탭의 로그/로딩 상태
  const currentLogs: PatternLog[] =
    tab === 'weekly' ? weeklyLogs : tab === 'monthly' ? monthlyLogs : semiannualLogs
  const currentLoading =
    tab === 'weekly' ? weeklyLoading : tab === 'monthly' ? monthlyLoading : semiannualLoading

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
        ) : currentLogs.length > 0 ? (
          <div className="space-y-3">
            {currentLogs.map((p, i) => (
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
              {tab === 'weekly' && '이번 주 분석이 아직 없어요.'}
              {tab === 'monthly' && '이번 달 분석이 아직 없어요.'}
              {tab === 'semiannual' && '6개월 분석이 아직 없어요.'}
            </p>
            <p className="text-xs">일기를 작성한 뒤 "지금 분석" 버튼을 눌러보세요.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
