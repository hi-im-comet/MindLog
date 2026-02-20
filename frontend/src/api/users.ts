import { apiClient } from './client'
import type { User } from '@/types/user'

export interface UpdateMePayload {
  display_name?: string
  timezone?: string
  ai_name?: string | null
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
}
