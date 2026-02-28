export const MOOD_OPTIONS = [
  { value: 'empathy',    label: '공감',  desc: '감정을 먼저 들어요' },
  { value: 'advice',     label: '조언',  desc: '실질적인 방법을 찾아요' },
  { value: 'reflection', label: '정리',  desc: '생각을 함께 정리해요' },
  { value: 'friend',     label: '친구',  desc: '편하고 가볍게' },
  { value: 'objective',  label: '객관',  desc: '사실과 해석을 나눠봐요' },
] as const

export const LENGTH_OPTIONS = [
  { value: 'short',  label: '짧게' },
  { value: 'normal', label: '보통' },
  { value: 'long',   label: '길게' },
] as const

export type AiMood = typeof MOOD_OPTIONS[number]['value']
export type ResponseLength = typeof LENGTH_OPTIONS[number]['value']
