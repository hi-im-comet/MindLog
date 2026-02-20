interface Props {
  value: number | null
  onChange: (val: number | null) => void
  label?: string
}

const MOOD_EMOJIS = ['', '😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩']

export function MoodSlider({ value, onChange, label = '오늘 기분' }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-600">{label}</label>
        {value !== null && (
          <span className="text-xl" title={`${value}/10`}>
            {MOOD_EMOJIS[value]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          value={value ?? 5}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-primary-500"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-gray-400 hover:text-gray-600 w-12 text-right"
        >
          {value !== null ? `${value}/10` : '스킵'}
        </button>
      </div>
    </div>
  )
}
