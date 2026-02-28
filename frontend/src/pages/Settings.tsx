import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Layout } from '@/components/shared/Layout'
import { useAuthStore } from '@/store/authStore'
import { usersApi } from '@/api/users'

const schema = z.object({
  display_name: z.string().min(1, '이름을 입력해주세요.').max(100),
  ai_name: z.string().max(50).optional(),
})

type FormData = z.infer<typeof schema>
type ExportFormat = 'json' | 'txt' | 'pdf' | 'hwp'
type ExportRange = 'all' | 'dateRange'

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string; ready: boolean }[] = [
  { value: 'json', label: 'JSON', ext: '.json', ready: true },
  { value: 'txt', label: 'TXT', ext: '.txt', ready: true },
  { value: 'pdf', label: 'PDF', ext: '.pdf', ready: true },
  { value: 'hwp', label: 'HWP', ext: '.hwp', ready: false },
]

function buildTxt(exportData: any): string {
  const lines: string[] = []
  lines.push('📓 MindLog 내보내기')
  lines.push(`내보낸 날짜: ${new Date().toLocaleDateString('ko-KR')}`)
  lines.push(`사용자: ${exportData.user?.display_name ?? ''}`)
  lines.push('')

  for (const entry of exportData.entries ?? []) {
    const dateStr = entry.entry_date
      ? format(parseISO(entry.entry_date + 'T00:00:00'), 'yyyy년 M월 d일 EEEE', { locale: ko })
      : entry.entry_date
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push(dateStr)
    if (entry.categories?.length > 0) {
      lines.push(`카테고리: ${entry.categories.map((c: any) => c.name).join(', ')}`)
    }
    lines.push('')
    if (entry.raw_content) {
      lines.push('[대화 내용]')
      lines.push(entry.raw_content)
    }
    if (entry.category_segments?.length > 0) {
      lines.push('')
      lines.push('[AI 분석]')
      for (const seg of entry.category_segments) {
        lines.push(`${seg.category}: ${seg.content}`)
      }
    }
    lines.push('')
  }

  if (exportData.patterns?.length > 0) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━')
    lines.push('패턴 분석 기록')
    lines.push('')
    for (const p of exportData.patterns) {
      lines.push(`[${p.log_type?.toUpperCase() ?? ''}] ${p.headline ?? ''}`)
      lines.push(p.body ?? '')
      lines.push('')
    }
  }

  return lines.join('\n')
}

function openPrintWindow(exportData: any): void {
  const entries = exportData.entries ?? []
  const rows = entries
    .map((entry: any) => {
      const dateStr = entry.entry_date
        ? format(parseISO(entry.entry_date + 'T00:00:00'), 'yyyy년 M월 d일 EEEE', { locale: ko })
        : entry.entry_date
      const cats =
        entry.categories?.length > 0
          ? `<p style="color:#888;font-size:12px;margin:4px 0 8px;">${entry.categories.map((c: any) => c.name).join(' · ')}</p>`
          : ''
      const content = (entry.raw_content ?? '').replace(/\n/g, '<br>')
      const segments =
        entry.category_segments?.length > 0
          ? `<div style="margin-top:12px;padding:10px;background:#f8f8f8;border-radius:8px;">${entry.category_segments.map((s: any) => `<p style="margin:4px 0;font-size:13px;"><b>${s.category}</b>: ${s.content}</p>`).join('')}</div>`
          : ''
      return `<div style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #eee;"><h3 style="margin:0 0 4px;font-size:15px;">${dateStr}</h3>${cats}<p style="font-size:14px;line-height:1.7;">${content}</p>${segments}</div>`
    })
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MindLog 내보내기</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:40px auto;color:#333;} @media print{body{margin:20px;}}</style></head><body><h1 style="font-size:22px;margin-bottom:4px;">📓 MindLog</h1><p style="color:#888;font-size:13px;margin-bottom:32px;">${exportData.user?.display_name ?? ''} · ${new Date().toLocaleDateString('ko-KR')} 내보내기</p>${rows}</body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }
}

