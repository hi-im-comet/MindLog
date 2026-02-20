import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categories'

const EMOTIONS = [
  {
    emoji: '💫',
    label: '아주 좋아요',
    response: '정말 멋진 하루네요! ✨ 오늘의 좋은 에너지를 기록해두면 힘든 날 꺼내볼 수 있어요.',
  },
  {
    emoji: '😊',
    label: '좋아요',
    response: '좋은 하루를 보내고 계시는군요 😊 그 기분을 MindLog에 담아봐요.',
  },
  {
    emoji: '😐',
    label: '보통이에요',
    response: '평범한 하루도 소중한 기록이 돼요 🌱 이런 날들이 쌓여 나만의 패턴이 보여요.',
  },
  {
    emoji: '😔',
    label: '조금 힘들어요',
    response: '오늘 하루 수고했어요 💙 이야기하고 싶은 게 있으면 언제든 들을게요.',
  },
  {
    emoji: '😢',
    label: '많이 힘들어요',
    response: '힘든 마음을 꺼내줘서 고마워요 🫂 저와 함께 이야기해봐요, 혼자가 아니에요.',
  },
] as const

type Phase = 'question' | 'answered' | 'done'

export function Onboarding() {
  const { updateUser } = useAuthStore()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('question')
  const [selectedEmotion, setSelectedEmotion] = useState<typeof EMOTIONS[number] | null>(null)
  const [loading, setLoading] = useState(false)
  const apiDoneRef = useRef(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const handleEmotionSelect = (emotion: typeof EMOTIONS[number]) => {
    if (phase !== 'question') return
    setSelectedEmotion(emotion)
    setPhase('answered')
  }

  const handleStart = async () => {
    if (loading) return
    setLoading(true)
    try {
      await apiClient.post('/api/users/me/onboarding', {
        selected_categories: categories.length > 0 ? categories.map((c) => c.name) : [],
        preferred_response_mode: 'empathetic',
      })
    } catch {
      // API 실패해도 온보딩 완료로 처리
    }
    updateUser({ onboarding_completed: true })
    setPhase('done')
    setTimeout(() => navigate('/dashboard'), 600)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'done' ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg)]"
    >
      <div className="w-full max-w-sm">
        {/* AI 아바타 + 인사 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-3xl mb-4 shadow-sm">
            🤖
          </div>
          <div className="space-y-2 text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-block bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 text-sm text-gray-700 text-left max-w-xs"
            >
              안녕하세요! 저는 MindLog예요. 앞으로 매일 함께할게요 😊
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="inline-block bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 text-sm text-gray-700 text-left max-w-xs"
            >
              지금 어떤 하루를 보내고 계세요?
            </motion.div>
          </div>
        </motion.div>

        {/* 감정 버튼 */}
        <AnimatePresence mode="wait">
          {phase === 'question' && (
            <motion.div
              key="emotions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              {EMOTIONS.map((emotion, i) => (
                <motion.button
                  key={emotion.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                  onClick={() => handleEmotionSelect(emotion)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-primary-300 hover:bg-primary-50 transition-all duration-150 text-left group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">
                    {emotion.emoji}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{emotion.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}

          {phase === 'answered' && selectedEmotion && (
            <motion.div
              key="response"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* 사용자 선택 버블 (오른쪽) */}
              <div className="flex justify-end">
                <div className="bg-primary-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                  <span>{selectedEmotion.emoji}</span>
                  <span>{selectedEmotion.label}</span>
                </div>
              </div>

              {/* AI 응답 버블 */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 text-sm text-gray-700 leading-relaxed"
              >
                {selectedEmotion.response}
              </motion.div>

              {/* 시작 버튼 */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={handleStart}
                disabled={loading}
                className="w-full btn-primary mt-2"
              >
                {loading ? '시작 중...' : 'MindLog 시작하기 🎉'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
