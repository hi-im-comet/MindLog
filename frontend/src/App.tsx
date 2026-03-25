import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Onboarding } from '@/pages/Onboarding'
import { EntryEditor } from '@/pages/EntryEditor'
import { EntryView } from '@/pages/EntryView'
import { EntryChat } from '@/pages/EntryChat'
import { Insights } from '@/pages/Insights'
import { Settings } from '@/pages/Settings'
import { Reminders } from '@/pages/Reminders'
import { ReminderChat } from '@/pages/ReminderChat'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { usersApi } from '@/api/users'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function App() {
  const { accessToken, updateUser, setInitialized } = useAuthStore()

  // 앱 시작 시 초기화
  // localStorage에 토큰이 있으면 즉시 인증 상태로 복원 (로그인 화면 방지)
  // getMe()는 백그라운드에서 유저 정보만 최신화 (blocking하지 않음)
  useEffect(() => {
    setInitialized(true)
    if (accessToken) {
      usersApi.getMe().then(updateUser).catch(() => {})
    }
    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route
              path="/onboarding"
              element={<ProtectedRoute><Onboarding /></ProtectedRoute>}
            />
            {/* 기록(캘린더): /calendar, /dashboard는 하위 호환 리다이렉트 */}
            <Route
              path="/calendar"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route path="/dashboard" element={<Navigate to="/calendar" replace />} />
            {/* 일기 에디터: /entry/2026-02-20 */}
            <Route
              path="/entry/:date"
              element={<ProtectedRoute><EntryEditor /></ProtectedRoute>}
            />
            {/* 일기 뷰 (AI 요약 + 대화 진입): /view/:id */}
            <Route
              path="/view/:id"
              element={<ProtectedRoute><EntryView /></ProtectedRoute>}
            />
            {/* AI 대화: /view/:id/chat */}
            <Route
              path="/view/:id/chat"
              element={<ProtectedRoute><EntryChat /></ProtectedRoute>}
            />
            {/* 인사이트: /insights */}
            <Route
              path="/insights"
              element={<ProtectedRoute><Insights /></ProtectedRoute>}
            />
            {/* 설정: /settings */}
            <Route
              path="/settings"
              element={<ProtectedRoute><Settings /></ProtectedRoute>}
            />
            {/* 체크인 알림: /reminders */}
            <Route
              path="/reminders"
              element={<ProtectedRoute><Reminders /></ProtectedRoute>}
            />
            {/* 체크인 대화: /reminders/:id/chat */}
            <Route
              path="/reminders/:id/chat"
              element={<ProtectedRoute><ReminderChat /></ProtectedRoute>}
            />

            {/* Fallback */}
            <Route path="/" element={<Navigate to={`/entry/${new Date().toISOString().slice(0, 10)}`} replace />} />
            <Route path="*" element={<Navigate to={`/entry/${new Date().toISOString().slice(0, 10)}`} replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}
