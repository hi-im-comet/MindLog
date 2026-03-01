import { apiClient } from './client'
import type { User } from '@/types/user'

export interface UpdateMePayload {
  display_name?: string
  timezone?: string
  ai_name?: string | null
  auto_lock_enabled?: boolean
  auto_lock_timeout?: number
  ai_mood_default?: string
  ai_response_length_default?: string
  reminders_enabled?: boolean
  quiet_hours_start?: number | null
  quiet_hours_end?: number | null
  daily_message_enabled?: boolean
  daily_message_time?: string
  week_start_day?: number
}

export const usersApi = {
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get('/api/users/me')
    return data.data.user
  },

  updateMe: async (payload: UpdateMePayload): Promise<User> => {
    const { data } = await apiClient.patch('/api/users/me', payload)
    return data.data.user
  },

  setupLock: async (password: string): Promise<User> => {
    const { data } = await apiClient.post('/api/users/me/setup-lock', { password })
    return data.data.user
  },

  disableLock: async (password: string, clearEntries = false): Promise<User> => {
    const { data } = await apiClient.post('/api/users/me/disable-lock', {
      password,
      clear_entries: clearEntries,
    })
    return data.data.user
  },

  verifyLock: async (password: string): Promise<boolean> => {
    const { data } = await apiClient.post('/api/users/me/verify-lock', { password })
    return data.data.verified
  },

  changeLockPassword: async (currentPassword: string, newPassword: string): Promise<User> => {
    const { data } = await apiClient.post('/api/users/me/change-lock-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return data.data.user
  },

  exportData: async (): Promise<any> => {
    const { data } = await apiClient.get('/api/users/me/export')
    return data.data.export
  },

  deleteAccount: async (): Promise<void> => {
    await apiClient.delete('/api/users/me')
  },
}
