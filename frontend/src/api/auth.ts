import { apiClient } from './client'
import { AuthResponse } from '@/types/user'
import { ApiResponse } from '@/types/api'

export const authApi = {
  register: async (data: {
    email: string
    password: string
    display_name: string
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/register', data)
    return res.data.data!
  },

  login: async (data: {
    email: string
    password: string
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/login', data)
    return res.data.data!
  },

  googleLogin: async (credential: string): Promise<AuthResponse> => {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/google', { credential })
    return res.data.data!
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/api/auth/logout', { refresh_token: refreshToken })
  },
}
