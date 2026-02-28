import { useEffect, useRef, useCallback } from 'react'

interface UseAutoLockOptions {
  enabled: boolean
  timeoutMinutes: number
  onLock: () => void
}

/**
 * 탭이 숨겨진 상태로 `timeoutMinutes`분이 지나면 `onLock`을 호출한다.
 * enabled=false이면 아무것도 하지 않는다.
 */
export function useAutoLock({ enabled, timeoutMinutes, onLock }: UseAutoLockOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenAtRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearTimer()
      hiddenAtRef.current = null
      return
    }

    const timeoutMs = timeoutMinutes * 60 * 1000

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
        timerRef.current = setTimeout(() => {
          onLock()
        }, timeoutMs)
      } else {
        // 탭이 다시 보일 때 — 타이머가 아직 살아있으면 취소
        clearTimer()
        hiddenAtRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimer()
    }
  }, [enabled, timeoutMinutes, onLock, clearTimer])
}