function filterByDateRange(entries: any[], startDate: string, endDate: string): any[] {
  return entries.filter((entry) => {
    if (!entry.entry_date) return false
    return entry.entry_date >= startDate && entry.entry_date <= endDate
  })
}

export function Settings() {
  const { user, updateUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [exportLoading, setExportLoading] = useState(false)

  // Lock modals: 'setup' | 'disable' | 'change' | null
  type LockModal = 'setup' | 'disable' | 'change' | null
  const [lockModal, setLockModal] = useState<LockModal>(null)
  const [lockCurrentPw, setLockCurrentPw] = useState('')
  const [lockNewPw, setLockNewPw] = useState('')
  const [lockNewPwConfirm, setLockNewPwConfirm] = useState('')
  const [lockError, setLockError] = useState('')
  const [lockLoading, setLockLoading] = useState(false)
  const [clearEntriesOnDisable, setClearEntriesOnDisable] = useState(false)

  const lockEnabled = user?.profile?.entry_lock_enabled ?? false
  const hasLockPassword = user?.profile?.has_lock_password ?? false

  const openLockModal = (modal: LockModal) => {
    setLockCurrentPw('')
    setLockNewPw('')
    setLockNewPwConfirm('')
    setLockError('')
    setClearEntriesOnDisable(false)
    setLockModal(modal)
  }

  const handleSetupLock = async () => {
    if (lockNewPw.length < 4) { setLockError('비밀번호는 4자 이상이어야 해요.'); return }
    if (lockNewPw !== lockNewPwConfirm) { setLockError('비밀번호가 일치하지 않아요.'); return }
    setLockLoading(true)
    setLockError('')
    try {
      const updated = await usersApi.setupLock(lockNewPw)
      updateUser(updated)
      setLockModal(null)
    } catch {
      setLockError('설정에 실패했어요. 다시 시도해주세요.')
    } finally {
      setLockLoading(false)
    }
  }

  const handleDisableLock = async () => {
    if (!lockCurrentPw) { setLockError('현재 비밀번호를 입력해주세요.'); return }
    setLockLoading(true)
    setLockError('')
    try {
      const updated = await usersApi.disableLock(lockCurrentPw, clearEntriesOnDisable)
      updateUser(updated)
      setLockModal(null)
    } catch (e: any) {
      setLockError(e?.response?.status === 401 ? '비밀번호가 일치하지 않아요.' : '해제에 실패했어요. 다시 시도해주세요.')
    } finally {
      setLockLoading(false)
    }
  }

  const handleChangeLockPassword = async () => {
    if (hasLockPassword && !lockCurrentPw) { setLockError('현재 비밀번호를 입력해주세요.'); return }
    if (lockNewPw.length < 4) { setLockError('새 비밀번호는 4자 이상이어야 해요.'); return }
    if (lockNewPw !== lockNewPwConfirm) { setLockError('비밀번호가 일치하지 않아요.'); return }
    setLockLoading(true)
    setLockError('')
    try {
      const updated = await usersApi.changeLockPassword(lockCurrentPw, lockNewPw)
      updateUser(updated)
      setLockModal(null)
    } catch (e: any) {
      setLockError(e?.response?.status === 401 ? '현재 비밀번호가 일치하지 않아요.' : '변경에 실패했어요. 다시 시도해주세요.')
    } finally {
      setLockLoading(false)
    }
  }

  // Export options
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [exportRange, setExportRange] = useState<ExportRange>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: user?.display_name ?? '',
      ai_name: user?.profile?.ai_name ?? '',
    },
  })

  const deleteMutation = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      logout()
      navigate('/login')
    },
    onError: () => {
      setShowDeleteModal(false)
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const updated = await usersApi.updateMe({
        display_name: data.display_name,
        ai_name: data.ai_name?.trim() || null,
      })
      updateUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('root', { message: '저장에 실패했어요. 잠시 후 다시 시도해주세요.' })
    }
  }

  const dateRangeValid =
    exportRange === 'all' || (startDate.length > 0 && endDate.length > 0 && startDate <= endDate)

  const handleExport = async () => {
    if (exportFormat === 'hwp') return
    setExportLoading(true)
    try {
      const raw = await usersApi.exportData()
      const filteredEntries =
        exportRange === 'dateRange' && startDate && endDate
          ? filterByDateRange(raw.entries ?? [], startDate, endDate)
          : (raw.entries ?? [])
      const exportData = { ...raw, entries: filteredEntries }

      const dateTag = new Date().toISOString().split('T')[0]

      if (exportFormat === 'pdf') {
        openPrintWindow(exportData)
        return
      }

      let content: string
      let mimeType: string
      let filename: string

      if (exportFormat === 'txt') {
        content = buildTxt(exportData)
        mimeType = 'text/plain;charset=utf-8'
        filename = `mindlog-export-${dateTag}.txt`
      } else {
        content = JSON.stringify(exportData, null, 2)
        mimeType = 'application/json'
        filename = `mindlog-export-${dateTag}.json`
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    } finally {
      setExportLoading(false)
    }
  }

  const canDelete = deleteConfirmText === '탈퇴하겠습니다'

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-800">설정</h1>

        {/* Profile form */}
        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">닉네임 / 이름</label>
            <p className="text-xs text-gray-400 mb-1.5">AI가 대화 중 이 이름으로 불러드려요</p>
            <input
              {...register('display_name')}
              type="text"
              className="input-field"
              placeholder="나를 부를 이름"
            />
            {errors.display_name && (
              <p className="mt-1 text-xs text-red-500">{errors.display_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI 이름</label>
            <p className="text-xs text-gray-400 mb-1.5">
              AI에게 붙여줄 이름이에요. 비워두면 기본 이름으로 불려요.
            </p>
            <input
              {...register('ai_name')}
              type="text"
              className="input-field"
              placeholder="예: 백설, 루나, 하루 (선택)"
            />
            {errors.ai_name && (
              <p className="mt-1 text-xs text-red-500">{errors.ai_name.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{errors.root.message}</p>
          )}
          {saved && (
            <p className="text-sm text-primary-600 bg-primary-50 rounded-lg p-3">저장됐어요!</p>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? '저장 중...' : '저장하기'}
          </button>
        </form>

        {/* 일기 잠금 설정 */}
        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-700">일기 열람 잠금</h2>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {lockEnabled
                  ? '잠금이 켜져 있어요. 일기 화면에서 개별 일기를 잠글 수 있어요.'
                  : '켜두면 비밀번호로 특정 일기를 잠글 수 있어요.'}
              </p>
            </div>
            <button
              onClick={() => lockEnabled ? openLockModal('disable') : openLockModal('setup')}
              className={clsx(
                'ml-4 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
                lockEnabled ? 'bg-primary-500' : 'bg-gray-200'
              )}
              role="switch"
              aria-checked={lockEnabled}
            >
              <span
                className={clsx(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  lockEnabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
          {lockEnabled && !hasLockPassword && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2"
            >
              <p className="text-xs text-amber-700">비밀번호가 설정되지 않았어요.</p>
              <button
                onClick={() => openLockModal('setup')}
                className="text-xs font-medium text-amber-700 underline ml-2"
              >
                지금 설정하기
              </button>
            </motion.div>
          )}
          {lockEnabled && hasLockPassword && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <p className="text-xs text-gray-400">비밀번호가 설정되어 있어요.</p>
              <button
                onClick={() => openLockModal('change')}
                className="text-xs text-primary-600 font-medium hover:underline"
              >
                비밀번호 변경
              </button>
            </motion.div>
          )}
        </div>

        {/* Data export */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">데이터 내보내기</h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              내가 기록한 대화와 패턴 분석을 원하는 형식으로 다운로드해요.
            </p>
          </div>

          {/* Format selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">형식</p>
            <div className="grid grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => opt.ready && setExportFormat(opt.value)}
                  disabled={!opt.ready}
                  title={!opt.ready ? '준비 중이에요' : undefined}
                  className={clsx(
                    'relative py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                    !opt.ready
                      ? 'border-transparent bg-gray-50 text-gray-300 cursor-not-allowed'
                      : exportFormat === opt.value
                      ? 'border-primary-400 bg-primary-50 text-primary-600'
                      : 'border-transparent bg-gray-50 text-gray-500 hover:border-gray-200',
                  )}
                >
                  {opt.label}
                  {!opt.ready && (
                    <span className="absolute -top-1.5 -right-1 text-[9px] bg-gray-200 text-gray-400 rounded px-1 leading-tight">
                      예정
                    </span>
                  )}
                </button>
              ))}
            </div>
            {exportFormat === 'pdf' && (
              <p className="text-xs text-gray-400">
                브라우저 인쇄 창이 열려요. "PDF로 저장"을 선택하세요.
              </p>
            )}
          </div>

          {/* Range selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">기간</p>
            <div className="flex gap-2">
              {[
                { value: 'all' as ExportRange, label: '전체' },
                { value: 'dateRange' as ExportRange, label: '날짜 지정' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExportRange(opt.value)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all',
                    exportRange === opt.value
                      ? 'border-primary-400 bg-primary-50 text-primary-600'
                      : 'border-transparent bg-gray-50 text-gray-500 hover:border-gray-200',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range picker */}
          <AnimatePresence>
            {exportRange === 'dateRange' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-gray-400">시작일</p>
                      <input
                        type="date"
                        value={startDate}
                        max={endDate || undefined}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                    <span className="text-gray-300 mt-5">~</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-gray-400">종료일</p>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                  {startDate && endDate && startDate > endDate && (
                    <p className="text-xs text-red-500">시작일이 종료일보다 늦을 수 없어요.</p>
                  )}
                  {startDate && endDate && startDate <= endDate && (
                    <p className="text-xs text-gray-400">
                      {format(parseISO(startDate), 'yyyy년 M월 d일', { locale: ko })} ~{' '}
                      {format(parseISO(endDate), 'yyyy년 M월 d일', { locale: ko })} 기록만
                      포함돼요.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleExport}
            disabled={exportLoading || exportFormat === 'hwp' || !dateRangeValid}
            className="btn-secondary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportLoading
              ? '준비 중...'
              : exportFormat === 'pdf'
              ? '🖨️ 인쇄 창 열기'
              : `📦 ${FORMAT_OPTIONS.find((f) => f.value === exportFormat)?.label ?? ''} 파일 다운로드`}
          </button>
        </div>

        {/* Account deletion */}
        <div className="card p-6 space-y-3 border border-red-100">
          <h2 className="text-sm font-semibold text-red-600">계정 탈퇴</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            탈퇴하면 모든 대화, 패턴 분석, 프로필 데이터가 영구적으로 삭제돼요. 되돌릴 수
            없어요.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full text-sm text-red-500 border border-red-200 rounded-xl py-2.5 hover:bg-red-50 transition-colors font-medium"
          >
            탈퇴하기
          </button>
        </div>
      </div>

      {/* Lock modals: setup / disable / change */}
      <AnimatePresence>
        {lockModal !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={(e) => e.target === e.currentTarget && setLockModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              {/* Setup */}
              {lockModal === 'setup' && (
                <>
                  <div className="text-center space-y-1">
                    <p className="text-2xl">🔒</p>
                    <h3 className="text-lg font-bold text-gray-800">잠금 비밀번호 설정</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      일기를 잠글 때 사용할 비밀번호를 설정해요. 4자 이상이면 돼요.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="password"
                      value={lockNewPw}
                      onChange={(e) => { setLockNewPw(e.target.value); setLockError('') }}
                      placeholder="새 비밀번호 (4자 이상)"
                      className="input-field text-sm"
                      autoFocus
                    />
                    <input
                      type="password"
                      value={lockNewPwConfirm}
                      onChange={(e) => { setLockNewPwConfirm(e.target.value); setLockError('') }}
                      placeholder="비밀번호 확인"
                      className="input-field text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleSetupLock()}
                    />
                    {lockError && <p className="text-xs text-red-500">{lockError}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setLockModal(null)} className="btn-secondary flex-1 text-sm">취소</button>
                    <button onClick={handleSetupLock} disabled={lockLoading} className="btn-primary flex-1 text-sm disabled:opacity-60">
                      {lockLoading ? '설정 중...' : '설정하기'}
                    </button>
                  </div>
                </>
              )}

              {/* Disable */}
              {lockModal === 'disable' && (
                <>
                  <div className="text-center space-y-1">
                    <p className="text-2xl">🔓</p>
                    <h3 className="text-lg font-bold text-gray-800">잠금 끄기</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      현재 비밀번호를 입력하면 잠금 기능이 꺼져요.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="password"
                      value={lockCurrentPw}
                      onChange={(e) => { setLockCurrentPw(e.target.value); setLockError('') }}
                      placeholder="현재 비밀번호"
                      className="input-field text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleDisableLock()}
                    />
                    {lockError && <p className="text-xs text-red-500">{lockError}</p>}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clearEntriesOnDisable}
                        onChange={(e) => setClearEntriesOnDisable(e.target.checked)}
                        className="mt-0.5 rounded"
                      />
                      <span className="text-xs text-gray-500 leading-relaxed">
                        잠금된 일기도 함께 해제할게요
                        <br />
                        <span className="text-gray-400">체크 해제 시 잠금 표시는 유지되나 열람은 가능해요</span>
                      </span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setLockModal(null)} className="btn-secondary flex-1 text-sm">취소</button>
                    <button onClick={handleDisableLock} disabled={lockLoading} className="flex-1 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-xl py-2.5 font-medium transition-colors">
                      {lockLoading ? '해제 중...' : '잠금 끄기'}
                    </button>
                  </div>
                </>
              )}

              {/* Change password */}
              {lockModal === 'change' && (
                <>
                  <div className="text-center space-y-1">
                    <p className="text-2xl">🔑</p>
                    <h3 className="text-lg font-bold text-gray-800">비밀번호 변경</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      현재 비밀번호 확인 후 새 비밀번호를 설정해요.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {hasLockPassword && (
                      <input
                        type="password"
                        value={lockCurrentPw}
                        onChange={(e) => { setLockCurrentPw(e.target.value); setLockError('') }}
                        placeholder="현재 비밀번호"
                        className="input-field text-sm"
                        autoFocus
                      />
                    )}
                    <input
                      type="password"
                      value={lockNewPw}
                      onChange={(e) => { setLockNewPw(e.target.value); setLockError('') }}
                      placeholder="새 비밀번호 (4자 이상)"
                      className="input-field text-sm"
                      autoFocus={!hasLockPassword}
                    />
                    <input
                      type="password"
                      value={lockNewPwConfirm}
                      onChange={(e) => { setLockNewPwConfirm(e.target.value); setLockError('') }}
                      placeholder="새 비밀번호 확인"
                      className="input-field text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleChangeLockPassword()}
                    />
                    {lockError && <p className="text-xs text-red-500">{lockError}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setLockModal(null)} className="btn-secondary flex-1 text-sm">취소</button>
                    <button onClick={handleChangeLockPassword} disabled={lockLoading} className="btn-primary flex-1 text-sm disabled:opacity-60">
                      {lockLoading ? '변경 중...' : '변경하기'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
            >
              <div className="text-center space-y-1">
                <p className="text-2xl">⚠️</p>
                <h3 className="text-lg font-bold text-gray-800">정말 탈퇴할까요?</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  모든 대화, 패턴 분석, 프로필이 즉시 삭제되며 복구할 수 없어요.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  탈퇴를 확인하려면 아래에{' '}
                  <span className="font-semibold text-red-500">탈퇴하겠습니다</span>를 입력하세요.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="탈퇴하겠습니다"
                  className="input-field text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmText('')
                  }}
                  className="btn-secondary flex-1 text-sm"
                >
                  취소
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={!canDelete || deleteMutation.isPending}
                  className="flex-1 text-sm text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 rounded-xl py-2.5 font-medium transition-colors"
                >
                  {deleteMutation.isPending ? '삭제 중...' : '탈퇴하기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  )
}
