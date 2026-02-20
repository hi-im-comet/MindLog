import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, Link } from 'react-router-dom'

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
})

type FormData = z.infer<typeof schema>

interface Props {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: Props) {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data)
      setAuth(res.user, res.access_token, res.refresh_token)
      onSuccess?.()
      navigate(res.user.onboarding_completed ? '/dashboard' : '/onboarding')
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>
      const message = axiosError.response?.data?.error || '로그인에 실패했습니다.'
      setError('root', { message })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="hello@example.com"
          className="input-field"
        />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">비밀번호</label>
        </div>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          className="input-field"
        />
        {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
      </div>

      {errors.root && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-lg p-3">
          {errors.root.message}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? '로그인 중...' : '로그인'}
      </button>

      <p className="text-center text-sm text-gray-500">
        계정이 없으신가요?{' '}
        <Link to="/register" className="text-primary-600 font-medium hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  )
}
