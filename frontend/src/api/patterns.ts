import { apiClient } from './client'
import type { PatternLog, InsightsData } from '@/types/pattern'

export const patternsApi = {
  list: async (params?: { limit?: number; type?: string }): Promise<PatternLog[]> => {
    const res = await apiClient.get('/api/patterns', { params })
    return res.data.data.patterns
  },

  generate: async (periodType: 'weekly' | 'monthly' | 'semiannual' = 'weekly'): Promise<PatternLog | null> => {
    const res = await apiClient.post('/api/patterns/generate', { period_type: periodType })
    return res.data.data.pattern ?? null
  },

  insights: async (): Promise<InsightsData> => {
    const res = await apiClient.get('/api/patterns/insights')
    return res.data.data
  },

  update: async (id: string, body: string): Promise<PatternLog> => {
    const res = await apiClient.patch(`/api/patterns/${id}`, { body })
    return res.data.data.pattern
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/patterns/${id}`)
  },
}
