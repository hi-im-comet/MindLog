import { apiClient } from './client'

export interface DailyMessage {
  id: string
  message_date: string
  content: string
  generated_at: string | null
  ai_mood_used: string | null
}

export const dailyMessagesApi = {
  getToday: async (): Promise<DailyMessage | null> => {
    const { data } = await apiClient.get('/api/daily-messages/today')
    return data.data.message ?? null
  },

  generateNow: async (): Promise<DailyMessage> => {
    const { data } = await apiClient.post('/api/daily-messages/generate')
    return data.data.message
  },
}
