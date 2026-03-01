export type AiMood = 'empathy' | 'friend' | 'reflection' | 'objective' | 'advice'
export type ResponseLength = 'short' | 'normal' | 'long'

export interface UserProfile {
  summary: string | null
  known_patterns: string[]
  known_triggers: string[]
  communication_style: string | null
  preferred_response_mode: 'empathetic' | 'advice' | 'pattern_recognition'
  ai_name: string | null
  total_entries: number
  consecutive_days: number
  entry_lock_enabled: boolean
  has_lock_password: boolean
  auto_lock_enabled: boolean
  auto_lock_timeout: number
  daily_lock_enabled: boolean
  last_analysis_at: string | null
  ai_mood_default: AiMood
  ai_response_length_default: ResponseLength
  reminders_enabled: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  daily_message_enabled: boolean
  daily_message_time: string
  week_start_day: number  // 0=월요일 … 6=일요일
}

export interface User {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  timezone: string
  onboarding_completed: boolean
  created_at: string
  profile?: UserProfile
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
  is_new_user?: boolean
}