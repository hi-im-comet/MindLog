interface Props {
  onDismiss?: () => void
}

export function CrisisResourceBanner({ onDismiss }: Props) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-red-700">
          지금 많이 힘드시죠. 혼자 감당하지 않아도 돼요.
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0"
            aria-label="닫기"
          >
            ×
          </button>
        )}
      </div>
      <p className="text-xs text-red-600">전문 상담사와 연결할 수 있어요:</p>
      <div className="flex flex-wrap gap-2">
        <a
          href="tel:1393"
          className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors"
        >
          📞 자살예방상담전화 1393
        </a>
        <a
          href="tel:15770199"
          className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors"
        >
          📞 정신건강 위기상담 1577-0199
        </a>
        <a
          href="tel:119"
          className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors"
        >
          🚑 응급 119
        </a>
      </div>
    </div>
  )
}
