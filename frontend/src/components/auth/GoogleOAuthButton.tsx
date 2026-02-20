import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export function GoogleOAuthButton() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return
    setError(null)
    try {
      const res = await authApi.googleLogin(credentialResponse.credential)
      setAuth(res.user, res.access_token, res.refresh_token)
      navigate(res.user.onboarding_completed ? '/dashboard' : '/onboarding')
    } catch {
      setError('Google 로그인에 실패했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => setError('Google 로그인에 실패했습니다.')}
        useOneTap={false}
        shape="rectangular"
        size="large"
        width={320}
        locale="ko"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
