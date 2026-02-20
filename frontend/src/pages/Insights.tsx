import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '@/components/shared/Layout'
import { PatternCard } from '@/components/insights/PatternCard'
import { PatternCalendar } from '@/components/insights/PatternCalendar'
import { patternsApi } from '@/api/patterns'
import { entriesApi } from '@/api/entries'
import { clsx } from 'clsx'
import type { DistortionStat, DayRisk, ChangeEvidence, TimePattern } from '@/types/pattern'

type Tab = 'overview' | 'patterns'

const DISTORTION_DESC: Record<string, string> = {
  흑백논리: '전부 아니면 전무',
  과잉일반화: '하나로 모두 판단',
  부정적필터링: '나쁜 것만 보기',
  긍정무시: '좋은 것 깎아내리기',
  마음읽기: '상대 생각 단정짓기',
  예언적사고: '나쁜 미래 확신하기',
  확대축소: '과장하거나 축소하기',
  감정적추론: '기분이 사실이라고 믿기',
  당위적사고: '~해야 한다는 강박',
  꼬리표붙이기: '자신에 부정적 낙인',
}

function dayMoodColor(score: number | null): string {
  if (score == null) return 'bg-gray-100 text-gray-400'
  if (score >= 7) return 'bg-green-100 text-green-700'
  if (score >= 4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-600'
}

function hourLabel(h: number): string {
  if (h < 6) return '새벽'
  if (h < 12) return '오전'
  if (h < 18) return '오후'
  return '밤'
}

function hourBg(avgMood: number | null): string {
  if (avgMood == null) return 'bg-blue-100'
  if (avgMood >= 7) return 'bg-green-200'
  if (avgMood >= 4) return 'bg-yellow-200'
  return 'bg-red-200'
}

const AI_INTERVENTION_KEY = 'mindlog-ai-intervention'

export function Insights() {
  const [tab, setTab] = useState<Tab>('overview')
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1)
  const [aiIntervention, setAiIntervention] = useState(
    () => localStorage.getItem(AI_INTERVENTION_KEY) === 'true',
  )
  const queryClient = useQueryClient()

  const { data: insights, isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: patternsApi.insights,
    staleTime: 1000 * 60 * 5,
  })

  const { data: patterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ['patterns', 'all'],
    queryFn: () => patternsApi.list({ limit: 50 }),
    enabled: tab === 'patterns',
    staleTime: 1000 * 60 * 5,
  })

  const { data: calendarData } = useQuery({
    queryKey: ['calendar', calendarYear, calendarMonth],
    queryFn: () => entriesApi.calendar(calendarYear, calendarMonth),
    enabled: tab === 'patterns',
    staleTime: 1000 * 60 * 5,
  })

  const generateMutation = useMutation({
    mutationFn: () => patternsApi.generate(7),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.invalidateQueries({ queryKey: ['patterns'] })
    },
  })

  const updatePatternMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => patternsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.invalidateQueries({ queryKey: ['patterns'] })
    },
  })

  const deletePatternMutation = useMutation({
    mutationFn: (id: string) => patternsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.invalidateQueries({ queryKey: ['patterns'] })
    },
  })

  const handlePatternUpdate = (id: string, body: string) => updatePatternMutation.mutate({ id, body })
  const handlePatternDelete = (id: string) => deletePatternMutation.mutate(id)

  const handlePrevMonth = () => {
    if (calendarMonth === 1) { setCalendarYear((y) => y - 1); setCalendarMonth(12) }
    else setCalendarMonth((m) => m - 1)
  }

  const handleNextMonth = () => {
    const now = new Date()
    if (calendarYear > now.getFullYear() || (calendarYear === now.getFullYear() && calendarMonth >= now.getMonth() + 1)) return
    if (calendarMonth === 12) { setCalendarYear((y) => y + 1); setCalendarMonth(1) }
    else setCalendarMonth((m) => m + 1)
  }

  const toggleAiIntervention = () => {
    const next = !aiIntervention
    setAiIntervention(next)
    localStorage.setItem(AI_INTERVENTION_KEY, String(next))
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>불러오는 중...</p>
        </div>
      </Layout>
    )
  }

  const profile = insights?.profile
  const stats = insights?.stats
  const latestPattern = insights?.latest_pattern
  const distortionStats: DistortionStat[] = insights?.distortion_stats ?? []
  const dayRisk: DayRisk[] = insights?.day_risk ?? []
  const changeEvidence: ChangeEvidence | undefined = insights?.change_evidence
  const timePatterns: TimePattern[] = insights?.time_patterns ?? []
  const totalConversations = stats?.total_entries_30d ?? 0

  // 취약 시간대: 기록 수 ≥2 이고 avg_mood가 낮은 순
  const vulnerableHours = [...timePatterns]
    .filter((t) => t.entry_count >= 2)
    .sort((a, b) => (a.avg_mood ?? 5) - (b.avg_mood ?? 5))
    .slice(0, 3)

  const errorMsg =
    (generateMutation.error as any)?.response?.data?.error ??
    '분석 생성에 실패했어요. 대화가 부족할 수 있어요.'

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">인사이트</h2>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              generateMutation.isPending
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary-50 text-primary-600 hover:bg-primary-100',
            )}
          >
            {generateMutation.isPending ? '분석 중...' : '✨ 새 분석 생성'}
          </button>
        </div>

        {generateMutation.isError && (
          <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</div>
        )}
        {generateMutation.isSuccess && (
          <div className="text-xs text-primary-600 bg-primary-50 rounded-lg px-3 py-2">
            분석이 완료됐어요! 아래에서 확인해보세요.
          </div>
        )}

        {/* Stats */}
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-primary-600">{totalConversations}</p>
          <p className="text-xs text-gray-400 mt-0.5">최근 30일의 나</p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
          {(['overview', 'patterns'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {t === 'overview' ? '나의 패턴' : '변화 로그'}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {tab === 'overview' && (
          <div className="space-y-5">

            {/* ① 변화의 증거 */}
            {changeEvidence && (changeEvidence.recent.entry_count > 0 || changeEvidence.old.entry_count > 0) && (
              <section className="card p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">변화의 증거</p>
                <div className="grid grid-cols-2 gap-3">
                  {[changeEvidence.old, changeEvidence.recent].map((period, i) => {
                    const isRecent = i === 1
                    const hasData = period.entry_count > 0
                    return (
                      <div
                        key={period.label}
                        className={clsx(
                          'rounded-xl p-3 space-y-2',
                          isRecent ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50',
                        )}
                      >
                        <p className={clsx('text-xs font-medium', isRecent ? 'text-primary-600' : 'text-gray-500')}>
                          {period.label}
                        </p>
                        {hasData ? (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className={clsx('text-2xl font-bold', isRecent ? 'text-primary-600' : 'text-gray-500')}>
                                {period.avg_mood ?? '—'}
                              </span>
                              <span className="text-xs text-gray-400">/ 10</span>
                            </div>
                            <p className="text-xs text-gray-400">평균 기분점수</p>
                            <div className="flex h-2 rounded-full overflow-hidden gap-px">
                              <div className="bg-red-300" style={{ width: `${period.mood_ratio.negative}%` }} />
                              <div className="bg-yellow-300" style={{ width: `${period.mood_ratio.neutral}%` }} />
                              <div className="bg-green-400" style={{ width: `${period.mood_ratio.positive}%` }} />
                            </div>
                            <div className="flex gap-2 text-[10px] text-gray-400">
                              <span>😊 {period.mood_ratio.positive}%</span>
                              <span>😐 {period.mood_ratio.neutral}%</span>
                              <span>😔 {period.mood_ratio.negative}%</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">기록 없음</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {changeEvidence.recent.avg_mood != null && changeEvidence.old.avg_mood != null && (
                  <p className="text-xs text-gray-500 text-center pt-1">
                    {changeEvidence.recent.avg_mood > changeEvidence.old.avg_mood
                      ? `🌱 ${(changeEvidence.recent.avg_mood - changeEvidence.old.avg_mood).toFixed(1)}점 좋아졌어요`
                      : changeEvidence.recent.avg_mood < changeEvidence.old.avg_mood
                      ? `📉 ${(changeEvidence.old.avg_mood - changeEvidence.recent.avg_mood).toFixed(1)}점 낮아졌어요. 조금 더 돌봐주세요.`
                      : '변화 없이 비슷한 상태예요'}
                  </p>
                )}
              </section>
            )}

            {/* ② AI가 파악한 나 */}
            {profile && (profile.known_patterns.length > 0 || profile.known_triggers.length > 0) && (
              <section className="card p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI가 파악한 나</p>
                {profile.summary && (
                  <p className="text-sm text-gray-600 leading-relaxed">{profile.summary}</p>
                )}
                {profile.known_patterns.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-400">반복 패턴</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.known_patterns.map((p, i) => (
                        <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.known_triggers.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-400">알려진 트리거</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.known_triggers.map((t, i) => (
                        <span key={i} className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.communication_style && (
                  <p className="text-xs text-gray-400 italic border-t border-gray-50 pt-2">
                    "{profile.communication_style}"
                  </p>
                )}
              </section>
            )}

            {/* ③ 인지 왜곡 통계 */}
            {distortionStats.length > 0 && (
              <section className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">인지 왜곡 패턴</p>
                  <span className="text-xs text-gray-400">최근 30일</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  대화에서 감지된 사고 패턴이에요. 인식하는 것만으로도 도움이 됩니다.
                </p>
                <div className="space-y-2.5">
                  {distortionStats.map((d) => (
                    <div key={d.type} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm font-medium text-gray-700">{d.type}</span>
                          {DISTORTION_DESC[d.type] && (
                            <span className="text-xs text-gray-400 ml-1.5">· {DISTORTION_DESC[d.type]}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{d.count}회 ({d.percentage}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-300 rounded-full"
                          style={{ width: `${d.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ④ 요일별 기분 위험도 */}
            {dayRisk.some((d) => d.entry_count > 0) && (
              <section className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">요일별 기분</p>
                  <span className="text-xs text-gray-400">최근 30일</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {dayRisk.map((d) => (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{d.day}</span>
                      <div
                        className={clsx(
                          'w-full rounded-lg py-2 text-center',
                          d.entry_count > 0 ? dayMoodColor(d.avg_mood) : 'bg-gray-50 text-gray-300',
                        )}
                      >
                        <span className="text-xs font-bold">
                          {d.avg_mood != null ? d.avg_mood : '—'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-300">{d.entry_count > 0 ? `${d.entry_count}일` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-100 inline-block" /> ≤3</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-100 inline-block" /> 4-6</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-100 inline-block" /> ≥7</span>
                </div>
              </section>
            )}

            {/* ⑤ 취약 시간대 + AI 개입 토글 */}
            {timePatterns.length > 0 && (
              <section className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">취약 시간대</p>
                  <span className="text-xs text-gray-400">최근 90일</span>
                </div>

                {/* 24시간 히트맵 */}
                <div className="flex gap-0.5 flex-wrap">
                  {Array.from({ length: 24 }, (_, h) => {
                    const tp = timePatterns.find((t) => t.hour === h)
                    return (
                      <div
                        key={h}
                        title={`${h}시${tp ? ` (${tp.entry_count}회, 기분 ${tp.avg_mood ?? '—'})` : ''}`}
                        className={clsx(
                          'w-6 h-6 rounded text-[9px] flex items-center justify-center font-medium cursor-default',
                          tp && tp.entry_count > 0 ? hourBg(tp.avg_mood) : 'bg-gray-50 text-gray-300',
                          tp && tp.entry_count > 0 ? 'text-gray-600' : '',
                        )}
                      >
                        {h}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200 inline-block" /> 좋음</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-200 inline-block" /> 보통</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-200 inline-block" /> 힘듦</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-100 inline-block" /> 기분 미기록</span>
                </div>

                {/* 가장 취약한 시간 */}
                {vulnerableHours.length > 0 && (
                  <div className="bg-orange-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-medium text-orange-700">가장 힘든 시간대</p>
                    <div className="flex flex-wrap gap-2">
                      {vulnerableHours.map((t) => (
                        <span key={t.hour} className="text-xs text-orange-600 bg-white px-2 py-0.5 rounded-full border border-orange-100">
                          {t.hour}시 ({hourLabel(t.hour)}){t.avg_mood != null && ` · ${t.avg_mood}점`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 개입 토글 */}
                <div className="flex items-center justify-between bg-primary-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-primary-700">취약 시간 AI 알림</p>
                    <p className="text-xs text-primary-400 mt-0.5">
                      {aiIntervention
                        ? '힘든 시간대에 AI가 더 세심하게 들을게요 💙'
                        : '켜두면 힘든 시간대에 AI가 먼저 말을 걸어요'}
                    </p>
                  </div>
                  <button
                    onClick={toggleAiIntervention}
                    className={clsx(
                      'relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0',
                      aiIntervention ? 'bg-primary-500' : 'bg-gray-200',
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                        aiIntervention ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>
              </section>
            )}

            {/* ⑥ 최근 패턴 분석 */}
            {latestPattern && (
              <section className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">최근 패턴 분석</p>
                <PatternCard
                  pattern={latestPattern}
                  defaultExpanded={true}
                  onUpdate={handlePatternUpdate}
                  onDelete={handlePatternDelete}
                />
              </section>
            )}

            {!latestPattern && totalConversations >= 1 && (
              <div className="card p-5 text-center text-gray-400 space-y-2">
                <p className="text-sm">아직 패턴 분석이 없어요.</p>
                <p className="text-xs">위의 "✨ 새 분석 생성" 버튼을 눌러 시작해보세요.</p>
              </div>
            )}

            {totalConversations === 0 && (
              <div className="card p-5 text-center text-gray-400 space-y-1">
                <p className="text-sm">아직 마무리한 대화가 없어요.</p>
                <p className="text-xs">대화를 나누고 "기록 마치기"를 누르면 분석이 가능해요.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Patterns (calendar) tab ── */}
        {tab === 'patterns' && (
          <div className="space-y-4">
            <div className="card p-4">
              {patternsLoading ? (
                <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
              ) : (
                <PatternCalendar
                  year={calendarYear}
                  month={calendarMonth}
                  onPrev={handlePrevMonth}
                  onNext={handleNextMonth}
                  days={calendarData?.days ?? []}
                  patterns={patterns}
                />
              )}
            </div>

            {patterns.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">변화 로그 목록</p>
                {patterns.map((p) => (
                  <PatternCard
                    key={p.id}
                    pattern={p}
                    onUpdate={handlePatternUpdate}
                    onDelete={handlePatternDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
