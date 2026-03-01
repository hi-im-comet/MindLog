import { create } from 'zustand'

interface LockState {
  sessionLocked: boolean
  lockSession: () => void
  unlockSession: () => void
}

/**
 * 수동 잠금 / 자동 잠금 세션 상태.
 * 앱이 새로고침되면 초기화된다 (고의적 — 새로고침 = 잠금 해제).
 */
export const useLockStore = create<LockState>((set) => ({
  sessionLocked: false,
  lockSession: () => set({ sessionLocked: true }),
  unlockSession: () => set({ sessionLocked: false }),
}))
