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
  last_analysis_at: string | null
  ai_mood_default: string
  ai_response_length_default: string
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
