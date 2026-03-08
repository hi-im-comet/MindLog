import { clsx } from 'clsx'
import { MOOD_OPTIONS } from '@/constants/aiMood'
import type { ResponseMode } from '@/types/conversation'

interface Props {
  value: ResponseMode
  onChange: (mode: ResponseMode) => void
  disabled?: boolean
}

export function ResponseModeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-1.5">
      {MOOD_OPTIONS.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onChange(mode.value as ResponseMode)}
          disabled={disabled}
          title={mode.desc}
          className={clsx(
            'flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-colors border',
            value === mode.value
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:text-gray-700',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
