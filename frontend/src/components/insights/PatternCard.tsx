import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import type { PatternLog } from '@/types/pattern'

const TYPE_LABEL: Record<string, string> = {
  weekly: '주간',
  monthly: '월간',
  semiannual: '6개월',
}

interface Props {
  pattern: PatternLog
  defaultExpanded?: boolean
  onUpdate?: (id: string, body: string) => void
  onDelete?: (id: string) => void
}

export function PatternCard({ pattern, defaultExpanded = false, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(pattern.mirror ?? pattern.body)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)

  const periodLabel = `${format(parseISO(pattern.period_start), 'M/d', { locale: ko })} ~ ${format(parseISO(pattern.period_end), 'M/d')}`

  // 표시할 본문: mirror 우선, 없으면 body(구버전)
  const displayBody = pattern.mirror ?? pattern.body

  const handleSave = () => {
    if (editBody.trim() && onUpdate) {
      onUpdate(pattern.id, editBody.trim())
    }
    setEditing(false)
  }

  const handleCancel = () => {
    setEditBody(pattern.mirror ?? pattern.body)
    setEditing(false)
  }

  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-left flex-1"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">
                {TYPE_LABEL[pattern.log_type] ?? pattern.log_type}
              </span>
              <span className="text-xs text-gray-400">{periodLabel}</span>
              {pattern.entries_analyzed != null && (
                <span className="text-xs text-gray-300">{pattern.entries_analyzed}개 일기</span>
              )}
              {pattern.is_edited && (
                <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">수정됨</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800">{pattern.headline}</p>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {onUpdate && !editing && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setEditing(true) }}
              className="text-gray-300 hover:text-primary-400 transition-colors px-1 text-sm"
              title="수정"
            >
              ✏️
            </button>
          )}
          {onDelete && !confirmDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="text-gray-300 hover:text-red-400 transition-colors px-1 text-sm"
              title="삭제"
            >
              🗑️
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5"
              >
                취소
              </button>
              <button
                onClick={() => onDelete?.(pattern.id)}
                className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded font-medium"
              >
                삭제
              </button>
            </div>
          )}
          {!confirmDelete && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-gray-300 text-sm px-1"
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-2 border-t border-gray-50">

              {/* 거울 — view or edit mode */}
              {editing ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">거울 (수정 가능)</p>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={5}
                    className="w-full text-sm text-gray-700 border border-primary-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-100 leading-relaxed"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancel}
                      className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      className="text-xs text-white bg-primary-500 hover:bg-primary-600 px-3 py-1.5 rounded-lg font-medium"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">거울</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {displayBody}
                  </p>
                </div>
              )}

              {/* 데이터 배지 */}
              {pattern.data_badges.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">근거</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pattern.data_badges.map((badge, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 발견된 패턴 */}
              {pattern.patterns_found.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">반복 패턴</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pattern.patterns_found.map((p, i) => (
                      <span key={i} className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-full border border-gray-100">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 작은 실험 */}
              {pattern.small_experiment && (
                <div className="bg-primary-50 rounded-xl px-4 py-3 space-y-0.5">
                  <p className="text-xs font-medium text-primary-500 uppercase tracking-wide">작은 실험</p>
                  <p className="text-sm text-primary-700 leading-relaxed">{pattern.small_experiment}</p>
                </div>
              )}

              {/* 안전 블록 — 위기 언어 감지 시에만 */}
              {pattern.safety_content && (
                <div className="border border-orange-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setSafetyOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-orange-50 text-left"
                  >
                    <span className="text-xs font-medium text-orange-600">⚠️ 주의가 필요한 내용이 감지됐어요</span>
                    <span className="text-orange-400 text-xs">{safetyOpen ? '접기' : '펼치기'}</span>
                  </button>
                  {safetyOpen && (
                    <div className="px-4 py-3 bg-white space-y-2">
                      <p className="text-sm text-gray-700 leading-relaxed">{pattern.safety_content}</p>
                      <p className="text-xs text-gray-400">
                        힘드실 때 자살예방상담전화 <strong>1393</strong> (24시간)에 연락해보세요.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
