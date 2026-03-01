export const MOOD_OPTIONS = [
  { value: 'empathy', label: '공감', desc: '감정을 안전하게 받아줘요' },
  { value: 'friend', label: '친구', desc: '편하고 가볍게 한마디로' },
  { value: 'reflection', label: '정리', desc: '생각을 깔끔하게 정리해요' },
  { value: 'objective', label: '객관', desc: '사실과 해석을 분리해요' },
  { value: 'advice', label: '조언', desc: '현실적인 다음 행동을 제안해요' },
] as const

export const LENGTH_OPTIONS = [
  { value: 'short', label: '짧게' },
  { value: 'normal', label: '보통' },
  { value: 'long', label: '길게' },
] as const

// 무드별 기본 길이 프리셋 (백엔드에서 강제하는 게 가장 확실하지만, 프론트에서도 기본값으로 쓸 수 있어요)
export const MOOD_LENGTH_PRESET = {
  empathy: 'normal',
  friend: 'short',
  reflection: 'normal',
  objective: 'short',
  advice: 'long',
} as const

export type AiMood = typeof MOOD_OPTIONS[number]['value']
export type ResponseLength = typeof LENGTH_OPTIONS[number]['value']