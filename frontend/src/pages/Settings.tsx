import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Layout } from '@/components/shared/Layout'
import { useAuthStore } from '@/store/authStore'
import { usersApi } from '@/api/users'

const schema = z.object({
  display_name: z.string().min(1, '이름을 입력해주세요.').max(100),
  ai_name: z.string().max(50).optional(),
})

type FormData = z.infer<typeof schema>

export function Settings() {
  const { user, updateUser } = useAuthStore()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: user?.display_name ?? '',
      ai_name: user?.profile?.ai_name ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const updated = await usersApi.updateMe({
        display_name: data.display_name,
        ai_name: data.ai_name?.trim() || null,
      })
      updateUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('root', { message: '저장에 실패했어요. 잠시 후 다시 시도해주세요.' })
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-800">설정</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">닉네임 / 이름</label>
            <p className="text-xs text-gray-400 mb-1.5">AI가 대화 중 이 이름으로 불러드려요</p>
            <input
              {...register('display_name')}
              type="text"
              className="input-field"
              placeholder="나를 부를 이름"
            />
            {errors.display_name && (
              <p className="mt-1 text-xs text-red-500">{errors.display_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI 이름</label>
            <p className="text-xs text-gray-400 mb-1.5">
              AI에게 붙여줄 이름이에요. 비워두면 기본 이름으로 불려요.
            </p>
            <input
              {...register('ai_name')}
              type="text"
              className="input-field"
              placeholder="예: 백설, 루나, 하루 (선택)"
            />
            {errors.ai_name && (
              <p className="mt-1 text-xs text-red-500">{errors.ai_name.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{errors.root.message}</p>
          )}

          {saved && (
            <p className="text-sm text-primary-600 bg-primary-50 rounded-lg p-3">저장됐어요!</p>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
