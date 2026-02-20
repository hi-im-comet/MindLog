import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: Props) {
  const { user, accessToken, isInitialized } = useAuthStore()
  const location = useLocation()

  // 서버 검증 완료 전 — 로딩 대기 (로그인 화면으로 튕기지 않음)
  if (!isInitialized) return null

  if (!user || !accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!user.onboarding_completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
