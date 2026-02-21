import { apiClient } from './client'
import { JournalEntry, CalendarDay, EntryCreateInput, EntryUpdateInput } from '@/types/entry'
import { ApiResponse } from '@/types/api'

export const entriesApi = {
  list: async (params?: {
    page?: number
    limit?: number
    start_date?: string
    end_date?: string
  }): Promise<{ entries: JournalEntry[]; pagination: { page: number; total: number; total_pages: number } }> => {
    const res = await apiClient.get<ApiResponse<any>>('/api/entries', { params })
    return res.data.data!
  },

  calendar: async (year: number, month: number): Promise<{ month: string; days: CalendarDay[] }> => {
    const res = await apiClient.get<ApiResponse<any>>('/api/entries/calendar', {
      params: { year, month },
    })
    return res.data.data!
  },

  get: async (id: string): Promise<JournalEntry> => {
    const res = await apiClient.get<ApiResponse<{ entry: JournalEntry }>>(`/api/entries/${id}`)
    return res.data.data!.entry
  },

  // 날짜로 단건 조회 (draft 포함) — 없으면 null 반환
  getByDate: async (date: string): Promise<JournalEntry | null> => {
    try {
      const res = await apiClient.get<ApiResponse<{ entry: JournalEntry }>>(`/api/entries/by-date/${date}`)
      return res.data.data!.entry
    } catch (e: any) {
      if (e?.response?.status === 404) return null
      throw e
    }
  },

  create: async (data: EntryCreateInput): Promise<JournalEntry> => {
    const res = await apiClient.post<ApiResponse<{ entry: JournalEntry }>>('/api/entries', data)
    return res.data.data!.entry
  },

  update: async (id: string, data: EntryUpdateInput): Promise<JournalEntry> => {
    const res = await apiClient.patch<ApiResponse<{ entry: JournalEntry }>>(`/api/entries/${id}`, data)
    return res.data.data!.entry
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/entries/${id}`)
  },

  // Save draft or update existing entry for today
  saveDraft: async (data: EntryCreateInput): Promise<JournalEntry> => {
    const draftData = { ...data, is_draft: true }
    return entriesApi.create(draftData)
  },

  lockEntry: async (id: string, password: string): Promise<JournalEntry> => {
    const res = await apiClient.post<ApiResponse<{ entry: JournalEntry }>>(`/api/entries/${id}/lock`, { password })
    return res.data.data!.entry
  },

  unlockEntry: async (id: string, password: string): Promise<JournalEntry> => {
    const res = await apiClient.post<ApiResponse<{ entry: JournalEntry }>>(`/api/entries/${id}/unlock`, { password })
    return res.data.data!.entry
  },

  verifyLock: async (id: string, password: string): Promise<boolean> => {
    const res = await apiClient.post<ApiResponse<{ verified: boolean }>>(`/api/entries/${id}/verify-lock`, { password })
    return res.data.data!.verified
  },
}
