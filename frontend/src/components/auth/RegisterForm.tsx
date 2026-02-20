import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, Link } from 'react-router-dom'

const schema = z.object({
  display_name: z.string().min(1, '이름을 입력해주세요.').max(100),
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다.')
    .max(128),
  password_confirm: z.string(),
}).refine((d) => d.password === d.password_confirm, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['password_confirm'],
})

type FormData = z.infer<typeof schema>

export function RegisterForm() {
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
      const res = await authApi.register({
        email: data.email,
        password: data.password,
        display_name: data.display_name,
      })
      setAuth(res.user, res.access_token, res.refresh_token)
      navigate('/onboarding')
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; errors?: Record<string, string[]> }>
      const message = axiosError.response?.data?.error || '회원가입에 실패했습니다.'
      setError('root', { message })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">닉네임 / 이름</label>
        <p className="text-xs text-gray-400 mb-1.5">AI가 이 이름으로 불러드릴 거예요</p>
        <input
          {...register('display_name')}
          type="text"
          autoComplete="name"
          placeholder="예: 지수, 코코, 민준"
          className="input-field"
        />
        {errors.display_name && (
          <p className="mt-1 text-xs text-red-500">{errors.display_name.message}</p>
        )}
      </div>

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
        <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
        <input
          {...register('password')}
          type="password"
          autoComplete="new-password"
          placeholder="8자 이상"
          className="input-field"
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
        <input
          {...register('password_confirm')}
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 다시 입력하세요"
          className="input-field"
        />
        {errors.password_confirm && (
          <p className="mt-1 text-xs text-red-500">{errors.password_confirm.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="text-sm text-red-500 text-center bg-red-50 rounded-lg p-3">
          {errors.root.message}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? '가입 중...' : '시작하기'}
      </button>

      <p className="text-center text-sm text-gray-500">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="text-primary-600 font-medium hover:underline">
          로그인
        </Link>
      </p>
    </form>
  )
}
