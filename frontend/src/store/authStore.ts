import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types/user'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isInitialized: boolean // localStorage 복원 + 서버 검증 완료 여부 (비저장)

  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  setInitialized: (v: boolean) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isInitialized: false,

      get isAuthenticated() {
        return get().user !== null && get().accessToken !== null
      },

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      setAccessToken: (token) => set({ accessToken: token }),

      setInitialized: (v) => set({ isInitialized: v }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'mindlog-auth',
      // isInitialized는 저장하지 않음 — 앱 시작 시 항상 false에서 시작
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)
