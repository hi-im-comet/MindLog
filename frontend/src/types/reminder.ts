export type CheckInStatus = 'pending' | 'sent' | 'done' | 'snoozed' | 'cancelled'
export type CheckInTone = 'encouraging' | 'gentle' | 'strict'
export type CheckInRecurrence = 'none' | 'daily' | 'weekly'
export type CheckInActionType = 'done' | 'snooze_10' | 'snooze_60' | 'reschedule' | null

export interface CheckIn {
  id: string
  user_id: string
  title: string
  scheduled_at: string
  recurrence: CheckInRecurrence
  tone: CheckInTone
  status: CheckInStatus
  source_entry_id: string | null
  notification_sent_at: string | null
  followup_sent_at: string | null
  snoozed_until: string | null
  messages?: CheckInMessage[]
  created_at: string
  updated_at: string | null
}

export interface CheckInMessage {
  id: string
  check_in_id: string
  role: 'ai' | 'user'
  content: string
  action_type: CheckInActionType
  created_at: string
}

export interface ExtractedTask {
  title: string
  suggested_time: string | null
}

export interface CreateCheckInPayload {
  title: string
  scheduled_at: string
  recurrence?: CheckInRecurrence
  tone?: CheckInTone
  source_entry_id?: string | null
}

export interface UpdateCheckInPayload {
  title?: string
  scheduled_at?: string
  recurrence?: CheckInRecurrence
  tone?: CheckInTone
  status?: CheckInStatus
  snoozed_until?: string | null
}
