import { useCallback, useRef, useState } from 'react'

type SaveFn<T> = (data: T) => Promise<void>

export function useAutoSave<T>(saveFn: SaveFn<T>, delay = 1500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const save = useCallback(
    (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setSaveStatus('idle')

      timerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await saveFn(data)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch {
          setSaveStatus('error')
        }
      }, delay)
    },
    [saveFn, delay]
  )

  const flush = useCallback(
    async (data: T) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setSaveStatus('saving')
      try {
        await saveFn(data)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
        throw new Error('저장에 실패했습니다.')
      }
    },
    [saveFn]
  )

  return { save, flush, saveStatus }
}
