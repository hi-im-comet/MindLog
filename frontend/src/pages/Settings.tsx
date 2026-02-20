import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/shared/Layout'
import { useAuthStore } from '@/store/authStore'
import { usersApi } from '@/api/users'

const schema = z.object({
  display_name: z.string().min(1, '이름을 입력해주세요.').max(100),
  ai_name: z.string().max(50).optional(),
})

type FormData = z.infer<typeof schema>

export function Settings() {
  const { user, updateUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [exportLoading, setExportLoading] = useState(false)

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

  const deleteMutation = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      logout()
      navigate('/login')
    },
    onError: () => {
      setShowDeleteModal(false)
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

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const exportData = await usersApi.exportData()
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mindlog-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // 내보내기 실패 시 무시
    } finally {
      setExportLoading(false)
    }
  }

  const canDelete = deleteConfirmText === '탈퇴하겠습니다'

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-800">설정</h1>

        {/* Profile form */}
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

        {/* Data export */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">데이터 내보내기</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            내가 기록한 모든 대화와 패턴 분석을 JSON 파일로 다운로드해요. 언제든 내 데이터를
            가져갈 수 있어요.
          </p>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="btn-secondary w-full text-sm"
          >
            {exportLoading ? '준비 중...' : '📦 내 데이터 다운로드'}
          </button>
        </div>

        {/* Account deletion */}
        <div className="card p-6 space-y-3 border border-red-100">
          <h2 className="text-sm font-semibold text-red-600">계정 탈퇴</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            탈퇴하면 모든 대화, 패턴 분석, 프로필 데이터가 영구적으로 삭제돼요. 되돌릴 수
            없어요.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full text-sm text-red-500 border border-red-200 rounded-xl py-2.5 hover:bg-red-50 transition-colors font-medium"
          >
            탈퇴하기
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              <div className="text-center space-y-1">
                <p className="text-2xl">⚠️</p>
                <h3 className="text-lg font-bold text-gray-800">정말 탈퇴할까요?</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  모든 대화, 패턴 분석, 프로필이 즉시 삭제되며 복구할 수 없어요.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  탈퇴를 확인하려면 아래에{' '}
                  <span className="font-semibold text-red-500">탈퇴하겠습니다</span>를 입력하세요.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="탈퇴하겠습니다"
                  className="input-field text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmText('')
                  }}
                  className="btn-secondary flex-1 text-sm"
                >
                  취소
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={!canDelete || deleteMutation.isPending}
                  className="flex-1 text-sm text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 rounded-xl py-2.5 font-medium transition-colors"
                >
                  {deleteMutation.isPending ? '삭제 중...' : '탈퇴하기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  )
}
