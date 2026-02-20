import { RegisterForm } from '@/components/auth/RegisterForm'
import { GoogleOAuthButton } from '@/components/auth/GoogleOAuthButton'

export function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg)]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">MindLog</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            나를 이해하는 것이 모든 변화의 시작이에요
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          <RegisterForm />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="bg-white px-3">또는</span>
            </div>
          </div>

          <GoogleOAuthButton />
        </div>
      </div>
    </div>
  )
}
