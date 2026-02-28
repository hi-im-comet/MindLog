export interface PatternLog {
  id: string
  log_type: 'weekly' | 'monthly' | 'semiannual'
  period_start: string
  period_end: string
  headline: string
  body: string                      // 구버전 호환; 새 로그는 mirror와 동일
  mirror: string | null             // 거울: 판단 없는 관찰
  data_badges: string[]             // 구체적 데이터 포인트
  small_experiment: string | null   // 이번 기간 해볼 작은 실험
  patterns_found: string[]
  safety_content: string | null     // 위기 언어 감지 시에만
  entries_analyzed: number | null
  is_edited: boolean
  generated_at: string
}

export interface MoodDataPoint {
  date: string
  mood: number | null
  energy: number | null
  summary: string | null
}

export interface DistortionStat {
  type: string
  count: number
  percentage: number
}

export interface DayRisk {
  day: string
  avg_mood: number | null
  entry_count: number
}

export interface MoodRatio {
  positive: number
  neutral: number
  negative: number
}

export interface ChangePeriod {
  label: string
  avg_mood: number | null
  avg_sentiment: number | null
  entry_count: number
  mood_ratio: MoodRatio
}

export interface ChangeEvidence {
  recent: ChangePeriod
  old: ChangePeriod
}

export interface TimePattern {
  hour: number
  entry_count: number
  avg_mood: number | null
}

export interface InsightsData {
  profile: {
    summary: string | null
    known_patterns: string[]
    known_triggers: string[]
    communication_style: string | null
    preferred_response_mode: string
    total_entries: number
  } | null
  mood_data: MoodDataPoint[]
  stats: {
    total_entries_30d: number
    avg_mood_30d: number | null
  }
  latest_pattern: PatternLog | null
  distortion_stats: DistortionStat[]
  day_risk: DayRisk[]
  change_evidence: ChangeEvidence
  time_patterns: TimePattern[]
}
