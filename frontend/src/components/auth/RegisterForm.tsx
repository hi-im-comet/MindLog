import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AxiosError } from 'axios'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, Link } from 'react-router-dom'

const PASSWORD_POLICY_MSG =
  '비밀번호는 8자 이상이며, 영문·숫자·특수문자를 각각 1개 이상 포함해야 합니다.'

const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(128, '비밀번호는 128자 이하여야 합니다.')
  .refine((s) => /[A-Za-z]/.test(s), PASSWORD_POLICY_MSG)
  .refine((s) => /[0-9]/.test(s), PASSWORD_POLICY_MSG)
  .refine((s) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(s), PASSWORD_POLICY_MSG)

const schema = z
  .object({
    userNickname: z.string().min(1, '사용자 닉네임을 입력해주세요.').max(100),
    aiNickname: z.string().min(1, 'AI 닉네임을 입력해주세요.').max(50),
    email: z.string().email('올바른 이메일을 입력해주세요.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

function PasswordChecklist({ password }: { password: string }) {
  const lenOk = password.length >= 8 && password.length <= 128
  const hasLetter = /[A-Za-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)
  const items = [
    { ok: lenOk, label: '8자 이상 128자 이하' },
    { ok: hasLetter, label: '영문 포함' },
    { ok: hasDigit, label: '숫자 포함' },
    { ok: hasSpecial, label: '특수문자 포함' },
  ]
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs">
      {items.map(({ ok, label }) => (
        <li
          key={label}
          className={ok ? 'text-green-600' : 'text-gray-400'}
        >
          {ok ? '✓ ' : '○ '}
          {label}
        </li>
      ))}
    </ul>
  )
}

export function RegisterForm() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const passwordValue = watch('password', '')

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.register({
        userNickname: data.userNickname,
        aiNickname: data.aiNickname,
        email: data.email,
        password: data.password,
      })
      setAuth(res.user, res.access_token, res.refresh_token)
      navigate('/onboarding')
    } catch (err) {
      const axiosError = err as AxiosError<{
        error?: string
        errors?: Record<string, string[]>
      }>
      const data = axiosError.response?.data
      const message =
        (typeof data?.error === 'string' ? data.error : null) ||
        (data?.errors && Object.values(data.errors).flat().length > 0
          ? Object.values(data.errors).flat().join('. ')
          : null) ||
        (axiosError.response?.status === 409
          ? '이미 사용 중인 이메일입니다.'
          : axiosError.response?.status === 500
            ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            : '회원가입에 실패했습니다.')
      setError('root', { message })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          사용자 닉네임 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('userNickname')}
          type="text"
          autoComplete="username"
          placeholder="예: 지수, 코코, 민준"
          className="input-field"
        />
        {errors.userNickname && (
          <p className="mt-1 text-xs text-red-500">{errors.userNickname.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AI 닉네임 <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-400 mb-1.5">AI가 이 이름으로 불러드릴 거예요</p>
        <input
          {...register('aiNickname')}
          type="text"
          autoComplete="off"
          placeholder="예: 마음친구, 코코"
          className="input-field"
        />
        {errors.aiNickname && (
          <p className="mt-1 text-xs text-red-500">{errors.aiNickname.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          이메일 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="hello@example.com"
          className="input-field"
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          비밀번호 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('password')}
          type="password"
          autoComplete="new-password"
          placeholder="8자 이상, 영문·숫자·특수문자 포함"
          className="input-field"
        />
        <PasswordChecklist password={passwordValue} />
        {errors.password && (
          <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          비밀번호 확인 <span className="text-red-500">*</span>
        </label>
        <input
          {...register('confirmPassword')}
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 다시 입력하세요"
          className="input-field"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
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
