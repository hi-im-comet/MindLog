import { apiClient } from './client'
import { JournalCategory, CategoryCreateInput } from '@/types/category'
import { ApiResponse } from '@/types/api'

export const categoriesApi = {
  list: async (): Promise<JournalCategory[]> => {
    const res = await apiClient.get<ApiResponse<{ categories: JournalCategory[] }>>('/api/categories')
    return res.data.data!.categories
  },

  create: async (data: CategoryCreateInput): Promise<JournalCategory> => {
    const res = await apiClient.post<ApiResponse<{ category: JournalCategory }>>('/api/categories', data)
    return res.data.data!.category
  },

  update: async (id: string, data: Partial<JournalCategory>): Promise<JournalCategory> => {
    const res = await apiClient.patch<ApiResponse<{ category: JournalCategory }>>(`/api/categories/${id}`, data)
    return res.data.data!.category
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/categories/${id}`)
  },
}
