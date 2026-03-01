import { useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuthStore } from '@/store/authStore'
import { useLockStore } from '@/store/lockStore'
import { usersApi } from '@/api/users'
import { authApi } from '@/api/auth'
import { clsx } from 'clsx'
import { wa } from '@/utils/josa'

interface Props {
  children: React.ReactNode
}

interface NavItem {
  label: string
  icon: string
  getTo: () => string
  matchPrefix: string
}

// ── 세션 잠금 오버레이 ─────────────────────────────────────────────────────────
function SessionLockOverlay({ onUnlocked }: { onUnlocked: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || loading) return
    setLoading(true)
    setError('')
    try {
      await usersApi.verifyLock(pw)
      onUnlocked()
    } catch {
      setError('비밀번호가 일치하지 않아요.')
      setPw('')
      setTimeout(() => inputRef.current?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-4xl">🔒</p>
          <h2 className="text-lg font-bold text-gray-800">잠금 해제</h2>
          <p className="text-sm text-gray-500">비밀번호를 입력하면 계속 볼 수 있어요.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={!pw || loading}
            className="w-full btn-primary text-sm disabled:opacity-60"
          >
            {loading ? '확인 중...' : '잠금 해제'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── 메인 레이아웃 ─────────────────────────────────────────────────────────────
export function Layout({ children }: Props) {
  const { user, refreshToken, logout } = useAuthStore()
  const { sessionLocked, unlockSession } = useLockStore()
  const lockEnabled = user?.profile?.entry_lock_enabled ?? false
  const hasLockPassword = user?.profile?.has_lock_password ?? false
  const aiName = user?.profile?.ai_name

  const NAV_ITEMS: NavItem[] = [
    { label: '홈', icon: '🏠', getTo: () => '/dashboard', matchPrefix: '/dashboard' },
    {
      label: aiName ? `${aiName}${wa(aiName)} 대화` : '오늘 대화',
      icon: '✏️',
      getTo: () => `/entry/${format(new Date(), 'yyyy-MM-dd')}`,
      matchPrefix: '/entry',
    },
    { label: '인사이트', icon: '📊', getTo: () => '/insights', matchPrefix: '/insights' },
    { label: '알림', icon: '🔔', getTo: () => '/reminders', matchPrefix: '/reminders' },
  ]
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // ignore errors on logout
    } finally {
      logout()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 세션 잠금 오버레이 */}
      {sessionLocked && lockEnabled && hasLockPassword && (
        <SessionLockOverlay onUnlocked={unlockSession} />
      )}

      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="text-lg font-bold text-primary-600 tracking-tight">
            MindLog
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.matchPrefix}
                to={item.getTo()}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith(item.matchPrefix)
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                )}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="text-sm text-gray-500 hidden sm:block hover:text-primary-600 transition-colors"
            >
              {user?.display_name}
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.matchPrefix}
              to={item.getTo()}
              className={clsx(
                'flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors',
                location.pathname.startsWith(item.matchPrefix)
                  ? 'text-primary-600'
                  : 'text-gray-400'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>
    </div>
  )
}