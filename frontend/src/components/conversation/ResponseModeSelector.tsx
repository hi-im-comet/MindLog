import { clsx } from 'clsx'
import type { ResponseMode } from '@/types/conversation'

const MODES: { value: ResponseMode; label: string; desc: string; icon: string }[] = [
  {
    value: 'empathetic',
    label: '공감',
    desc: '들어주고 함께 있어줘요',
    icon: '🤝',
  },
  {
    value: 'advice',
    label: '조언',
    desc: '구체적인 방법을 찾아요',
    icon: '💡',
  },
  {
    value: 'pattern_recognition',
    label: '패턴',
    desc: '반복되는 흐름을 찾아요',
    icon: '🔍',
  },
]

interface Props {
  value: ResponseMode
  onChange: (mode: ResponseMode) => void
  disabled?: boolean
}

export function ResponseModeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onChange(mode.value)}
          disabled={disabled}
          title={mode.desc}
          className={clsx(
            'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-medium transition-colors border',
            value === mode.value
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-700',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className="text-base">{mode.icon}</span>
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  )
}
