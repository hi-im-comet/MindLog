import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from '@/components/shared/Layout'
import { entriesApi } from '@/api/entries'
import { useAuthStore } from '@/store/authStore'
import { iwa } from '@/utils/josa'

const CATEGORY_ICONS: Record<string, string> = {
  업무: '💼',
  기분: '😊',
  수면: '🌙',
  식사: '🍽️',
  운동: '🏃',
  관계: '👥',
}

export function EntryView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const aiName = useAuthStore((s) => s.user?.profile?.ai_name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.get(id!),
    refetchInterval: (query) => {
      const e = query.state.data
      if (!e || e.is_draft) return false
      return (!e.category_segments || e.category_segments.length === 0) ? 10_000 : false
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => entriesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate('/dashboard')
    },
  })

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <p>불러오는 중...</p>
        </div>
      </Layout>
    )
  }

  if (!entry) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400">
          <p>대화를 찾을 수 없어요.</p>
          <Link to="/dashboard" className="text-primary-500 text-sm mt-2 inline-block">
            홈으로
          </Link>
        </div>
      </Layout>
    )
  }

  const dateLabel = format(
    new Date(entry.entry_date + 'T00:00:00'),
    'yyyy년 M월 d일 EEEE',
    { locale: ko }
  )

  const hasSegments = entry.category_segments && entry.category_segments.length > 0

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ←
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">{dateLabel}</h2>
            {entry.categories.length > 0 && (
              <div className="flex gap-1 mt-1">
                {entry.categories.map((c) => (
                  <span key={c.id} className="text-xs text-gray-400">
                    {c.icon} {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Delete control */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-300 hover:text-red-400 transition-colors p-1"
              title="대화 삭제"
            >
              🗑️
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">삭제할까요?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded font-medium"
              >
                {deleteMutation.isPending ? '...' : '삭제'}
              </button>
            </div>
          )}
        </div>

        {/* 카테고리별 AI 분석 */}
        <AnimatePresence mode="wait">
          {hasSegments ? (
            <motion.div
              key="segments"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {entry.category_segments!.map((seg) => (
                <div key={seg.category} className="card p-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {CATEGORY_ICONS[seg.category] ?? '📌'} {seg.category}
                  </p>
                  <p className="text-gray-700 text-sm leading-relaxed">{seg.content}</p>
                </div>
              ))}
            </motion.div>
          ) : !entry.is_draft ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card p-4 flex items-center gap-3 text-gray-400"
            >
              <span className="animate-spin text-lg">⏳</span>
              <span className="text-sm">AI가 오늘 대화를 분석하고 있어요...</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            to={`/entry/${entry.entry_date}`}
            className="btn-secondary flex-1 text-center"
          >
            대화 이어가기
          </Link>
          {!entry.is_draft && (
            <Link
              to={`/view/${entry.id}/chat`}
              className="btn-primary flex-1 text-center"
            >
              {entry.has_conversation
                ? '전체 대화 보기 💬'
                : aiName
                ? `"${aiName}"${iwa(aiName)} 대화하기 🤖`
                : 'AI와 대화하기 🤖'
              }
            </Link>
          )}
        </div>
      </div>
    </Layout>
  )
}
