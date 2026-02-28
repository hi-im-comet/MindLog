import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Layout } from '@/components/shared/Layout'
import { ConversationPanel } from '@/components/conversation/ConversationPanel'
import { conversationsApi } from '@/api/conversations'
import { entriesApi } from '@/api/entries'
import { useAuthStore } from '@/store/authStore'
import type { ResponseMode } from '@/types/conversation'

export function EntryChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const aiName = user?.profile?.ai_name ?? undefined
  const userName = user?.display_name ?? undefined
  const [responseMode] = useState<ResponseMode>('empathetic')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: entry, isLoading: entryLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.get(id!),
    enabled: !!id,
  })

  const { data: conversation, isLoading: convLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationsApi.start(id!, responseMode),
    enabled: !!entry && !entry.is_draft,
    staleTime: Infinity,
  })

  const deleteMutation = useMutation({
    mutationFn: () => entriesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate('/dashboard')
    },
  })

  const favMutation = useMutation({
    mutationFn: () => entriesApi.toggleFavorite(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', id] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })

  if (entryLoading || convLoading) {
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
          <Link to="/dashboard" className="text-primary-500 text-sm mt-2 inline-block">홈으로</Link>
        </div>
      </Layout>
    )
  }

  if (entry.is_draft) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400">
          <p>대화를 먼저 마쳐주세요.</p>
          <Link to={`/entry/${entry.entry_date}`} className="text-primary-500 text-sm mt-2 inline-block">
            돌아가기
          </Link>
        </div>
      </Layout>
    )
  }

  const dateLabel = format(new Date(entry.entry_date + 'T00:00:00'), 'M월 d일 EEEE', { locale: ko })

  return (
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-50 flex-shrink-0">
          <button
            onClick={() => navigate(`/view/${entry.id}`)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-800 truncate">{dateLabel} 대화</h2>
          </div>
          {/* 즐겨찾기 */}
          <button
            onClick={() => favMutation.mutate()}
            disabled={favMutation.isPending}
            className="text-lg p-1 transition-colors disabled:opacity-50"
            title={entry.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            {entry.is_favorite ? '⭐' : '☆'}
          </button>
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

        {/* Conversation */}
        <div className="flex-1 min-h-0">
          {conversation ? (
            <ConversationPanel
              conversation={conversation}
              aiName={aiName}
              userName={userName}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm">
              대화를 준비하고 있어요...
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
