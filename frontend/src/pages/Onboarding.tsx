import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/authStore'
import { apiClient } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categories'

const RESPONSE_MODES = [
  {
    value: 'empathetic',
    label: '공감',
    emoji: '🤝',
    desc: '내 감정을 판단 없이 들어줘요',
  },
  {
    value: 'advice',
    label: '조언',
    emoji: '💡',
    desc: '구체적인 방법을 알려줘요',
  },
  {
    value: 'pattern_recognition',
    label: '패턴 분석',
    emoji: '🔍',
    desc: '내 습관과 패턴을 짚어줘요',
  },
] as const

export function Onboarding() {
  const { updateUser } = useAuthStore()
  const navigate = useNavigate()
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [responseMode, setResponseMode] = useState<string>('empathetic')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const toggleCat = (name: string) => {
    setSelectedCats((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const handleNext = () => {
    if (step === 1) {
      setStep(2)
    }
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      const toSelect = selectedCats.length > 0
        ? selectedCats
        : categories.map((c) => c.name)

      await apiClient.post('/api/users/me/onboarding', {
        selected_categories: toSelect,
        preferred_response_mode: responseMode,
      })
      updateUser({ onboarding_completed: true })
      navigate('/dashboard')
    } catch {
      // fallback: skip onboarding API failure
      updateUser({ onboarding_completed: true })
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg)]">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-2 mb-8 justify-center">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={clsx(
                'h-1.5 rounded-full transition-all duration-300',
                s <= step ? 'bg-primary-500 w-12' : 'bg-gray-200 w-6'
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <p className="text-4xl mb-3">🌱</p>
              <h2 className="text-2xl font-bold text-gray-800">어떤 것을 기록하고 싶으세요?</h2>
              <p className="text-gray-500 mt-2 text-sm">
                관심 있는 카테고리를 선택해주세요. 나중에 언제든 바꿀 수 있어요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const selected = selectedCats.includes(cat.name) ||
                  (selectedCats.length === 0)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCat(cat.name)}
                    className={clsx(
                      'card p-4 text-left transition-all duration-150 border-2',
                      selectedCats.includes(cat.name)
                        ? 'border-primary-400 bg-primary-50'
                        : selectedCats.length === 0
                          ? 'border-transparent hover:border-gray-200'
                          : 'border-transparent opacity-60 hover:opacity-100 hover:border-gray-200'
                    )}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <p className="font-medium text-sm text-gray-700 mt-1">{cat.name}</p>
                  </button>
                )
              })}
            </div>

            <button onClick={handleNext} className="btn-primary w-full">
              다음
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <p className="text-4xl mb-3">🤖</p>
              <h2 className="text-2xl font-bold text-gray-800">AI 가 어떻게 대답하면 좋을까요?</h2>
              <p className="text-gray-500 mt-2 text-sm">
                대화를 나누고 난 뒤 AI 와 나누는 대화 스타일이에요.<br />
                대화 중에도 언제든 바꿀 수 있어요.
              </p>
            </div>

            <div className="space-y-3">
              {RESPONSE_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setResponseMode(mode.value)}
                  className={clsx(
                    'w-full card p-4 text-left flex items-center gap-4 transition-all duration-150 border-2',
                    responseMode === mode.value
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-transparent hover:border-gray-200'
                  )}
                >
                  <span className="text-3xl">{mode.emoji}</span>
                  <div>
                    <p className="font-semibold text-gray-800">{mode.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{mode.desc}</p>
                  </div>
                  {responseMode === mode.value && (
                    <span className="ml-auto text-primary-500">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                이전
              </button>
              <button onClick={handleStart} disabled={loading} className="btn-primary flex-1">
                {loading ? '시작 중...' : '시작하기 🎉'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
